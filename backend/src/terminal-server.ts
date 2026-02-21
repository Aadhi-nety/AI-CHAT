import { spawn } from "child_process";
import AWS from "aws-sdk";
import { PassThrough } from "stream";

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
  expiration?: Date;
}

/**
 * STS Credential Refresh Manager
 * Handles automatic refresh of temporary AWS credentials (ASIA keys)
 */
export class STSCredentialManager {
  private roleArn?: string;
  private roleSessionName?: string;
  private region: string;

  constructor(roleArn?: string, roleSessionName?: string, region: string = "us-east-1") {
    this.roleArn = roleArn || process.env.AWS_MANAGEMENT_ACCOUNT_ROLE_ARN;
    this.roleSessionName = roleSessionName || `lab-session-${Date.now()}`;
    this.region = region;
  }

  /**
   * Check if credentials need refresh
   * Returns true if credentials are temporary (ASIA) and expired or about to expire
   */
  needsRefresh(credentials: AWSCredentials): boolean {
    // Only ASIA keys are temporary credentials that need refresh
    if (!credentials.accessKeyId?.startsWith("ASIA")) {
      return false;
    }

    // If no expiration, assume needs refresh (safer)
    if (!credentials.expiration) {
      return true;
    }

    // Refresh if expiring within 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return credentials.expiration < fiveMinutesFromNow;
  }

  /**
   * Refresh credentials by calling STS AssumeRole
   */
  async refreshCredentials(currentCredentials: AWSCredentials): Promise<AWSCredentials> {
    // If no role ARN is configured, we can't refresh
    const roleArn = this.roleArn || process.env.AWS_MANAGEMENT_ACCOUNT_ROLE_ARN;
    if (!roleArn) {
      console.warn("[STSCredentialManager] No role ARN configured, cannot refresh credentials");
      return currentCredentials;
    }

    try {
      console.log("[STSCredentialManager] Refreshing STS credentials...");

      const sts = new AWS.STS({
        accessKeyId: currentCredentials.accessKeyId,
        secretAccessKey: currentCredentials.secretAccessKey,
        sessionToken: currentCredentials.sessionToken,
        region: this.region,
      });

      const result = await sts.assumeRole({
        RoleArn: roleArn,
        RoleSessionName: this.roleSessionName || `lab-session-${Date.now()}`,
        DurationSeconds: 3600, // 1 hour
      }).promise();

      if (!result.Credentials) {
        throw new Error("Failed to get credentials from STS AssumeRole");
      }

      const newCredentials: AWSCredentials = {
        accessKeyId: result.Credentials.AccessKeyId!,
        secretAccessKey: result.Credentials.SecretAccessKey!,
        sessionToken: result.Credentials.SessionToken!,
        expiration: result.Credentials.Expiration,
        region: this.region,
      };

      console.log("[STSCredentialManager] Credentials refreshed successfully");
      return newCredentials;
    } catch (error) {
      console.error("[STSCredentialManager] Failed to refresh credentials:", error);
      throw error;
    }
  }
}

export class TerminalInstance {
  private sessionId: string;
  private credentials: AWSCredentials;
  private commandHistory: string[] = [];
  private isExecuting = false;
  private credentialsValidated = false;
  private credentialManager: STSCredentialManager;

  constructor(sessionId: string, credentials: AWSCredentials) {
    this.sessionId = sessionId;
    this.credentials = credentials;
    this.credentialManager = new STSCredentialManager(
      undefined,
      undefined,
      credentials.region
    );
  }

  /**
   * Check if credentials are temporary/mock credentials (created at lab start)
   */
  private isTemporaryCredential(): boolean {
    // Only consider "DEVKEY" as temporary/mock credential
    // All keys starting with "AKIA" or "ASIA" are real AWS credentials
    return this.credentials.accessKeyId === "DEVKEY";
  }

  /**
   * Check if credentials are STS temporary credentials (ASIA keys)
   */
  private isStsTemporaryCredential(): boolean {
    return this.credentials.accessKeyId?.startsWith("ASIA");
  }

