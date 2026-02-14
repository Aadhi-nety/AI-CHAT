import axios, { AxiosInstance } from "axios";

export interface CyberangeTokenValidationResponse {
  valid: boolean;
  userId: string;
  email: string;
  labId: string;
  expiresAt: number;
  purchaseId: string;
}

export interface CyberangePurchaseDetails {
  purchaseId: string;
  userId: string;
  labId: string;
  labName: string;
  purchasedAt: number;
  expiresAt: number;
}

export class CyberangeService {
  private apiClient: AxiosInstance;
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.CYBERANGE_API_URL || "";
    this.apiKey = process.env.CYBERANGE_API_KEY || "";

    this.apiClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
  }

  /**
   * Validate JWT token from Cyberange
   */
  async validateToken(token: string): Promise<CyberangeTokenValidationResponse> {
    if (!this.apiUrl) {
      // For local testing without Cyberange API, return mock valid response
      console.warn("[CyberangeService] CYBERANGE_API_URL not set, using mock validation for local testing");
      return {
        valid: true,
        userId: "test-user",
        email: "test@example.com",
        labId: "test-lab",
        expiresAt: Date.now() + 3600000, // 1 hour from now
        purchaseId: "test-purchase"
      };
    }
    try {
      const response = await this.apiClient.post<CyberangeTokenValidationResponse>(
        "/api/validate-token",
        { token }
      );
      return response.data;
    } catch (error) {
      console.error("[CyberangeService] Token validation failed:", error);
      throw new Error("Failed to validate token with Cyberange");
    }
  }

  /**
   * Get purchase details for a user
   */
  async getPurchaseDetails(
    purchaseId: string
  ): Promise<CyberangePurchaseDetails> {
    if (!this.apiUrl) {
      throw new Error("CYBERANGE_API_URL environment variable is not set");
    }
    try {
      const response = await this.apiClient.get<CyberangePurchaseDetails>(
        `/api/purchases/${purchaseId}`
      );
      return response.data;
    } catch (error) {
      console.error(
        "[CyberangeService] Failed to get purchase details:",
        error
      );
      throw new Error("Failed to get purchase details");
    }
  }

  /**
   * Notify Cyberange that lab session started
   */
  async notifyLabStarted(
    purchaseId: string,
    sessionId: string
  ): Promise<void> {
    if (!this.apiUrl) {
      console.warn("[CyberangeService] CYBERANGE_API_URL not set, skipping lab start notification");
      return;
    }
    try {
      await this.apiClient.post("/api/sessions/start", {
        purchaseId,
        sessionId,
        startedAt: Date.now(),
      });
    } catch (error) {
      console.error("[CyberangeService] Failed to notify lab start:", error);
      // Non-blocking error
    }
  }

  /**
   * Notify Cyberange that lab session ended
   */
  async notifyLabEnded(
    purchaseId: string,
    sessionId: string,
    duration: number
  ): Promise<void> {
    if (!this.apiUrl) {
      console.warn("[CyberangeService] CYBERANGE_API_URL not set, skipping lab end notification");
      return;
    }
    try {
      await this.apiClient.post("/api/sessions/end", {
        purchaseId,
        sessionId,
        endedAt: Date.now(),
        durationSeconds: duration,
      });
    } catch (error) {
      console.error("[CyberangeService] Failed to notify lab end:", error);
      // Non-blocking error
    }
  }
}

export default new CyberangeService();
