/**
 * AWS App Runner Compatible WebSocket Server
 * 
 * This implementation uses native 'ws' library with manual upgrade handling
 * to properly work behind AWS App Runner's reverse proxy and load balancer.
 * 
 * Key features:
 * - HTTP server wrapper with explicit upgrade handling
 * - WebSocket.Server with noServer: true
 * - Proper ping/pong heartbeat (30s)
 * - AWS load balancer compatible (X-Forwarded-For, X-Forwarded-Proto)
 * - Graceful error handling for 1006 errors
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocket, Server as WebSocketServer } from "ws";
import http from "http";
import labSessionService from "./services/lab-session.service";
import { TerminalServer } from "./terminal-server";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Dynamic CORS configuration
const allowedOrigins: string[] = [
  "https://ai-chat-two-ecru.vercel.app",
  "https://ai-chat-eor90dxjd-aadhi-netys-projects.vercel.app",
  "https://ai-chat-op8a1ytr0-aadhi-netys-projects.vercel.app",
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001"
].filter((origin): origin is string => Boolean(origin));

// Enhanced CORS for WebSocket support
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "Upgrade", 
    "Connection", 
    "Sec-WebSocket-Key", 
    "Sec-WebSocket-Version", 
    "Sec-WebSocket-Extensions",
    "X-Forwarded-For",
    "X-Forwarded-Proto"
  ],
  exposedHeaders: ["Upgrade", "Connection"],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Initialize terminal server
const terminalServer = new TerminalServer();

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// WebSocket connection timeout (30 seconds)
const WS_CONNECTION_TIMEOUT = 30000;

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Health check endpoint for AWS App Runner
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: Date.now(),
    websocket: "available",
    endpoints: ["/terminal/:sessionId", "/ws-test"],
    port: PORT,
    environment: process.env.NODE_ENV || "development"
  });
});

// WebSocket diagnostics endpoint
app.get("/api/diagnostics/websocket", async (req, res) => {
  const activeSessions = await labSessionService.getActiveSessionIds();
  res.json({
    status: "ok",
    websocketEndpoints: [
      { path: "/terminal/:sessionId", description: "Terminal connection" },
      { path: "/ws-test", description: "WebSocket test endpoint" }
    ],
    supportedProtocols: ["ws", "wss"],
    corsOrigins: allowedOrigins,
    awsRegion: process.env.AWS_REGION || "ap-south-1",
    connectionTimeout: WS_CONNECTION_TIMEOUT,
    heartbeatInterval: HEARTBEAT_INTERVAL,
    timestamp: Date.now(),
    activeSessions: activeSessions || "N/A",
    serverInfo: {
      platform: "aws-app-runner",
      nodeVersion: process.version,
      port: PORT
    }
  });
});

// API Routes

/**
 * POST /api/labs/start
 * Start a lab session
 */
app.post("/api/labs/start", async (req, res) => {
  try {
    const { userId, labId, purchaseId, token } = req.body;

    if (!userId || !labId || !purchaseId || !token) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const session = await labSessionService.createSession(
      userId,
      labId,
      purchaseId,
      token
    );

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        webSocketUrl: session.webSocketUrl,
        expiresAt: session.expiresAt,
        credentials: {
          accessKeyId: session.sandboxAccount.iamAccessKeyId,
          secretAccessKey: session.sandboxAccount.iamSecretAccessKey,
          region: process.env.AWS_REGION || "us-east-1",
        },
      },
    });
  } catch (error) {
    console.error("[API] Error starting lab:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to start lab",
    });
  }
});

/**
 * GET /api/labs/session/:sessionId
 * Get session details
 */
app.get("/api/labs/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await labSessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found or expired" });
    }

    res.json({
      sessionId: session.sessionId,
      labId: session.labId,
      status: session.status,
      expiresAt: session.expiresAt,
      credentials: {
        accessKeyId: session.sandboxAccount.iamAccessKeyId,
        region: process.env.AWS_REGION || "us-east-1",
      },
    });
  } catch (error) {
    console.error("[API] Error getting session:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

/**
 * POST /api/labs/session/:sessionId/extend
 * Extend session time
 */
app.post("/api/labs/session/:sessionId/extend", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { minutes = 30 } = req.body;

    const session = await labSessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    await labSessionService.extendSession(sessionId, minutes);

    res.json({
      success: true,
      newExpiresAt: session.expiresAt + minutes * 60 * 1000,
    });
  } catch (error) {
    console.error("[API] Error extending session:", error);
    res.status(500).json({ error: "Failed to extend session" });
  }
});

/**
 * POST /api/labs/session/:sessionId/end
 * End a lab session
 */
app.post("/api/labs/session/:sessionId/end", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await labSessionService.destroySession(sessionId);

    res.json({ success: true, message: "Session ended" });
  } catch (error) {
    console.error("[API] Error ending session:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to end session",
    });
  }
});

/**
 * GET /api/labs/session/:sessionId/validate
 * Validate session without establishing WebSocket connection
 */
