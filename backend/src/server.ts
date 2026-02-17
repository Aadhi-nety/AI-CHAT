import express, { Request } from "express";
import expressWs from "express-ws";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocket } from "ws";
import http from "http";
import labSessionService from "./services/lab-session.service";
import { TerminalServer } from "./terminal-server";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Upgrade", "Connection", "Sec-WebSocket-Key", "Sec-WebSocket-Version", "Sec-WebSocket-Extensions"],
  exposedHeaders: ["Upgrade", "Connection"],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

app.use(express.json());

// Create HTTP server first (required for proper WebSocket support)
const server = http.createServer(app);

// Initialize express-ws with the HTTP server
const { app: wsApp } = expressWs(app, server);

// Initialize terminal server
const terminalServer = new TerminalServer();

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// WebSocket connection timeout (30 seconds)
const WS_CONNECTION_TIMEOUT = 30000;

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: Date.now(),
    websocket: "available",
    endpoints: ["/terminal/:sessionId", "/ws-test"]
  });
});

// WebSocket test endpoint for connectivity verification
wsApp.ws("/ws-test", (ws, req) => {
  console.log(`[WebSocket Test] Connection from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
  
  ws.on("message", (msg: string) => {
    try {
      const data = JSON.parse(msg);
      console.log(`[WebSocket Test] Received:`, data);
      
      // Echo back with timestamp
      ws.send(JSON.stringify({
        type: "echo",
        received: data,
        timestamp: Date.now(),
        server: "aws-app-runner"
      }));
    } catch (e) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON",
        timestamp: Date.now()
      }));
    }
  });
  
  ws.on("close", (code, reason) => {
    console.log(`[WebSocket Test] Closed: ${code} ${reason}`);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: "connected",
    message: "WebSocket test endpoint - send any JSON message to echo",
    timestamp: Date.now()
  }));
});

// API Routes

/**
 * POST /api/labs/start
 * Start a lab session
 * Body: { userId, labId, purchaseId, token }
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

// WebSocket Routes

/**
 * WebSocket /terminal/:sessionId
 * Terminal connection for executing commands
 */
wsApp.ws("/terminal/:sessionId", async (ws, req) => {
  const { sessionId } = req.params;
  const startTime = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const origin = req.headers.origin || 'unknown';
  
  // Set connection timeout
  const connectionTimeout = setTimeout(() => {
    console.error(`[Terminal:${sessionId}] Connection timeout after ${WS_CONNECTION_TIMEOUT}ms`);
    try {
      ws.send(JSON.stringify({
        type: "error",
        message: "Connection timeout - session validation took too long",
        code: "CONNECTION_TIMEOUT"
      }));
      ws.close(1008, "Connection timeout");
    } catch (e) {
      // Connection may already be closed
    }
  }, WS_CONNECTION_TIMEOUT);

  console.log(`[Terminal] New connection attempt: ${sessionId}`);
  console.log(`[Terminal] Client IP: ${clientIp}, Origin: ${origin}`);
  console.log(`[Terminal] WebSocket readyState: ${ws.readyState}`);

  // Retry session lookup with exponential backoff
  let session = await labSessionService.getSession(sessionId);
  let retryCount = 0;
  const maxRetries = 3;
  
  while (!session && retryCount < maxRetries) {
    retryCount++;
    const backoffMs = Math.min(100 * Math.pow(2, retryCount - 1), 1000); // Max 1 second
    console.log(`[Terminal] Session not found, retrying in ${backoffMs}ms (attempt ${retryCount}/${maxRetries})`);
    await delay(backoffMs);
    session = await labSessionService.getSession(sessionId);
  }

  // Clear connection timeout
  clearTimeout(connectionTimeout);

  if (!session) {
    const activeSessionIds = await labSessionService.getActiveSessionIds();
    const errorMsg = `[Terminal] Session lookup failed for ${sessionId} after ${retryCount} retries. Active sessions: ${activeSessionIds.join(", ") || 'N/A'}`;
    console.error(errorMsg);
    console.error(`[Terminal] Connection attempt took ${Date.now() - startTime}ms`);
    
    // Send detailed error to client before closing
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "error",
          message: "Session not found or expired",
          code: "SESSION_NOT_FOUND",
          sessionId: sessionId,
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      // Client may have already disconnected
      console.error(`[Terminal:${sessionId}] Error sending session not found message:`, e);
    }
    
    // Close with delay to allow message to be sent
    setTimeout(() => {
      try {
        ws.close(4000, "Invalid session");
      } catch (e) {
        // Already closed
      }
    }, 100);
    return;
  }

  console.log(`[Terminal] Session found for ${sessionId}, lab: ${session.labId}, region: ${session.sandboxAccount?.region || 'not set'}`);

  console.log(`[Terminal] Session found for ${sessionId}, creating terminal instance.`);

  // Create terminal instance for this connection
  // Use session region if available, fallback to environment or default
  const region = session.sandboxAccount?.region || process.env.AWS_REGION || "ap-south-1";
  console.log(`[Terminal] Using AWS region: ${region} for session ${sessionId}`);

  const terminalInstance = terminalServer.createTerminal(sessionId, {
    accessKeyId: session.sandboxAccount.iamAccessKeyId,
    secretAccessKey: session.sandboxAccount.iamSecretAccessKey,
    region: region,
  });

  // Server-side ping interval for keepalive
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 15000); // 15 seconds

  // Handle incoming messages (commands)
  ws.on("message", async (msg: string) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "command") {
        const output = await terminalInstance.executeCommand(data.command);
        ws.send(
          JSON.stringify({
            type: "output",
            data: output,
            timestamp: Date.now(),
          })
        );
      } else if (data.type === "resize") {
        terminalInstance.resize(data.cols, data.rows);
      } else if (data.type === "ping") {
        // Respond to client ping
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (data.type === "pong") {
        // Client responded to server ping - connection is alive
        console.log(`[Terminal:${sessionId}] Pong received`);
      }
    } catch (error) {
      console.error(`[Terminal:${sessionId}] Message handling error:`, error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Command failed",
        })
      );
    }
  });

  // Handle disconnect
  ws.on("close", (code, reason) => {
    console.log(`[Terminal] Connection closed: ${sessionId}, code: ${code}, reason: ${reason}`);
    clearInterval(pingInterval);
    clearTimeout(connectionTimeout);
    terminalServer.destroyTerminal(sessionId);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`[Terminal:${sessionId}] WebSocket error:`, error);
    console.error(`[Terminal:${sessionId}] Error details:`, {
      message: error.message,
      code: (error as any).code,
      type: (error as any).type,
      stack: error.stack,
      readyState: ws.readyState
    });
    clearInterval(pingInterval);
    clearTimeout(connectionTimeout);
  });

  // Log successful connection establishment
  console.log(`[Terminal:${sessionId}] Connection established successfully in ${Date.now() - startTime}ms`);

  // Send initial message
  ws.send(
    JSON.stringify({
      type: "connected",
      message: `Connected to AWS CLI Terminal for ${session.labId}`,
      credentials: {
        region: process.env.AWS_REGION || "us-east-1",
      },
    })
  );
});

// Start server using the HTTP server instance
server.listen(PORT, () => {
  console.log(`[Server] AWS Labs Backend running on port ${PORT}`);
  console.log(`[Server] Node environment: ${process.env.NODE_ENV}`);
  console.log(`[Server] AWS Region: ${process.env.AWS_REGION || "ap-south-1 (default)"}`);
  console.log(`[Server] Allowed CORS origins: ${allowedOrigins.join(", ")}`);
  console.log(`[Server] WebSocket endpoints:`);
  console.log(`  - ws://localhost:${PORT}/terminal/:sessionId`);
  console.log(`  - ws://localhost:${PORT}/ws-test (test endpoint)`);
  console.log(`[Server] Connection timeout: ${WS_CONNECTION_TIMEOUT}ms`);
});

// Add diagnostic endpoint
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
    timestamp: Date.now(),
    activeSessions: activeSessions || "N/A",
    serverInfo: {
      platform: "aws-app-runner",
      nodeVersion: process.version
    }
  });
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