  /**
   * Refresh credentials if they are STS temporary credentials and expired/expiring
   */
  private async refreshCredentialsIfNeeded(): Promise<void> {
    // Only refresh STS temporary credentials
    if (!this.isStsTemporaryCredential()) {
      return;
    }

    // Check if refresh is needed
    if (!this.credentialManager.needsRefresh(this.credentials)) {
      return;
    }

    console.log(`[Terminal:${this.sessionId}] STS credentials expiring soon, refreshing...`);

    try {
      this.credentials = await this.credentialManager.refreshCredentials(this.credentials);
      console.log(`[Terminal:${this.sessionId}] STS credentials refreshed successfully`);
    } catch (error) {
      console.error(`[Terminal:${this.sessionId}] Failed to refresh STS credentials:`, error);
      throw error;
    }
  }

  /**
   * Get AWS SDK credentials object with session token
   */
  private getAwsSdkCredentials(): AWS.Credentials {
    const creds: any = {
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
    };

    // Include session token if present (for STS temporary credentials)
    if (this.credentials.sessionToken) {
      creds.sessionToken = this.credentials.sessionToken;
    }

    return new AWS.Credentials(creds);
  }

  /**
   * Get environment variables for CLI execution with session token
   */
  private getCliEnvironment(): { [key: string]: string } {
    const env: { [key: string]: string } = {
      ...process.env,
      AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
      AWS_DEFAULT_REGION: this.credentials.region,
      AWS_REGION: this.credentials.region,
    };

    // Include session token if present (for STS temporary credentials)
    if (this.credentials.sessionToken) {
      env.AWS_SESSION_TOKEN = this.credentials.sessionToken;
    }

    return env;
  }

  /**
   * Validate AWS credentials by calling sts:GetCallerIdentity
   * Skip validation for temporary/mock credentials from lab sandbox creation
   */
  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    // Skip validation for temporary credentials created at lab start
    if (this.isTemporaryCredential()) {
      console.log(
        `[Terminal:${this.sessionId}] ✓ Using temporary lab credentials (validation skipped)`
      );
      return { valid: true };
    }

