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
  iamSessionToken?: string;
  region: string;
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
  // The Labs account ID where roles can be assumed
  private readonly LABS_ACCOUNT_ID = "766363046973";

  constructor() {
    this.managementAccountId = process.env.AWS_MANAGEMENT_ACCOUNT_ID || "";
    this.managementRole = process.env.AWS_MANAGEMENT_ACCOUNT_ROLE_ARN || "";
    this.region = process.env.AWS_REGION || "ap-south-1";

    this.organizations = new AWS.Organizations({ region: this.region });
    this.iam = new AWS.IAM({ region: this.region });
  }

  /**
   * Get credentials by assuming a role in the Labs account
   * Uses App Runner's instance role to assume the Labs role
   */
  private async getLabsCredentials(labId: string, userId: string): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: Date;
  }> {
    const sts = new AWS.STS();
    
    // Role name based on lab ID - e.g., Labs-S3-Admin, Labs-Lambda-Admin
    const roleName = this.getLabRoleName(labId);
    const roleArn = `arn:aws:iam::${this.LABS_ACCOUNT_ID}:role/${roleName}`;
    
    console.log(`[AWSControlTower] Assuming role: ${roleArn}`);
    
    try {
      const response = await sts.assumeRole({
        RoleArn: roleArn,
        RoleSessionName: `lab-session-${userId}-${Date.now()}`,
        DurationSeconds: 3600, // 1 hour
      }).promise();
      
      if (!response.Credentials) {
        throw new Error("Failed to get temporary credentials from STS");
      }
      
      console.log(`[AWSControlTower] Successfully assumed role: ${roleName}`);
      
      return {
        accessKeyId: response.Credentials.AccessKeyId,
        secretAccessKey: response.Credentials.SecretAccessKey,
        sessionToken: response.Credentials.SessionToken,
        expiration: response.Credentials.Expiration,
      };
    } catch (error) {
      console.error(`[AWSControlTower] Failed to assume role ${roleArn}:`, error);
      throw new Error(`Failed to assume lab role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the role name for a specific lab
   */
  private getLabRoleName(labId: string): string {
    const roleNames: Record<string, string> = {
      "lab-1-s3": "Labs-S3-Admin",
      "lab-2-iam": "Labs-IAM-Admin", 
      "lab-3-ec2": "Labs-EC2-Admin",
      "lab-4-lambda": "Labs-Lambda-Admin",
      "lab-5-dynamodb": "Labs-DynamoDB-Admin",
      "lab-6-cloudtrail": "Labs-CloudTrail-Admin",
      "lab-7-ssm": "Labs-SSM-Admin",
    };
    
    return roleNames[labId] || "Labs-ReadOnly";
  }

  /**
   * Create a new sandbox AWS account
   * Priority: Env vars > Dev mode > Labs account
   */
  async createSandboxAccount(userId: string, labId: string, region: string = "ap-south-1"): Promise<SandboxAccount> {
    // Check if AWS credentials are provided in environment - use these FIRST regardless of NODE_ENV
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION || region;
    
    // If AWS credentials are provided in environment, use them directly
    if (awsAccessKeyId && awsSecretAccessKey) {
      console.log(`[AWSControlTower] Using credentials from environment variables for lab: ${labId}`);
      
      // Check if these are temporary STS credentials (ASIA...)
      const isStsCredential = awsAccessKeyId.startsWith("ASIA");
      
      const sandbox: SandboxAccount = {
        accountId: "000000000000", // User's own account
        accountName: `lab-${labId}-${userId}`,
        email: "lab@sandbox.local",
        iamUserId: "environment-user",
        iamUserName: "environment-user",
        iamAccessKeyId: awsAccessKeyId,
        iamSecretAccessKey: awsSecretAccessKey,
        iamSessionToken: isStsCredential ? process.env.AWS_SESSION_TOKEN : undefined,
        region: awsRegion,
        createdAt: Date.now(),
        expiresAt: isStsCredential ? Date.now() + 60 * 60 * 1000 : Date.now() + 365 * 24 * 60 * 60 * 1000,
        status: "active",
      };
      
      console.log(`[AWSControlTower] Sandbox created with environment credentials (STS: ${isStsCredential})`);
      return sandbox;
    }
    
    // Check if we should use dev mode (only if no AWS credentials provided)
    const isDevMode = process.env.NODE_ENV !== "production" || process.env.USE_DEV_CREDENTIALS === "true";
    
    // In development mode without credentials, use DEVKEY
    if (isDevMode) {
      console.log(`[AWSControlTower] Using DEVKEY credentials for lab: ${labId} (development mode)`);
      return {
        accountId: "000000000000",
        accountName: `lab-${labId}-${userId}-dev`,
        email: "dev@sandbox.local",
        iamUserId: "dev-user",
        iamUserName: "dev-user",
        iamAccessKeyId: "DEVKEY",
        iamSecretAccessKey: "DEVSECRET",
        region: region,
        createdAt: Date.now(),
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
        status: "active",
      };
    }
    
    // Production mode - try Labs account
    try {
      console.log(`[AWSControlTower] Creating sandbox for lab: ${labId}, user: ${userId}`);
      
      // Get temporary credentials by assuming the lab role
      const credentials = await this.getLabsCredentials(labId, userId);
      
      const sandbox: SandboxAccount = {
        accountId: this.LABS_ACCOUNT_ID,
        accountName: `lab-${labId}-${userId}`,
        email: "lab@sandbox.local",
        iamUserId: "lab-role",
        iamUserName: this.getLabRoleName(labId),
        iamAccessKeyId: credentials.accessKeyId,
        iamSecretAccessKey: credentials.secretAccessKey,
        iamSessionToken: credentials.sessionToken,
        region: region,
        createdAt: Date.now(),
        expiresAt: credentials.expiration.getTime(),
        status: "active",
      };
      
      console.log(`[AWSControlTower] Sandbox created with assumed role credentials (expires: ${credentials.expiration})`);
      return sandbox;
    } catch (error) {
      console.error("[AWSControlTower] Failed to create sandbox:", error);
      
      // In production, we can't fall back to DEVKEY - we need real credentials
      // Throw a clear error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to create lab session: ${errorMessage}\n\n` +
        `To use this feature with real AWS access, you need to:\n` +
        `Option 1 (Recommended): Set these environment variables:\n` +
        `  - AWS_ACCESS_KEY_ID=your_access_key\n` +
        `  - AWS_SECRET_ACCESS_KEY=your_secret_key\n` +
        `  - AWS_REGION=us-east-1\n\n` +
        `Option 2: Set up an AWS Labs account with ID: ${this.LABS_ACCOUNT_ID}\n` +
        `  - Create IAM roles for each lab type (Labs-S3-Admin, Labs-IAM-Admin, etc.)\n` +
        `  - Configure cross-account access from your backend account\n\n` +
        `Or run in development mode by setting NODE_ENV=development`
      );
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

      const userIdResponse = createUserResponse.User?.UserId || uuidv4();

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

      if (!accessKey?.AccessKeyId || !accessKey?.SecretAccessKey) {
        throw new Error("Failed to create access key - keys were not returned from AWS");
      }

      // Validate the created access key by attempting to use it
      console.log(`[AWSControlTower] Validating created access keys for user: ${userName}`);
      await this.validateAccessKey(
        accessKey.AccessKeyId,
        accessKey.SecretAccessKey
      );

      return {
        iamUserId: userIdResponse,
        userName,
        accessKeyId: accessKey.AccessKeyId,
        secretAccessKey: accessKey.SecretAccessKey,
      };
    } catch (error) {
      console.error("[AWSControlTower] Failed to create IAM user:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create IAM user: ${errorMessage}`);
    }
  }

  /**
   * Validate that access keys are actually working
   */
  private async validateAccessKey(
    accessKeyId: string,
    secretAccessKey: string
  ): Promise<void> {
    try {
      const sts = new AWS.STS({
        accessKeyId,
        secretAccessKey,
        region: this.region,
      });

      console.log("[AWSControlTower] Testing access key with STS GetCallerIdentity...");
      const result = await sts.getCallerIdentity().promise();
      console.log(
        `[AWSControlTower] Access key validated. Account: ${result.Account}, UserId: ${result.UserId}`
      );
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error(
        "[AWSControlTower] Access key validation failed:",
        errorMessage
      );

      if (
        errorMessage?.includes("security token") ||
        errorMessage?.includes("InvalidClientTokenId")
      ) {
        throw new Error(
          "Created access key is invalid. The AWS credentials are not working properly."
        );
      }

      throw new Error(`Access key validation failed: ${errorMessage}`);
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

      // Delete IAM user and all associated resources (if it exists)
      if (iamUserName) {
        try {
          await this.deleteIAMUser(iamUserName);
        } catch (iamError: any) {
          // If the user doesn't exist, just log and continue - this is not a fatal error
          if (iamError.code === 'NoSuchEntity' || iamError.code === 'ResourceNotFoundException') {
            console.log(`[AWSControlTower] IAM user ${iamUserName} does not exist, skipping cleanup`);
          } else {
            // For other errors, log but don't fail the session destruction
            console.warn(`[AWSControlTower] Warning: Failed to delete IAM user ${iamUserName}:`, iamError.message);
          }
        }
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
      // Don't throw - session cleanup should succeed even if AWS cleanup fails
      console.log(`[AWSControlTower] Session cleanup completed (with warnings)`);
    }
  }

  /**
   * Delete IAM user and all associated resources
   */
  private async deleteIAMUser(userName: string): Promise<void> {
    try {
      console.log(`[AWSControlTower] Deleting IAM user: ${userName}`);

      // First check if user exists
      try {
        await this.iam.getUser({ UserName: userName }).promise();
      } catch (getUserError: any) {
        // If user doesn't exist, just log and return
        if (getUserError.code === 'NoSuchEntity' || getUserError.code === 'ResourceNotFoundException') {
          console.log(`[AWSControlTower] IAM user ${userName} does not exist, skipping deletion`);
          return;
        }
        // For other errors, re-throw
        throw getUserError;
      }

      // Detach all policies
      const attachedPolicies = await this.iam.listAttachedUserPolicies({ UserName: userName }).promise();
      for (const policy of attachedPolicies.AttachedPolicies || []) {
        try {
          await this.iam.detachUserPolicy({
            UserName: userName,
            PolicyArn: policy.PolicyArn!
          }).promise();
        } catch (e: any) {
          // Ignore if policy doesn't exist
          if (e.code !== 'NoSuchEntity') throw e;
        }
      }

      // Delete inline policies
      const inlinePolicies = await this.iam.listUserPolicies({ UserName: userName }).promise();
      for (const policyName of inlinePolicies.PolicyNames || []) {
        try {
          await this.iam.deleteUserPolicy({
            UserName: userName,
            PolicyName: policyName
          }).promise();
        } catch (e: any) {
          // Ignore if policy doesn't exist
          if (e.code !== 'NoSuchEntity') throw e;
        }
      }

      // Delete access keys
      const accessKeys = await this.iam.listAccessKeys({ UserName: userName }).promise();
      for (const accessKey of accessKeys.AccessKeyMetadata || []) {
        try {
          await this.iam.deleteAccessKey({
            UserName: userName,
            AccessKeyId: accessKey.AccessKeyId!
          }).promise();
        } catch (e: any) {
          // Ignore if key doesn't exist
          if (e.code !== 'NoSuchEntity') throw e;
        }
      }

      // Delete the user
      await this.iam.deleteUser({ UserName: userName }).promise();

      console.log(`[AWSControlTower] IAM user ${userName} deleted successfully`);
    } catch (error: any) {
      // If the user doesn't exist, just log and continue
      if (error.code === 'NoSuchEntity' || error.code === 'ResourceNotFoundException') {
        console.log(`[AWSControlTower] IAM user ${userName} already deleted or does not exist`);
        return;
      }
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