app.get("/api/labs/session/:sessionId/validate", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await labSessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        valid: false,
        error: "Session not found or expired",
        sessionId
      });
    }

    res.json({
      valid: true,
      sessionId: session.sessionId,
      labId: session.labId,
      status: session.status,
      expiresAt: session.expiresAt,
      expiresIn: Math.floor((session.expiresAt - Date.now()) / 1000)
    });
  } catch (error) {
    console.error("[API] Error validating session:", error);
    res.status(500).json({ 
      valid: false,
      error: "Failed to validate session" 
    });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server with noServer: true
// This allows us to handle upgrades manually
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket connections
wss.on("connection", (ws: WebSocket, req: http.IncomingMessage, sessionId: string) => {
  const startTime = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  console.log(`[WebSocket] Connection established for session: ${sessionId}`);
  console.log(`[WebSocket] Client IP: ${clientIp}`);
  
  // Set up heartbeat
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let isAlive = true;
  
  // Heartbeat ping every 30 seconds
  heartbeatInterval = setInterval(() => {
    if (!isAlive) {
      console.log(`[WebSocket:${sessionId}] No pong received, terminating connection`);
      ws.terminate();
      return;
    }
    
    isAlive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      console.log(`[WebSocket:${sessionId}] Ping sent`);
    }
  }, HEARTBEAT_INTERVAL);
  
  // Handle pong response
  ws.on("pong", () => {
    isAlive = true;
    console.log(`[WebSocket:${sessionId}] Pong received`);
  });
  
  // Handle messages
  ws.on("message", async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocket:${sessionId}] Received:`, message);
      
      // Handle client ping
      if (message.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        return;
      }
      
      // Handle other message types...
      // (Add your terminal command handling here)
      
    } catch (error) {
      console.error(`[WebSocket:${sessionId}] Error handling message:`, error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format",
        timestamp: Date.now()
      }));
    }
  });
  
  // Handle close
  ws.on("close", (code: number, reason: Buffer) => {
    console.log(`[WebSocket:${sessionId}] Connection closed: ${code} ${reason.toString()}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });
  
  // Handle errors
  ws.on("error", (error: Error) => {
    console.error(`[WebSocket:${sessionId}] Error:`, error);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });
  
  // Send initial connection message
  ws.send(JSON.stringify({
    type: "connected",
    message: "WebSocket connection established",
    sessionId: sessionId,
    timestamp: Date.now()
  }));
  
  console.log(`[WebSocket:${sessionId}] Connection setup complete in ${Date.now() - startTime}ms`);
});

// Handle HTTP upgrade for WebSocket
server.on("upgrade", async (request: http.IncomingMessage, socket: any, head: Buffer) => {
  const pathname = request.url || "";
  
  console.log(`[Upgrade] Request for: ${pathname}`);
  console.log(`[Upgrade] Headers:`, JSON.stringify(request.headers, null, 2));
  
  // Parse session ID from URL
  // URL format: /terminal/:sessionId or /ws-test
  const terminalMatch = pathname.match(/^\/terminal\/(.+)$/);
  const isTestEndpoint = pathname === "/ws-test";
  
  if (!terminalMatch && !isTestEndpoint) {
    console.log(`[Upgrade] Invalid path: ${pathname}`);
    socket.destroy();
    return;
  }
  
  const sessionId = terminalMatch ? terminalMatch[1] : "test-session";
  
  // Validate session (skip for test endpoint)
  if (!isTestEndpoint) {
    try {
      const session = await labSessionService.getSession(sessionId);
      
      if (!session) {
        console.log(`[Upgrade] Session not found: ${sessionId}`);
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }
      
      console.log(`[Upgrade] Session validated: ${sessionId}`);
    } catch (error) {
      console.error(`[Upgrade] Session validation error:`, error);
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
      return;
    }
  }
  
  // Complete the upgrade
  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log(`[Upgrade] WebSocket upgrade successful for: ${sessionId}`);
    wss.emit("connection", ws, request, sessionId);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`[Server] AWS Labs Backend running on port ${PORT}`);
  console.log(`[Server] Node environment: ${process.env.NODE_ENV}`);
  console.log(`[Server] AWS Region: ${process.env.AWS_REGION || "ap-south-1 (default)"}`);
  console.log(`[Server] Allowed CORS origins: ${allowedOrigins.join(", ")}`);
  console.log(`[Server] WebSocket endpoints:`);
  console.log(`  - ws://localhost:${PORT}/terminal/:sessionId`);
  console.log(`  - ws://localhost:${PORT}/ws-test (test endpoint)`);
  console.log(`[Server] Connection timeout: ${WS_CONNECTION_TIMEOUT}ms`);
  console.log(`[Server] Heartbeat interval: ${HEARTBEAT_INTERVAL}ms`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] HTTP server closed");
    wss.close(() => {
      console.log("[Server] WebSocket server closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] HTTP server closed");
    wss.close(() => {
      console.log("[Server] WebSocket server closed");
      process.exit(0);
    });
  });
});
