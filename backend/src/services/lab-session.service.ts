import { v4 as uuidv4 } from "uuid";
import awsControlTowerService, { SandboxAccount } from "./aws-control-tower.service";
import cyberangeService from "./cyberange.service";

export interface LabSession {
  sessionId: string;
  userId: string;
  labId: string;
  purchaseId: string;
  sandboxAccount: SandboxAccount;
  startedAt: number;
  expiresAt: number;
  status: "active" | "expired" | "destroyed";
  terminalPort: number;
  webSocketUrl: string;
}

export class LabSessionService {
  private activeSessions: Map<string, LabSession> = new Map();

  /**
   * Create a new lab session
   */
  async createSession(
    userId: string,
    labId: string,
    purchaseId: string,
    token: string
  ): Promise<LabSession> {
    try {
      console.log(
        `[LabSession] Creating session for user ${userId}, lab ${labId}`
      );

      // Verify token with Cyberange
      const validation = await cyberangeService.validateToken(token);

      if (!validation.valid) {
        throw new Error("Invalid token");
      }

      // Create sandbox AWS account
      const sandboxAccount = await awsControlTowerService.createSandboxAccount(
        userId,
        labId
      );

      const sessionId = uuidv4();
      const startedAt = Date.now();
      const expiresAt =
        startedAt + (parseInt(process.env.LAB_TIMEOUT_MINUTES || "120") * 60 * 1000);

      const session: LabSession = {
        sessionId,
        userId,
        labId,
        purchaseId,
        sandboxAccount,
        startedAt,
        expiresAt,
        status: "active",
        terminalPort: 3100 + Math.floor(Math.random() * 900),
      webSocketUrl: `ws://localhost:${process.env.PORT || 3002}/terminal/${sessionId}`,
      };

      // Store session
      this.activeSessions.set(sessionId, session);

      // Notify Cyberange
      await cyberangeService.notifyLabStarted(purchaseId, sessionId);

      // Set expiry timer
      this.setSessionExpiry(sessionId);

      console.log(`[LabSession] Session created: ${sessionId}, expiresAt: ${new Date(expiresAt).toISOString()}, now: ${new Date(startedAt).toISOString()}`);
      return session;
    } catch (error) {
      console.error("[LabSession] Failed to create session:", error);
      throw error;
    }
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): LabSession | undefined {
    const session = this.activeSessions.get(sessionId);
    const now = Date.now();

    if (!session) {
      console.warn(`[LabSession] Session not found: ${sessionId}. Active sessions: ${Array.from(this.activeSessions.keys()).join(", ")}`);
      return undefined;
    }

    if (session.status !== "active") {
      console.warn(`[LabSession] Session ${sessionId} is not active (status: ${session.status})`);
      return undefined;
    }

    if (now > session.expiresAt) {
      console.warn(`[LabSession] Session ${sessionId} has expired. Now: ${now}, ExpiresAt: ${session.expiresAt}`);
      session.status = "expired";
      return undefined;
    }

    return session;
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);

      if (!session) {
        console.warn(`[LabSession] Session not found: ${sessionId}`);
        return;
      }

      console.log(`[LabSession] Destroying session: ${sessionId}`);

      // Destroy AWS sandbox account
      await awsControlTowerService.destroySandboxAccount(
        session.sandboxAccount.accountId,
        session.sandboxAccount.iamUserName
      );

      // Notify Cyberange
      const duration = Math.floor((Date.now() - session.startedAt) / 1000);
      await cyberangeService.notifyLabEnded(
        session.purchaseId,
        sessionId,
        duration
      );

      session.status = "destroyed";
      this.activeSessions.delete(sessionId);

      console.log(`[LabSession] Session destroyed: ${sessionId}`);
    } catch (error) {
      console.error("[LabSession] Failed to destroy session:", error);
      throw error;
    }
  }

  /**
   * Set automatic session expiry
   */
  private setSessionExpiry(sessionId: string): void {
    const checkInterval = 60000; // Check every minute

    const timer = setInterval(async () => {
      const session = this.activeSessions.get(sessionId);

      if (!session) {
        clearInterval(timer);
        return;
      }

      if (Date.now() > session.expiresAt) {
        console.log(`[LabSession] Session expired: ${sessionId}`);
        await this.destroySession(sessionId);
        clearInterval(timer);
      }
    }, checkInterval);
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): LabSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (s) => s.userId === userId && s.status === "active"
    );
  }

  /**
   * Extend session expiry
   */
  extendSession(sessionId: string, additionalMinutes: number = 30): void {
    const session = this.activeSessions.get(sessionId);

    if (session && session.status === "active") {
      session.expiresAt += additionalMinutes * 60 * 1000;
      console.log(
        `[LabSession] Session extended: ${sessionId} (new expiry: ${new Date(
          session.expiresAt
        ).toISOString()})`
      );
    }
  }
}

export default new LabSessionService();
