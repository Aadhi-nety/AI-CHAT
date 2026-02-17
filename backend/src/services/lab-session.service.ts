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
  createdAt: number;
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

      // Generate proper WebSocket URL based on environment
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
      const wsProtocol = backendUrl.startsWith("https") ? "wss" : "ws";
      const wsHost = backendUrl.replace(/^https?:\/\//, "");
      const webSocketUrl = `${wsProtocol}://${wsHost}/terminal/${sessionId}`;

      const session: LabSession = {
        sessionId,
        userId,
        labId,
        purchaseId,
        sandboxAccount,
        startedAt,
        createdAt: Date.now(),
        expiresAt,
        status: "active",
        terminalPort: 3100 + Math.floor(Math.random() * 900),
        webSocketUrl,
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
   * Get active session with grace period for newly created sessions
   */
  getSession(sessionId: string): LabSession | undefined {
    const session = this.activeSessions.get(sessionId);
    const now = Date.now();
    const GRACE_PERIOD_MS = 10000; // 10 second grace period for session initialization

    if (!session) {
      console.warn(`[LabSession] Session not found: ${sessionId}. Active sessions: ${this.getActiveSessionIds().join(", ") || "none"}`);
      console.warn(`[LabSession] Total active sessions count: ${this.activeSessions.size}`);
      return undefined;
    }

    // Allow sessions in grace period even if status is not yet "active"
    const isInGracePeriod = session.createdAt && (now - session.createdAt) < GRACE_PERIOD_MS;
    
    if (session.status !== "active" && !isInGracePeriod) {
      console.warn(`[LabSession] Session ${sessionId} is not active (status: ${session.status}, created: ${new Date(session.startedAt).toISOString()}, gracePeriod: ${isInGracePeriod})`);
      return undefined;
    }

    if (now > session.expiresAt) {
      console.warn(`[LabSession] Session ${sessionId} has expired. Now: ${new Date(now).toISOString()}, ExpiresAt: ${new Date(session.expiresAt).toISOString()}, diff: ${now - session.expiresAt}ms`);
      session.status = "expired";
      return undefined;
    }

    // Auto-activate sessions in grace period
    if (isInGracePeriod && session.status !== "active") {
      console.log(`[LabSession] Auto-activating session ${sessionId} (in grace period)`);
      session.status = "active";
    }

    console.log(`[LabSession] Session ${sessionId} validated successfully. Lab: ${session.labId}, expires in ${Math.floor((session.expiresAt - now) / 1000)}s, age: ${now - session.createdAt}ms`);
    return session;
  }

  /**
   * Get list of active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.activeSessions.entries())
      .filter(([_, session]) => session.status === "active" && Date.now() <= session.expiresAt)
      .map(([sessionId, _]) => sessionId);
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
