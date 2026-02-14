const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface LabStartResponse {
  success: boolean;
  session: {
    sessionId: string;
    webSocketUrl: string;
    expiresAt: number;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };
  };
}

export interface LabSession {
  sessionId: string;
  labId: string;
  status: "active" | "expired" | "destroyed";
  expiresAt: number;
  credentials: {
    accessKeyId: string;
    region: string;
  };
}

export interface TerminalCommand {
  type: "command" | "resize";
  command?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalResponse {
  type: "connected" | "output" | "error";
  message?: string;
  data?: string;
  timestamp?: number;
  credentials?: {
    region: string;
  };
}

class APIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BACKEND_URL;
  }

  /**
   * Start a lab session
   */
  async startLab(
    userId: string,
    labId: string,
    purchaseId: string,
    token: string
  ): Promise<LabStartResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/labs/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          labId,
          purchaseId,
          token,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start lab");
      }

      return await response.json();
    } catch (error) {
      console.error("[APIClient] Error starting lab:", error);
      throw error;
    }
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<LabSession> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/labs/session/${sessionId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get session");
      }

      return await response.json();
    } catch (error) {
      console.error("[APIClient] Error getting session:", error);
      throw error;
    }
  }

  /**
   * Extend session time
   */
  async extendSession(
    sessionId: string,
    minutes: number = 30
  ): Promise<{ newExpiresAt: number }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/labs/session/${sessionId}/extend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ minutes }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extend session");
      }

      return await response.json();
    } catch (error) {
      console.error("[APIClient] Error extending session:", error);
      throw error;
    }
  }

  /**
   * End a lab session
   */
  async endSession(sessionId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/labs/session/${sessionId}/end`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to end session");
      }

      return await response.json();
    } catch (error) {
      console.error("[APIClient] Error ending session:", error);
      throw error;
    }
  }

  /**
   * Get WebSocket URL for terminal
   */
  getTerminalUrl(sessionId: string): string {
    const protocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
    const url = this.baseUrl.replace("https://", "").replace("http://", "");
    return `${protocol}://${url}/terminal/${sessionId}`;
  }
}

export const apiClient = new APIClient();
