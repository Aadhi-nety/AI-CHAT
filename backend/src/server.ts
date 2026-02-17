import express, { Request } from "express";
import expressWs from "express-ws";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocket } from "ws";
import labSessionService from "./services/lab-session.service";
import { TerminalServer } from "./terminal-server";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Dynamic CORS configuration
const allowedOrigins: string[] = [
  "https://ai-chat-two-ecru.vercel.app",
  "https://ai-chat-eor90dxjd-aadhi-netys-projects.vercel.app",
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001"
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: (origin, callback) => {
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
  allowedHeaders: ["Content-Type", "Authorization", "Upgrade", "Connection"],
  credentials: true
}));

// Handle preflight requests
app.options("*", cors());

app.use(express.json());

// Initialize express-ws
const { app: wsApp } = expressWs(app);

// Initialize terminal server
const terminalServer = new TerminalServer();

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
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
app.get("/api/labs/session/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = labSessionService.getSession(sessionId);

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
app.post("/api/labs/session/:sessionId/extend", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { minutes = 30 } = req.body;

    const session = labSessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    labSessionService.extendSession(sessionId, minutes);

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

  console.log(`[Terminal] New connection attempt: ${sessionId}`);
  console.log(`[Terminal] Client IP: ${clientIp}, Origin: ${origin}`);
  console.log(`[Terminal] Request headers:`, JSON.stringify(req.headers, null, 2));

  // Retry session lookup with exponential backoff
  let session = labSessionService.getSession(sessionId);
  let retryCount = 0;
  const maxRetries = 3;
  
  while (!session && retryCount < maxRetries) {
    retryCount++;
    const backoffMs = Math.min(100 * Math.pow(2, retryCount - 1), 1000); // Max 1 second
    console.log(`[Terminal] Session not found, retrying in ${backoffMs}ms (attempt ${retryCount}/${maxRetries})`);
    await delay(backoffMs);
    session = labSessionService.getSession(sessionId);
  }

  if (!session) {
    const errorMsg = `[Terminal] Session lookup failed for ${sessionId} after ${retryCount} retries. Active sessions: ${labSessionService.getActiveSessionIds?.().join(", ") || 'N/A'}`;
    console.error(errorMsg);
    console.error(`[Terminal] Connection attempt took ${Date.now() - startTime}ms`);
    
    // Send detailed error to client before closing
    try {
      ws.send(JSON.stringify({
        type: "error",
        message: "Session not found or expired",
        code: "SESSION_NOT_FOUND",
        sessionId: sessionId,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Client may have already disconnected
    }
    
    ws.close(4000, "Invalid session");
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
    terminalServer.destroyTerminal(sessionId);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`[Terminal:${sessionId}] WebSocket error:`, error);
    console.error(`[Terminal:${sessionId}] Error details:`, {
      message: error.message,
      code: (error as any).code,
      type: (error as any).type,
      stack: error.stack
    });
    clearInterval(pingInterval);
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

// Start server
app.listen(PORT, () => {
  console.log(`[Server] AWS Labs Backend running on port ${PORT}`);
  console.log(`[Server] Node environment: ${process.env.NODE_ENV}`);
  console.log(`[Server] AWS Region: ${process.env.AWS_REGION || "ap-south-1 (default)"}`);
  console.log(`[Server] Allowed CORS origins: ${allowedOrigins.join(", ")}`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/terminal/:sessionId`);
});

// Add diagnostic endpoint
app.get("/api/diagnostics/websocket", (req, res) => {
  res.json({
    status: "ok",
    websocketEndpoint: `/terminal/:sessionId`,
    supportedProtocols: ["ws", "wss"],
    corsOrigins: allowedOrigins,
    awsRegion: process.env.AWS_REGION || "ap-south-1",
    timestamp: Date.now(),
    activeSessions: labSessionService.getActiveSessionIds?.() || "N/A"
  });
});

/**
 * GET /api/labs/session/:sessionId/validate
 * Validate session without establishing WebSocket connection
 */
app.get("/api/labs/session/:sessionId/validate", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = labSessionService.getSession(sessionId);

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
