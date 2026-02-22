import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// In-memory storage for sessions (primary storage - no external dependencies)
const inMemorySessions = new Map<string, { data: unknown; expiry: number }>();

/**
 * Session Storage Service
 * Uses in-memory storage by default - no external Redis required
 * 
 * Alternative options (if Redis is needed later):
 * - Upstash: https://upstash.com
 * - Redis Cloud: https://redis.com/cloud/
 * - AWS ElastiCache: https://aws.amazon.com/elasticache/
 * - Self-hosted Redis with Docker
 */
export class RedisService {
  private client: Redis | null = null;
  private isConnected = false;
  private useInMemory = true; // Default to in-memory storage

  constructor() {
    // Always use in-memory storage by default
    // To enable Redis, set USE_REDIS=true and provide REDIS_URL
    this.initializeStorage();
  }

  private initializeStorage(): void {
    const useRedis = process.env.USE_REDIS === 'true';
    const redisUrl = process.env.REDIS_URL;

    if (!useRedis) {
      console.log("[Redis] Using in-memory session storage (no external dependencies)");
      this.useInMemory = true;
      this.client = null;
      return;
    }

    // If Redis is explicitly enabled, try to connect
    if (redisUrl) {
      this.initializeRedisClient(redisUrl);
    } else {
      console.warn("[Redis] USE_REDIS=true but REDIS_URL not set - using in-memory storage");
      this.useInMemory = true;
    }
  }

  private initializeRedisClient(redisUrl: string): void {
    try {
      console.log(`[Redis] Initializing Redis connection...`);

      const useTls = redisUrl.startsWith('rediss://');

      this.client = new Redis(redisUrl, {
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 100, 3000);
          console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
          
          if (times > 5) {
            console.warn("[Redis] Max retries reached, falling back to in-memory");
            this.useInMemory = true;
            return null;
          }
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        tls: useTls ? { rejectUnauthorized: true } : undefined,
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error("[Redis] Failed to initialize:", error);
      this.useInMemory = true;
      this.client = null;
    }
  }



  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on("connect", () => {
      console.log("[Redis] Connected successfully to Upstash");
      this.isConnected = true;
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
    // Use in-memory fallback if Redis is not available
    if (this.useInMemory || !this.client) {
      const expiry = Date.now() + (ttlSeconds * 1000);
      inMemorySessions.set(sessionId, { data, expiry });
      console.log(`[Redis] In-memory session stored: ${sessionId} (TTL: ${ttlSeconds}s)`);
      return;
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
      // Fall back to in-memory storage
      const expiry = Date.now() + (ttlSeconds * 1000);
      inMemorySessions.set(sessionId, { data, expiry });
      console.log(`[Redis] Fallback: In-memory session stored: ${sessionId}`);
    }
  }


  /**
   * Retrieve session data
   */
  async getSession(sessionId: string): Promise<unknown | null> {
    // Use in-memory fallback if Redis is not available
    if (this.useInMemory || !this.client) {
      const session = inMemorySessions.get(sessionId);
      if (!session) {
        console.log(`[Redis] In-memory session not found: ${sessionId}`);
        return null;
      }
      // Check if expired
      if (Date.now() > session.expiry) {
        inMemorySessions.delete(sessionId);
        console.log(`[Redis] In-memory session expired: ${sessionId}`);
        return null;
      }
      console.log(`[Redis] In-memory session retrieved: ${sessionId}`);
      return session.data;
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
      // Try in-memory fallback
      const session = inMemorySessions.get(sessionId);
      if (session) {
        if (Date.now() > session.expiry) {
          inMemorySessions.delete(sessionId);
          return null;
        }
        console.log(`[Redis] Fallback: In-memory session retrieved: ${sessionId}`);
        return session.data;
      }
      return null;
    }
  }


  /**
   * Delete session data
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Use in-memory fallback if Redis is not available
    if (this.useInMemory || !this.client) {
      inMemorySessions.delete(sessionId);
      console.log(`[Redis] In-memory session deleted: ${sessionId}`);
      return;
    }

    const key = `session:${sessionId}`;

    try {
      await this.client.del(key);
      console.log(`[Redis] Session deleted: ${sessionId}`);
    } catch (error) {
      console.error(`[Redis] Failed to delete session ${sessionId}:`, error);
      // Also delete from in-memory
      inMemorySessions.delete(sessionId);
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
    // Use in-memory fallback if Redis is not available
    if (this.useInMemory || !this.client) {
      const now = Date.now();
      const validIds: string[] = [];
      for (const [sessionId, session] of inMemorySessions.entries()) {
        if (session.expiry > now) {
          validIds.push(sessionId);
        } else {
          inMemorySessions.delete(sessionId);
        }
      }
      return validIds;
    }

    try {
      const keys = await this.client.keys("session:*");
      return keys.map((key: string) => key.replace("session:", ""));
    } catch (error) {
      console.error("[Redis] Failed to get all session IDs:", error);
      // Return in-memory sessions
      const now = Date.now();
      const validIds: string[] = [];
      for (const [sessionId, session] of inMemorySessions.entries()) {
        if (session.expiry > now) {
          validIds.push(sessionId);
        }
      }
      return validIds;
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
