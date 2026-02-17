// API Base URL for production - set via environment variable in Vercel
// trim whitespace just in case the value was entered with extra space
let API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
if (API_BASE && API_BASE.trim() !== API_BASE) {
  console.warn("NEXT_PUBLIC_API_URL contains extra whitespace, trimming");
  API_BASE = API_BASE.trim();
}

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
    this.baseUrl = API_BASE || "";
  }

  /**
   * Ensure that the base URL has been configured before making requests.
   * Throws a clear error that can be surfaced in production if the
   * environment variable was not set properly (e.g. on Vercel).
   */
  private ensureBaseUrl() {
    if (!this.baseUrl) {
      throw new Error(
        "API base URL is not configured. Please set NEXT_PUBLIC_API_URL in Vercel."
      );
    }
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
    this.ensureBaseUrl();

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
    this.ensureBaseUrl();

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
    this.ensureBaseUrl();

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
    this.ensureBaseUrl();

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
   * Validate session without establishing WebSocket connection
   */
  async validateSession(sessionId: string): Promise<boolean> {
    this.ensureBaseUrl();

    try {
      const response = await fetch(
        `${this.baseUrl}/api/labs/session/${sessionId}/validate`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.warn(`[APIClient] Session validation failed: ${response.status}`);
        return false;
      }

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error("[APIClient] Error validating session:", error);
      return false;
    }
  }

  /**
   * Get WebSocket URL for terminal
   */
  getTerminalUrl(sessionId: string): string {
    this.ensureBaseUrl();

    // Validate sessionId format
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error("Invalid sessionId: must be a non-empty string");
    }

    const protocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
    const url = this.baseUrl.replace("https://", "").replace("http://", "");
    const wsUrl = `${protocol}://${url}/terminal/${sessionId}`;
    
    // Validate URL format
    try {
      new URL(wsUrl);
    } catch (e) {
      throw new Error(`Invalid WebSocket URL generated: ${wsUrl}`);
    }
    
    return wsUrl;
  }
}

export const apiClient = new APIClient();