    try {
      // Refresh credentials if needed before validation
      await this.refreshCredentialsIfNeeded();

      const sts = new AWS.STS({
        credentials: this.getAwsSdkCredentials(),
        region: this.credentials.region,
      });

      // Log masked credentials for debugging
      const maskedKey = this.credentials.accessKeyId
        ? this.credentials.accessKeyId.substring(0, 4) +
          "*".repeat(this.credentials.accessKeyId.length - 8) +
          this.credentials.accessKeyId.substring(
            this.credentials.accessKeyId.length - 4
          )
        : "undefined";

      const tokenStatus = this.credentials.sessionToken ? "with session token" : "without session token";
      console.log(
        `[Terminal:${this.sessionId}] Validating AWS credentials... (Key: ${maskedKey}, Region: ${this.credentials.region}, ${tokenStatus})`
      );

      // Validate credentials by calling get-caller-identity
      const result = await sts.getCallerIdentity().promise();

      console.log(
        `[Terminal:${this.sessionId}] ✓ Credentials valid. Account: ${result.Account}, UserId: ${result.UserId}, ARN: ${result.Arn}`
      );

      return { valid: true };
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || "UnknownError";

      console.error(
        `[Terminal:${this.sessionId}] ✗ Credential validation failed (${errorCode}): ${errorMessage}`
      );

      const isInvalidToken =
        errorMessage?.includes("security token") ||
        errorMessage?.includes("invalid") ||
        errorMessage?.includes("NotAuthorized") ||
        errorMessage?.includes("does not exist") ||
        errorCode === "InvalidClientTokenId" ||
        errorCode === "SignatureDoesNotMatch";

      if (isInvalidToken) {
        // Provide specific error messages based on the error type
        let userErrorMessage = "AWS credentials are invalid or expired. Please verify your access key ID and secret access key.";
        
        if (errorMessage?.includes("does not exist")) {
          userErrorMessage = 
            "ERROR: The AWS Access Key ID does not exist in our records.\n\n" +
            "This means the access key was never created, has been deleted, or belongs to a different AWS account.\n\n" +
            "Please verify:\n" +
            "1. You are using the correct Access Key ID\n" +
            "2. The IAM user still exists in AWS\n" +
            "3. The access key is still active (not deleted/deactivated)\n" +
            "4. The credentials are for the correct AWS account";
        } else if (errorCode === "SignatureDoesNotMatch") {
          userErrorMessage = 
            "ERROR: The AWS Secret Access Key is incorrect.\n\n" +
            "The signature doesn't match, which means the secret access key is wrong.\n\n" +
            "Please verify your AWS_SECRET_ACCESS_KEY is correct.";
        } else if (errorMessage?.includes("ExpiredToken") || errorMessage?.includes("ExpiredTokenException")) {
          userErrorMessage = 
            "ERROR: AWS session credentials have expired.\n\n" +
            "Your temporary session token has expired. Please refresh your credentials or start a new lab session.";
        }

        console.error(
          `[Terminal:${this.sessionId}] This is a credential authentication error - the keys provided are not valid AWS credentials`
        );
        return {
          valid: false,
          error: userErrorMessage,
        };
      }

      console.error(
        `[Terminal:${this.sessionId}] Other validation error:`,
        error
      );
      return {
        valid: false,
        error: `Credential validation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Execute AWS CLI command with user credentials
   */
  async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.isExecuting) {
        reject(new Error("Previous command still executing"));
        return;
      }

      this.isExecuting = true;
      this.commandHistory.push(command);

      try {
        // Environment setup with AWS credentials (including session token)
        const env = this.getCliEnvironment();

        // Parse command
        const [cmd, ...args] = command.trim().split(/\s+/);

        console.log(`[Terminal:${this.sessionId}] Executing: ${command}`);
        console.log(
          `[Terminal:${this.sessionId}] Environment: Region=${this.credentials.region}, KeyId=${
            this.credentials.accessKeyId
              ? this.credentials.accessKeyId.substring(0, 4) + "****"
              : "undefined"
          }, SessionToken=${this.credentials.sessionToken ? "present" : "none"}`
        );

        // If user invoked the `aws` CLI but the binary is not available in the image,
        // handle common AWS calls via the AWS SDK so the terminal still works.
        if (cmd === 'aws') {
          (async () => {
            try {
              // Refresh credentials if needed before execution
              await this.refreshCredentialsIfNeeded();

              // Validate credentials on first AWS command
              if (!this.credentialsValidated) {
                const validationResult = await this.validateCredentials();
                if (!validationResult.valid) {
                  const output = {
                    command,
                    exitCode: 2,
                    stdout: "",
                    stderr:
                      validationResult.error ||
                      "Failed to validate AWS credentials",
                    timestamp: Date.now(),
                  };
                  this.isExecuting = false;
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }
                this.credentialsValidated = true;
              }

              // Build AWS credentials object with session token
              const awsCredentials = this.getAwsSdkCredentials();

              const service = args[0];
              const action = args[1];

              // Handle SSM commands commonly used by labs
              if (service === 'ssm' && action === 'describe-instance-information') {
                const ssm = new AWS.SSM({ credentials: awsCredentials, region: this.credentials.region });
                const res = await ssm.describeInstanceInformation().promise();
                const output = {
                  command,
                  exitCode: 0,
                  stdout: JSON.stringify(res, null, 2),
                  stderr: '',
                  timestamp: Date.now(),
                };
                resolve(JSON.stringify(output, null, 2));
                return;
              }

              if (service === 'ssm' && action === 'describe-sessions') {
                const ssm = new AWS.SSM({ credentials: awsCredentials, region: this.credentials.region });

                // Simple parser for --filters 'key=target,value=<id>'
                let filtersArg = args.find(a => a === '--filters');
                let filters: any[] | undefined = undefined;
                if (filtersArg) {
                  const idx = args.indexOf(filtersArg);
                  const val = args[idx + 1] || '';
                  // remove surrounding quotes if present
                  const cleaned = val.replace(/^['"]|['"]$/g, '');
                  const parts = cleaned.split(/,\s*/);
                  filters = parts.map(p => {
                    const [k, v] = p.split('=');
                    return { key: k, value: v };
                  });
                }

                const params: any = {};
                if (filters) params.Filters = filters;

                const res = await ssm.describeSessions(params).promise();
                const output = {
                  command,
                  exitCode: 0,
                  stdout: JSON.stringify(res, null, 2),
                  stderr: '',
                  timestamp: Date.now(),
                };
                resolve(JSON.stringify(output, null, 2));
                return;
              }

              // STS: get-caller-identity
              if (service === 'sts' && action === 'get-caller-identity') {
                const sts = new AWS.STS({ credentials: awsCredentials, region: this.credentials.region });
                try {
                  const res = await sts.getCallerIdentity().promise();
                  const output = {
                    command,
                    exitCode: 0,
                    stdout: JSON.stringify(res, null, 2),
                    stderr: '',
                    timestamp: Date.now(),
                  };
                  resolve(JSON.stringify(output, null, 2));
                } catch (err: any) {
                  const output = {
                    command,
                    exitCode: 2,
                    stdout: '',
                    stderr: this.getErrorMessage(err),
                    timestamp: Date.now(),
                  };
                  resolve(JSON.stringify(output, null, 2));
                }
                return;
              }

              // S3: simple `aws s3 ls` and `aws s3 ls s3://bucket`
              if (service === 's3' && action === 'ls') {
                const s3 = new AWS.S3({ credentials: awsCredentials, region: this.credentials.region });
                // `aws s3 ls` with no further args lists buckets
                if (args.length === 2) {
                  const res = await s3.listBuckets().promise();
                  const output = {
                    command,
                    exitCode: 0,
                    stdout: JSON.stringify(res, null, 2),
                    stderr: '',
                    timestamp: Date.now(),
                  };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }

                // `aws s3 ls s3://bucket` -> list objects
                const target = args[1] || '';
                if (target.startsWith('s3://')) {
                  const bucket = target.replace('s3://', '').replace(/\/.*/,'');
                  const res = await s3.listObjectsV2({ Bucket: bucket }).promise();
                  const output = {
                    command,
                    exitCode: 0,
                    stdout: JSON.stringify(res, null, 2),
                    stderr: '',
                    timestamp: Date.now(),
                  };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }
              }

              // s3api list-buckets
              if (service === 's3api' && action === 'list-buckets') {
                const s3 = new AWS.S3({ credentials: awsCredentials, region: this.credentials.region });
                const res = await s3.listBuckets().promise();
                const output = {
                  command,
                  exitCode: 0,
                  stdout: JSON.stringify(res, null, 2),
                  stderr: '',
                  timestamp: Date.now(),
                };
                resolve(JSON.stringify(output, null, 2));
                return;
              }

              // EC2: describe-instances
              if (service === 'ec2' && action === 'describe-instances') {
                const ec2 = new AWS.EC2({ credentials: awsCredentials, region: this.credentials.region });
                try {
                  const res = await ec2.describeInstances().promise();
                  const output = {
                    command,
                    exitCode: 0,
                    stdout: JSON.stringify(res, null, 2),
                    stderr: '',
                    timestamp: Date.now(),
                  };
                  resolve(JSON.stringify(output, null, 2));
                } catch (err: any) {
                  const output = {
                    command,
                    exitCode: 2,
                    stdout: '',
                    stderr: this.getErrorMessage(err),
                    timestamp: Date.now(),
                  };
                  resolve(JSON.stringify(output, null, 2));
                }
                return;
              }

              // IAM: common queries
              if (service === 'iam') {
                const iam = new AWS.IAM({ credentials: awsCredentials, region: this.credentials.region });

                if (action === 'list-users') {
                  try {
                    const res = await iam.listUsers().promise();
                    const output = {
                      command,
                      exitCode: 0,
                      stdout: JSON.stringify(res, null, 2),
                      stderr: '',
                      timestamp: Date.now(),
                    };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = {
                      command,
                      exitCode: 2,
                      stdout: '',
                      stderr: this.getErrorMessage(err),
                      timestamp: Date.now(),
                    };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'get-user') {
                  // next arg may be --user-name or the username directly
                  let userName = args[1] || '';
                  if (userName === '--user-name') userName = args[2] || '';
                  try {
                    const res = await iam.getUser({ UserName: userName || undefined }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = {
                      command,
                      exitCode: 2,
                      stdout: '',
                      stderr: this.getErrorMessage(err),
                      timestamp: Date.now(),
                    };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'list-attached-user-policies') {
                  const userName = args[2] || args[1];
                  if (!userName) {
                    const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --user-name is required for list-attached-user-policies', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                    return;
                  }
                  const res = await iam.listAttachedUserPolicies({ UserName: userName }).promise();
                  const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }

                if (action === 'list-user-policies') {
                  const userName = args[2] || args[1];
                  if (!userName) {
                    const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --user-name is required for list-user-policies', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                    return;
                  }
                  const res = await iam.listUserPolicies({ UserName: userName }).promise();
                  const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }
              }

              // S3API: bucket policy and public access block helpers
              if (service === 's3api') {
                const s3 = new AWS.S3({ credentials: awsCredentials, region: this.credentials.region });

                if (action === 'get-bucket-policy') {
                  const bucket = args[1] || args.find(a => a.startsWith('--bucket'))?.split('=')[1];
                  if (!bucket) {
                    const output = { command, exitCode: 1, stdout: '', stderr: 'Error: bucket name is required for get-bucket-policy', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                    return;
                  }
                  const res = await s3.getBucketPolicy({ Bucket: bucket }).promise();
                  const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }

                if (action === 'put-bucket-policy') {
                  const bucket = args.find((a, i) => a === '--bucket') ? args[args.indexOf('--bucket') + 1] : undefined;
                  const output = { command, exitCode: 1, stdout: '', stderr: 'put-bucket-policy with local file is not supported in this terminal. Use the SDK or provide policy JSON via API.', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }

                if (action === 'put-public-access-block') {
                  const bucket = args[args.indexOf('--bucket') + 1];
                  const configArg = args.find(a => a.startsWith('--public-access-block-configuration')) || '';
                  const configStr = configArg.includes('=') ? configArg.split('=')[1] : '';
                  const pairs = configStr.split(',').filter(Boolean);
                  const config: any = {};
                  pairs.forEach(p => {
                    const [k, v] = p.split('='); if (k && v) config[k] = v === 'true';
                  });
                  try {
                    await s3.putPublicAccessBlock({ Bucket: bucket, PublicAccessBlockConfiguration: config }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify({ success: true }), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 1, stdout: '', stderr: err.message || String(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'get-public-access-block') {
                  const bucket = args[args.indexOf('--bucket') + 1];
                  try {
                    const res = await s3.getPublicAccessBlock({ Bucket: bucket }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 1, stdout: '', stderr: err.message || String(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'get-bucket-acl') {
                  const bucket = args[2] || args[1];
                  if (!bucket) {
                    const output = { command, exitCode: 1, stdout: '', stderr: 'Error: bucket name is required for get-bucket-acl', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                    return;
                  }
                  const res = await s3.getBucketAcl({ Bucket: bucket }).promise();
                  const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }
              }

              // Organizations: list-accounts
              if (service === 'organizations' && action === 'list-accounts') {
                const org = new AWS.Organizations({ credentials: awsCredentials, region: this.credentials.region });
                const res = await org.listAccounts().promise();
                const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                resolve(JSON.stringify(output, null, 2));
                return;
              }

              // DynamoDB: table operations
              if (service === 'dynamodb') {
                const dynamodb = new AWS.DynamoDB({ credentials: awsCredentials, region: this.credentials.region });

                if (action === 'list-tables') {
                  try {
                    const res = await dynamodb.listTables().promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'describe-table') {
                  try {
                    const tableName = args[args.indexOf('--table-name') + 1] || args[2];
                    if (!tableName) {
                      const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --table-name is required', timestamp: Date.now() };
                      resolve(JSON.stringify(output, null, 2));
                      return;
                    }
                    const res = await dynamodb.describeTable({ TableName: tableName }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'scan') {
                  try {
                    const tableName = args[args.indexOf('--table-name') + 1] || args[2];
                    if (!tableName) {
                      const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --table-name is required', timestamp: Date.now() };
                      resolve(JSON.stringify(output, null, 2));
                      return;
                    }
                    const res = await dynamodb.scan({ TableName: tableName }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }
              }

              // Lambda: function operations
              if (service === 'lambda') {
                const lambda = new AWS.Lambda({ credentials: awsCredentials, region: this.credentials.region });

                if (action === 'list-functions') {
                  try {
                    const res = await lambda.listFunctions().promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'get-function') {
                  try {
                    const functionName = args[args.indexOf('--function-name') + 1] || args[2];
                    if (!functionName) {
                      const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --function-name is required', timestamp: Date.now() };
                      resolve(JSON.stringify(output, null, 2));
                      return;
                    }
                    const res = await lambda.getFunction({ FunctionName: functionName }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'get-function-configuration') {
                  try {
                    const functionName = args[args.indexOf('--function-name') + 1] || args[2];
                    if (!functionName) {
                      const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --function-name is required', timestamp: Date.now() };
                      resolve(JSON.stringify(output, null, 2));
                      return;
                    }
                    const res = await lambda.getFunctionConfiguration({ FunctionName: functionName }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'list-layers') {
                  try {
                    const res = await lambda.listLayers().promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }
              }

              // CloudTrail: audit trail operations
              if (service === 'cloudtrail') {
                const cloudtrail = new AWS.CloudTrail({ credentials: awsCredentials, region: this.credentials.region });

                if (action === 'lookup-events') {
                  try {
                    const res = await cloudtrail.lookupEvents({}).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'describe-trails') {
                  try {
                    const res = await cloudtrail.describeTrails({}).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'get-trail-status') {
                  try {
                    const trailName = args[args.indexOf('--name') + 1] || args[2];
                    if (!trailName) {
                      const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --name is required', timestamp: Date.now() };
                      resolve(JSON.stringify(output, null, 2));
                      return;
                    }
                    const res = await cloudtrail.getTrailStatus({ Name: trailName }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }
              }

              // SSM: additional operations beyond describe-instance-information and describe-sessions
              if (service === 'ssm') {
                const ssm = new AWS.SSM({ credentials: awsCredentials, region: this.credentials.region });

                if (action === 'list-command-invocations') {
                  try {
                    const res = await ssm.listCommandInvocations({}).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }

                if (action === 'get-command-invocation') {
                  try {
                    const commandId = args[args.indexOf('--command-id') + 1] || args[2];
                    const instanceId = args[args.indexOf('--instance-id') + 1] || args[4];
                    if (!commandId || !instanceId) {
                      const output = { command, exitCode: 1, stdout: '', stderr: 'Error: --command-id and --instance-id are required', timestamp: Date.now() };
                      resolve(JSON.stringify(output, null, 2));
                      return;
                    }
                    const res = await ssm.getCommandInvocation({ CommandId: commandId, InstanceId: instanceId }).promise();
                    const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  } catch (err: any) {
                    const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                    resolve(JSON.stringify(output, null, 2));
                  }
                  return;
                }
              }

              // Unsupported aws subcommand - return helpful error
              const output = {
                command,
                exitCode: 127,
                stdout: '',
                stderr: `aws command '${service} ${action}' is not supported in this environment. Install AWS CLI in the image or use the backend SDK.`,
                timestamp: Date.now(),
              };
              console.log(
                `[Terminal:${this.sessionId}] Command not supported: ${service} ${action}`
              );
              resolve(JSON.stringify(output, null, 2));
            } catch (err: any) {
              const errorMessage = err?.message ? err.message : String(err);
              const errorCode = err?.code || "UnknownError";

              console.error(
                `[Terminal:${this.sessionId}] AWS SDK call failed (${errorCode}): ${errorMessage}`
              );

              const output = {
                command,
                exitCode: 2,
                stdout: '',
                stderr: this.getErrorMessage(err),
                timestamp: Date.now(),
              };
              resolve(JSON.stringify(output, null, 2));
            }
          })();
          return;
        }

        // Execute command (with timeout)
        const child = spawn(cmd, args, {
          env,
          timeout: 30000, // 30 second timeout
          shell: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          this.isExecuting = false;

          const output = {
            command,
            exitCode: code,
            stdout,
            stderr,
            timestamp: Date.now(),
          };

          console.log(
            `[Terminal:${this.sessionId}] Command completed with code ${code}`
          );

          resolve(JSON.stringify(output, null, 2));
        });

        child.on("error", (error) => {
          this.isExecuting = false;
          console.error(
            `[Terminal:${this.sessionId}] Command error:`,
            error
          );
          reject(error);
        });
      } catch (error) {
        this.isExecuting = false;
        reject(error);
      }
    });
  }

  /**
   * Get helpful error message from AWS errors
   */
  private getErrorMessage(error: any): string {
    if (!error) return "Unknown error";

    const message = error?.message || String(error);
    const code = error?.code || "";

    // Handle expired token errors specifically
    if (code === "ExpiredToken" || code === "ExpiredTokenException" || message?.includes("ExpiredToken")) {
      return (
        "AWS session credentials have expired. " +
        "Your temporary session token is no longer valid. " +
        "Please refresh your credentials or start a new lab session."
      );
    }

    // Map AWS error codes to helpful messages
    if (
      code === "InvalidClientTokenId" ||
      message?.includes("security token")
    ) {
      return (
        "Invalid AWS Access Key ID: The security token included in the request is invalid. " +
        "Please verify your AWS access key ID and secret access key are correct. " +
        "If you recently created the credentials, they may take a few minutes to become active."
      );
    }

    if (code === "SignatureDoesNotMatch") {
      return (
        "Invalid AWS Secret Access Key: The request signature does not match. " +
        "This usually means your AWS secret access key is incorrect. " +
        "Please double-check the secret access key and try again."
      );
    }

    if (code === "AccessDenied" || code === "UnauthorizedOperation") {
      return (
        `Access Denied: ${message}. ` +
        "This user may not have permission for this operation. " +
        "Please check the IAM user's permissions."
      );
    }

    if (code === "InvalidParameterValue" || code === "InvalidParameterCombination") {
      return `Invalid parameter: ${message}`;
    }

    if (code === "NoSuchEntity") {
      return `Resource not found: ${message}. The IAM user or resource you're looking for does not exist.`;
    }

    if (code === "EntityAlreadyExists") {
      return `Resource already exists: ${message}. You may need to use a different name or delete the existing resource first.`;
    }

    // Return original message if it's helpful, otherwise generic message
    return message || "AWS API call failed";
  }

  /**
   * Resize terminal (for future PTY implementation)
   */
  resize(cols: number, rows: number): void {
    console.log(`[Terminal:${this.sessionId}] Resized to ${cols}x${rows}`);
    // PTY resizing would go here
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return this.commandHistory;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }
}

export class TerminalServer {
  private terminals: Map<string, TerminalInstance> = new Map();

  /**
   * Create a new terminal instance
   */
  createTerminal(sessionId: string, credentials: AWSCredentials): TerminalInstance {
    const terminal = new TerminalInstance(sessionId, credentials);
    this.terminals.set(sessionId, terminal);
    console.log(`[TerminalServer] Terminal created: ${sessionId}`);
    return terminal;
  }

  /**
   * Get terminal instance
   */
  getTerminal(sessionId: string): TerminalInstance | undefined {
    return this.terminals.get(sessionId);
  }

  /**
   * Destroy terminal instance
   */
  destroyTerminal(sessionId: string): void {
    this.terminals.delete(sessionId);
    console.log(`[TerminalServer] Terminal destroyed: ${sessionId}`);
  }

  /**
   * Get all active terminals
   */
  getActiveSessions(): string[] {
    return Array.from(this.terminals.keys());
  }
}
