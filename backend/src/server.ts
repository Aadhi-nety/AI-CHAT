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

// CORS configuration for production - allow only Vercel frontend
const corsOptions = {
  origin: ["https://ai-chat-two-ecru.vercel.app"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize express-ws
const { app: wsApp } = expressWs(app);

// Initialize terminal server
const terminalServer = new TerminalServer();

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
wsApp.ws("/terminal/:sessionId", (ws, req) => {
  const { sessionId } = req.params;

  console.log(`[Terminal] New connection: ${sessionId}`);

  const session = labSessionService.getSession(sessionId);

  if (!session) {
    ws.close(4000, "Invalid session");
    return;
  }

  // Create terminal instance for this connection
  const terminalInstance = terminalServer.createTerminal(sessionId, {
    accessKeyId: session.sandboxAccount.iamAccessKeyId,
    secretAccessKey: session.sandboxAccount.iamSecretAccessKey,
    region: process.env.AWS_REGION || "us-east-1",
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
    clearInterval(pingInterval);
  });

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
});
