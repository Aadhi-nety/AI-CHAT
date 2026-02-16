import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

export interface SandboxAccount {
  accountId: string;
  accountName: string;
  email: string;
  iamUserId: string;
  iamUserName: string;
  iamAccessKeyId: string;
  iamSecretAccessKey: string;
  createdAt: number;
  expiresAt: number;
  status: "creating" | "active" | "destroying" | "destroyed";
}

export interface LabSandboxConfig {
  accountId: string;
  region: string;
  iamAccessKeyId: string;
  iamSecretAccessKey: string;
  labPermissions: string[];
}

export class AWSControlTowerService {
  private organizations: AWS.Organizations;
  private iam: AWS.IAM;
  private managementAccountId: string;
  private managementRole: string;
  private region: string;

  constructor() {
    this.managementAccountId = process.env.AWS_MANAGEMENT_ACCOUNT_ID || "";
    this.managementRole = process.env.AWS_MANAGEMENT_ACCOUNT_ROLE_ARN || "";
    this.region = process.env.AWS_REGION || "us-east-1";

    this.organizations = new AWS.Organizations({ region: this.region });
    this.iam = new AWS.IAM({ region: this.region });
  }

  /**
   * Create a new sandbox AWS account
   */
  async createSandboxAccount(userId: string, labId: string): Promise<SandboxAccount> {
    // if AWS credentials are missing we either are running in local/dev or the service
    // hasn't been configured properly.  In production we want to fail fast with a
    // clear error; for local development we'll return a mock account so that the
    // rest of the flow can be exercised without calling AWS.
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      if (process.env.NODE_ENV === "production") {
        console.error("[AWSControlTower] AWS credentials are not configured");
        throw new Error("AWS credentials not configured on backend");
      } else {
        console.warn("[AWSControlTower] AWS credentials missing, using mock sandbox (dev mode)");
        // return a minimal fake account so UI still works
        return {
          accountId: "000000000000",
          accountName: `lab-${labId}-${userId}-dev`,
          email: "dev@sandbox.local",
          iamUserId: "dev-user",
          iamUserName: "dev-user",
          iamAccessKeyId: "DEVKEY",
          iamSecretAccessKey: "DEVSECRET",
          createdAt: Date.now(),
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          status: "active",
        };
      }
    }

