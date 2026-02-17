import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

/**
 * Redis Service for shared session storage across multiple backend instances
 * Uses Upstash Redis (serverless external Redis) - compatible with AWS App Runner
 * No VPC configuration required
 */
export class RedisService {
  private client: Redis | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 10;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      const errorMsg = "[Redis] CRITICAL: REDIS_URL environment variable is not set. " +
        "Please set REDIS_URL=redis://default:password@your-upstash-endpoint:6379";
      console.error(errorMsg);
      throw new Error("REDIS_URL is required for production session storage");
    }

    try {
      console.log(`[Redis] Initializing connection to Upstash Redis...`);
      console.log(`[Redis] URL format check: ${redisUrl.startsWith('redis://') ? 'valid' : 'invalid'}`);

      // Parse URL for logging (mask password)
      const urlObj = new URL(redisUrl);
      const maskedUrl = `redis://${urlObj.username}:****@${urlObj.hostname}:${urlObj.port}`;
      console.log(`[Redis] Connecting to: ${maskedUrl}`);

      this.client = new Redis(redisUrl, {
        retryStrategy: (times: number) => {
          this.connectionAttempts++;
          const delay = Math.min(times * 100, 3000);
          console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times}, total attempts: ${this.connectionAttempts})`);
          
          if (this.connectionAttempts > this.maxConnectionAttempts) {
            console.error(`[Redis] Max connection attempts (${this.maxConnectionAttempts}) reached. Giving up.`);
            return null; // Stop retrying
          }
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        // Upstash specific settings
        tls: redisUrl.includes('upstash') ? {} : undefined, // Enable TLS for Upstash
        connectTimeout: 10000, // 10 second connection timeout
        commandTimeout: 5000, // 5 second command timeout
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error("[Redis] Failed to initialize client:", error);
      throw error; // Fail fast in production - no in-memory fallback
    }
  }


  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on("connect", () => {
      console.log("[Redis] Connected successfully to Upstash");
      this.isConnected = true;
      this.connectionAttempts = 0; // Reset on successful connection
    });

    this.client.on("ready", () => {
      console.log("[Redis] Client ready - session storage operational");
      this.isConnected = true;
    });

    this.client.on("error", (error: Error) => {
      console.error("[Redis] Error:", error.message);
      console.error("[Redis] Error stack:", error.stack);
      this.isConnected = false;
    });

    this.client.on("close", () => {
      console.log("[Redis] Connection closed");
      this.isConnected = false;
    });

    this.client.on("reconnecting", () => {
      console.log("[Redis] Reconnecting to Upstash...");
    });

    this.client.on("end", () => {
      console.log("[Redis] Connection ended permanently");
      this.isConnected = false;
    });
  }


  /**
   * Get Redis client instance
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client?.status === "ready";
  }

  /**
   * Store session data with TTL
   */
  async setSession(
    sessionId: string,
    data: unknown,
    ttlSeconds: number = 7200
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized - check REDIS_URL");
    }

    if (!this.isReady()) {
      console.warn("[Redis] Client not ready, attempting operation anyway...");
    }

    const key = `session:${sessionId}`;
    const serialized = JSON.stringify(data);

    try {
      await this.client.setex(key, ttlSeconds, serialized);
      console.log(`[Redis] Session stored: ${sessionId} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      console.error(`[Redis] Failed to store session ${sessionId}:`, error);
      throw error; // Fail fast - session must be stored
    }
  }


  /**
   * Retrieve session data
   */
  async getSession(sessionId: string): Promise<unknown | null> {
    if (!this.client) {
      console.error("[Redis] Client not initialized - cannot retrieve session");
      throw new Error("Redis client not available");
    }

    const key = `session:${sessionId}`;

    try {
      const data = await this.client.get(key);

      if (!data) {
        console.log(`[Redis] Session not found: ${sessionId}`);
        return null;
      }

      try {
        const parsed = JSON.parse(data);
        console.log(`[Redis] Session retrieved: ${sessionId}`);
        return parsed;
      } catch (parseError) {
        console.error(`[Redis] Failed to parse session ${sessionId}:`, parseError);
        // Delete corrupted data
        await this.client.del(key);
        return null;
      }
    } catch (error) {
      console.error(`[Redis] Error retrieving session ${sessionId}:`, error);
      throw error; // Propagate error for proper handling
    }
  }


  /**
   * Delete session data
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }

    const key = `session:${sessionId}`;

    try {
      await this.client.del(key);
      console.log(`[Redis] Session deleted: ${sessionId}`);
    } catch (error) {
      console.error(`[Redis] Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }


  /**
   * Update session TTL (extend expiry)
   */
  async extendSessionTTL(
    sessionId: string,
    additionalSeconds: number
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }

    const key = `session:${sessionId}`;

    try {
      const ttl = await this.client.ttl(key);

      if (ttl > 0) {
        const newTtl = ttl + additionalSeconds;
        await this.client.expire(key, newTtl);
        console.log(`[Redis] Session ${sessionId} TTL extended to ${newTtl}s`);
      } else {
        console.warn(`[Redis] Cannot extend TTL for ${sessionId} - key does not exist or expired`);
      }
    } catch (error) {
      console.error(`[Redis] Failed to extend TTL for ${sessionId}:`, error);
      throw error;
    }
  }


  /**
   * Get all active session IDs (for debugging)
   */
  async getAllSessionIds(): Promise<string[]> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }

    try {
      const keys = await this.client.keys("session:*");
      return keys.map((key: string) => key.replace("session:", ""));
    } catch (error) {
      console.error("[Redis] Failed to get all session IDs:", error);
      throw error;
    }
  }


  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; connected: boolean; details?: string }> {
    try {
      if (!this.client) {
        return { status: "not_initialized", connected: false, details: "Redis client is null" };
      }

      if (!this.isConnected) {
        return { status: "disconnected", connected: false, details: "Redis client not connected" };
      }

      const pong = await this.client.ping();
      if (pong === "PONG") {
        return { status: "ok", connected: true, details: "Upstash Redis responding" };
      } else {
        return { status: "error", connected: false, details: `Unexpected ping response: ${pong}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        connected: false,
        details: errorMsg,
      };
    }
  }


  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        console.log("[Redis] Disconnected gracefully from Upstash");
      } catch (error) {
        console.error("[Redis] Error during disconnect:", error);
      }
    }
  }

}

// Export singleton instance
export const redisService = new RedisService();
export default redisService;
