import { spawn } from "child_process";
import AWS from "aws-sdk";
import { PassThrough } from "stream";

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export class TerminalInstance {
  private sessionId: string;
  private credentials: AWSCredentials;
  private commandHistory: string[] = [];
  private isExecuting = false;
  private credentialsValidated = false;

  constructor(sessionId: string, credentials: AWSCredentials) {
    this.sessionId = sessionId;
    this.credentials = credentials;
  }

  /**
   * Validate AWS credentials by calling sts:GetCallerIdentity
   */
  private async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check for required credential fields
      if (!this.credentials.accessKeyId) {
        return {
          valid: false,
          error: "AWS Access Key ID is missing. Please provide valid credentials.",
        };
      }

      if (!this.credentials.secretAccessKey) {
        return {
          valid: false,
          error: "AWS Secret Access Key is missing. Please provide valid credentials.",
        };
      }

      if (!this.credentials.region) {
        return {
          valid: false,
          error: "AWS Region is missing. Please provide a valid region.",
        };
      }

      const sts = new AWS.STS({
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
        region: this.credentials.region,
      });

      // Log masked credentials for debugging
      const maskedKey = this.credentials.accessKeyId
        ? this.credentials.accessKeyId.substring(0, 4) +
          "*".repeat(Math.max(0, this.credentials.accessKeyId.length - 8)) +
          this.credentials.accessKeyId.substring(
            Math.max(0, this.credentials.accessKeyId.length - 4)
          )
        : "undefined";

      console.log(
        `[Terminal:${this.sessionId}] Validating AWS credentials... (Key: ${maskedKey}, Region: ${this.credentials.region})`
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
        errorCode === "InvalidClientTokenId" ||
        errorCode === "SignatureDoesNotMatch";

      if (isInvalidToken) {
        console.error(
          `[Terminal:${this.sessionId}] This is a credential authentication error - the keys provided are not valid AWS credentials`
        );
        return {
          valid: false,
          error: "AWS credentials are invalid or expired. Please verify your access key ID and secret access key.",
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
        // Environment setup with AWS credentials
        const env = {
          ...process.env,
          AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
          AWS_DEFAULT_REGION: this.credentials.region,
          AWS_REGION: this.credentials.region,
        };

        // Parse command
        const [cmd, ...args] = command.trim().split(/\s+/);

        console.log(`[Terminal:${this.sessionId}] Executing: ${command}`);
        console.log(
          `[Terminal:${this.sessionId}] Environment: Region=${this.credentials.region}, KeyId=${
            this.credentials.accessKeyId
              ? this.credentials.accessKeyId.substring(0, 4) + "****"
              : "undefined"
          }`
        );

        // If user invoked the `aws` CLI but the binary is not available in the image,
        // handle common AWS calls via the AWS SDK so the terminal still works.
        if (cmd === 'aws') {
          (async () => {
            try {
              const awsCredentials = {
                accessKeyId: this.credentials.accessKeyId,
                secretAccessKey: this.credentials.secretAccessKey,
                region: this.credentials.region,
              };

              const service = args[0];
              const action = args[1];

              // Validate credentials only on first AWS command (lazy validation)
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

              // Handle SSM commands commonly used by labs
              if (service === 'ssm' && action === 'describe-instance-information') {
                const ssm = new AWS.SSM(awsCredentials);
                try {
                  const res = await ssm.describeInstanceInformation({ MaxResults: 10 }).promise();
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

              if (service === 'ssm' && action === 'describe-sessions') {
                const ssm = new AWS.SSM(awsCredentials);

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

                const params: any = { MaxResults: 10 };
                if (filters) params.Filters = filters;

                try {
                  const res = await ssm.describeSessions(params).promise();
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

              // STS: get-caller-identity
              if (service === 'sts' && action === 'get-caller-identity') {
                const sts = new AWS.STS(awsCredentials);
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
                const s3 = new AWS.S3(awsCredentials);
                // `aws s3 ls` with no further args lists buckets
                if (args.length === 2) {
                  try {
                    const res = await s3.listBuckets().promise();
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

                // `aws s3 ls s3://bucket` -> list objects
                const target = args[1] || '';
                if (target.startsWith('s3://')) {
                  const bucket = target.replace('s3://', '').replace(/\/.*/,'');
                  try {
                    const res = await s3.listObjectsV2({ Bucket: bucket }).promise();
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
              }

              // s3api list-buckets
              if (service === 's3api' && action === 'list-buckets') {
                const s3 = new AWS.S3(awsCredentials);
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
                const ec2 = new AWS.EC2(awsCredentials);
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
                const iam = new AWS.IAM(awsCredentials);

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
                const s3 = new AWS.S3(awsCredentials);

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
                  // simplistic: expect --bucket BUCKET and --policy file://policy.json (we won't read files)
                  const bucket = args.find((a, i) => a === '--bucket') ? args[args.indexOf('--bucket') + 1] : undefined;
                  // Can't read local files from browser terminal; return helpful message
                  const output = { command, exitCode: 1, stdout: '', stderr: 'put-bucket-policy with local file is not supported in this terminal. Use the SDK or provide policy JSON via API.', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }

                if (action === 'put-public-access-block') {
                  const bucket = args[args.indexOf('--bucket') + 1];
                  // parse configuration string like --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true
                  const configArg = args.find(a => a.startsWith('--public-access-block-configuration')) || '';
                  // naive parse
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
                const org = new AWS.Organizations(awsCredentials);
                try {
                  const res = await org.listAccounts().promise();
                  const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                } catch (err: any) {
                  const output = { command, exitCode: 2, stdout: '', stderr: this.getErrorMessage(err), timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                }
                return;
              }

              // DynamoDB: table operations
              if (service === 'dynamodb') {
                const dynamodb = new AWS.DynamoDB(awsCredentials);

                if (action === 'list-tables') {
                  try {
                    const res = await dynamodb.listTables({ Limit: 10 }).promise();
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
                const lambda = new AWS.Lambda(awsCredentials);

                if (action === 'list-functions') {
                  try {
                    const res = await lambda.listFunctions({ MaxItems: 10 }).promise();
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
                    const res = await lambda.listLayers({ MaxItems: 10 }).promise();
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
                const cloudtrail = new AWS.CloudTrail(awsCredentials);

                if (action === 'lookup-events') {
                  try {
                    const res = await cloudtrail.lookupEvents({ MaxResults: 10 }).promise();
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
                const ssm = new AWS.SSM(awsCredentials);

                if (action === 'list-command-invocations') {
                  try {
                    const res = await ssm.listCommandInvocations({ MaxResults: 10 }).promise();
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
