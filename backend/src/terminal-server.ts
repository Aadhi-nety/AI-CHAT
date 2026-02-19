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

  constructor(sessionId: string, credentials: AWSCredentials) {
    this.sessionId = sessionId;
    this.credentials = credentials;
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

              // Handle SSM commands commonly used by labs
              if (service === 'ssm' && action === 'describe-instance-information') {
                const ssm = new AWS.SSM(awsCredentials);
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
                const sts = new AWS.STS(awsCredentials);
                const res = await sts.getCallerIdentity().promise();
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

              // S3: simple `aws s3 ls` and `aws s3 ls s3://bucket`
              if (service === 's3' && action === 'ls') {
                const s3 = new AWS.S3(awsCredentials);
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
                const res = await ec2.describeInstances().promise();
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

              // IAM: common queries
              if (service === 'iam') {
                const iam = new AWS.IAM(awsCredentials);

                if (action === 'list-users') {
                  const res = await iam.listUsers().promise();
                  const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
                  return;
                }

                if (action === 'get-user') {
                  // next arg may be --user-name or the username directly
                  let userName = args[1] || '';
                  if (userName === '--user-name') userName = args[2] || '';
                  const res = await iam.getUser({ UserName: userName || undefined }).promise();
                  const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                  resolve(JSON.stringify(output, null, 2));
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
                const res = await org.listAccounts().promise();
                const output = { command, exitCode: 0, stdout: JSON.stringify(res, null, 2), stderr: '', timestamp: Date.now() };
                resolve(JSON.stringify(output, null, 2));
                return;
              }

              // Unsupported aws subcommand - return helpful error
              const output = {
                command,
                exitCode: 127,
                stdout: '',
                stderr: `aws command '${service} ${action}' is not supported in this environment. Install AWS CLI in the image or use the backend SDK.`,
                timestamp: Date.now(),
              };
              resolve(JSON.stringify(output, null, 2));
            } catch (err: any) {
              const output = {
                command,
                exitCode: 2,
                stdout: '',
                stderr: (err && err.message) ? err.message : String(err),
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
