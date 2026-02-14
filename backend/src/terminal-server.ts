import { spawn } from "child_process";
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