    try {
      // Generate unique account name
      const accountName = `lab-${labId}-${userId}-${uuidv4().slice(0, 8)}`;
      const accountEmail = `lab-${uuidv4().slice(0, 12)}@sandbox.labs.internal`;

      console.log(
        `[AWSControlTower] Creating account: ${accountName} (${accountEmail})`
      );

      // In production, use AWS Organizations CreateAccount API
      // const accountResponse = await this.organizations.createAccount({
      //   AccountName: accountName,
      //   Email: accountEmail,
      // }).promise();
      // const accountId = accountResponse.CreateAccountStatus?.AccountId!;

      // For demo: generate mock account ID
      const accountId = Math.random().toString().slice(2, 14);

      // Create IAM user for the lab in the sandbox account
      const iamUser = await this.createLabIAMUser(accountId, userId, labId);

      const sandbox: SandboxAccount = {
        accountId,
        accountName,
        email: accountEmail,
        iamUserId: iamUser.iamUserId,
        iamUserName: iamUser.userName,
        iamAccessKeyId: iamUser.accessKeyId,
        iamSecretAccessKey: iamUser.secretAccessKey,
        createdAt: Date.now(),
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
        status: "active",
      };

      console.log(`[AWSControlTower] Sandbox account created: ${accountId}`);
      return sandbox;
    } catch (error) {
      console.error("[AWSControlTower] Failed to create sandbox account:", error);
      throw new Error("Failed to create sandbox account");
    }
  }

  /**
   * Create IAM user with lab-specific permissions
   */
  private async createLabIAMUser(
    accountId: string,
    userId: string,
    labId: string
  ): Promise<{
    iamUserId: string;
    userName: string;
    accessKeyId: string;
    secretAccessKey: string;
  }> {
    try {
      const userName = `lab-user-${userId}-${Date.now()}`;

      // In production, assume role in sandbox account:
      // const credentials = await this.assumeRoleInAccount(accountId);
      // const iamInSandbox = new AWS.IAM({ credentials });

      console.log(`[AWSControlTower] Creating IAM user: ${userName}`);

      // Create user (using management account IAM for demo)
      const createUserResponse = await this.iam
        .createUser({
          UserName: userName,
          Tags: [
            {
              Key: 'Owner',
              Value: process.env.IAM_USERNAME || 'lab-admin'
            }
          ]
        })
        .promise();

      const userId_response = createUserResponse.User?.UserId || uuidv4();

      // Attach lab-specific policy
      const policyName = `lab-${labId}-policy-${Date.now()}`;
      const policyDocument = this.getLabPolicy(labId);

      await this.iam
        .putUserPolicy({
          UserName: userName,
          PolicyName: policyName,
          PolicyDocument: JSON.stringify(policyDocument),
        })
        .promise();

      // Create access key
      const accessKeyResponse = await this.iam
        .createAccessKey({ UserName: userName })
        .promise();

      const accessKey = accessKeyResponse.AccessKey;

      return {
        iamUserId: userId_response,
        userName,
        accessKeyId: accessKey?.AccessKeyId || "",
        secretAccessKey: accessKey?.SecretAccessKey || "",
      };
    } catch (error) {
      console.error("[AWSControlTower] Failed to create IAM user:", error);
      throw new Error("Failed to create IAM user");
    }
  }

  /**
   * Get lab-specific IAM policy based on lab type
   */
  private getLabPolicy(labId: string): Record<string, unknown> {
    const policies: Record<string, Record<string, unknown>> = {
      "lab-1-s3": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["s3:*"],
            Resource: ["arn:aws:s3:::lab-*"],
          },
          {
            Effect: "Allow",
            Action: ["s3:ListAllMyBuckets"],
            Resource: "*",
          },
        ],
      },
      "lab-2-iam": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "iam:GetUser",
              "iam:ListUsers",
              "iam:GetRole",
              "iam:ListRoles",
              "iam:GetPolicy",
              "iam:ListPolicies",
              "iam:AttachUserPolicy",
              "iam:PutUserPolicy",
            ],
            Resource: "*",
          },
        ],
      },
      "lab-3-ec2": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "ec2:DescribeInstances",
              "ec2:DescribeSecurityGroups",
              "ec2:AuthorizeSecurityGroupIngress",
              "ec2:RevokeSecurityGroupIngress",
              "ec2:CreateSecurityGroup",
              "ec2:DescribeVpcs",
            ],
            Resource: "*",
          },
        ],
      },
      "lab-4-lambda": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "lambda:ListFunctions",
              "lambda:GetFunction",
              "lambda:GetFunctionConfiguration",
              "lambda:ListLayers",
              "lambda:GetLayerVersion",
            ],
            Resource: "*",
          },
        ],
      },
      "lab-5-dynamodb": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "dynamodb:ListTables",
              "dynamodb:DescribeTable",
              "dynamodb:Scan",
              "dynamodb:Query",
              "dynamodb:GetItem",
              "dynamodb:BatchGetItem",
            ],
            Resource: ["arn:aws:dynamodb:*:*:table/lab-*"],
          },
        ],
      },
      "lab-6-cloudtrail": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "cloudtrail:LookupEvents",
              "cloudtrail:DescribeTrails",
              "cloudtrail:GetTrailStatus",
            ],
            Resource: "*",
          },
        ],
      },
      "lab-7-ssm": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "ssm:DescribeInstanceInformation",
              "ssm:GetCommandInvocation",
              "ssm:ListCommandInvocations",
              "ssm:SendCommand",
              "ssm:StartSession",
            ],
            Resource: "*",
          },
        ],
      },
    };

    return policies[labId] || policies["lab-1-s3"];
  }

  /**
   * Destroy sandbox account
   */
  async destroySandboxAccount(accountId: string, iamUserName?: string): Promise<void> {
    try {
      console.log(`[AWSControlTower] Destroying account: ${accountId}`);

      // Delete IAM user and all associated resources
      if (iamUserName) {
        await this.deleteIAMUser(iamUserName);
      }

      // In production, close the AWS account
      // This typically requires:
      // 1. Remove organization policies
      // 2. Close/disable the account
      // 3. Archive resources

      // For demo, just log
      console.log(
        `[AWSControlTower] Account ${accountId} marked for deletion`
      );
    } catch (error) {
      console.error("[AWSControlTower] Failed to destroy account:", error);
      throw new Error("Failed to destroy sandbox account");
    }
  }

  /**
   * Delete IAM user and all associated resources
   */
  private async deleteIAMUser(userName: string): Promise<void> {
    try {
      console.log(`[AWSControlTower] Deleting IAM user: ${userName}`);

      // Detach all policies
      const attachedPolicies = await this.iam.listAttachedUserPolicies({ UserName: userName }).promise();
      for (const policy of attachedPolicies.AttachedPolicies || []) {
        await this.iam.detachUserPolicy({
          UserName: userName,
          PolicyArn: policy.PolicyArn!
        }).promise();
      }

      // Delete inline policies
      const inlinePolicies = await this.iam.listUserPolicies({ UserName: userName }).promise();
      for (const policyName of inlinePolicies.PolicyNames || []) {
        await this.iam.deleteUserPolicy({
          UserName: userName,
          PolicyName: policyName
        }).promise();
      }

      // Delete access keys
      const accessKeys = await this.iam.listAccessKeys({ UserName: userName }).promise();
      for (const accessKey of accessKeys.AccessKeyMetadata || []) {
        await this.iam.deleteAccessKey({
          UserName: userName,
          AccessKeyId: accessKey.AccessKeyId!
        }).promise();
      }

      // Delete the user
      await this.iam.deleteUser({ UserName: userName }).promise();

      console.log(`[AWSControlTower] IAM user ${userName} deleted successfully`);
    } catch (error) {
      console.error(`[AWSControlTower] Failed to delete IAM user ${userName}:`, error);
      throw error;
    }
  }

  /**
   * Assume role in sandbox account (for management account)
   */
  private async assumeRoleInAccount(
    accountId: string
  ): Promise<AWS.Credentials> {
    const sts = new AWS.STS();

    const response = await sts
      .assumeRole({
        RoleArn: `arn:aws:iam::${accountId}:role/OrganizationAccountAccessRole`,
        RoleSessionName: `lab-session-${Date.now()}`,
        DurationSeconds: 3600,
      })
      .promise();

    return new AWS.Credentials({
      accessKeyId: response.Credentials?.AccessKeyId || "",
      secretAccessKey: response.Credentials?.SecretAccessKey || "",
      sessionToken: response.Credentials?.SessionToken,
    });
  }
}

export default new AWSControlTowerService();
