/**
 * WebSocket API Routes
 * 
 * Handles WebSocket messages forwarded from API Gateway Lambda
 * These endpoints are called by the Lambda function when clients
 * send messages via the WebSocket connection.
 */

import express from 'express';
import labSessionService from '../services/lab-session.service';
import { TerminalServer } from '../terminal-server';

const router = express.Router();

// Initialize terminal server
const terminalServer = new TerminalServer();

/**
 * POST /api/ws/message
 * 
 * Handle messages from WebSocket clients via API Gateway
 */
router.post('/message', async (req, res) => {
  try {
    const { connectionId, type, command, sessionId, cols, rows, timestamp } = req.body;

    console.log(`[WS API] Message from ${connectionId}:`, { type, sessionId });

    // Validate session
    if (!sessionId) {
      return res.status(400).json({
        type: 'error',
        message: 'Session ID is required'
      });
    }

    // Get session from database
    const session = await labSessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        type: 'error',
        message: 'Session not found or expired'
      });
    }

    switch (type) {
      case 'ping':
        return res.json({
          type: 'pong',
          timestamp: Date.now()
        });

      case 'command':
        if (!command) {
          return res.status(400).json({
            type: 'error',
            message: 'Command is required'
          });
        }

        try {
          // Get or create terminal for this session
          let terminal = terminalServer.getTerminal(sessionId);

          if (!terminal) {
            terminal = terminalServer.createTerminal(sessionId, {
              accessKeyId: session.sandboxAccount.iamAccessKeyId,
              secretAccessKey: session.sandboxAccount.iamSecretAccessKey,
              region: session.sandboxAccount.region || 'us-east-1'
            });
          }

          // Execute command
          console.log(`[WS API] Executing command: ${command}`);
          const result = await terminal.executeCommand(command);

          return res.json({
            type: 'command_result',
            result,
            sessionId,
            timestamp: Date.now()
          });
        } catch (execError) {
          console.error('[WS API] Command execution error:', execError);
          return res.status(500).json({
            type: 'error',
            message: execError instanceof Error ? execError.message : 'Command execution failed',
            sessionId,
            timestamp: Date.now()
          });
        }

      case 'resize':
        if (!cols || !rows) {
          return res.status(400).json({
            type: 'error',
            message: 'Cols and rows are required'
          });
        }

        try {
          const terminal = terminalServer.getTerminal(sessionId);
          if (terminal) {
            terminal.resize(cols, rows);
          }

          return res.json({
            type: 'resize_ack',
            sessionId,
            cols,
            rows,
            timestamp: Date.now()
          });
        } catch (resizeError) {
          console.error('[WS API] Resize error:', resizeError);
          return res.status(500).json({
            type: 'error',
            message: 'Resize failed',
            sessionId,
            timestamp: Date.now()
          });
        }

      case 'history':
        try {
          const terminal = terminalServer.getTerminal(sessionId);
          const history = terminal?.getHistory() || [];

          return res.json({
            type: 'history',
            history,
            sessionId,
            timestamp: Date.now()
          });
        } catch (historyError) {
          console.error('[WS API] History error:', historyError);
          return res.status(500).json({
            type: 'error',
            message: 'Failed to get history',
            sessionId,
            timestamp: Date.now()
          });
        }

      case 'clear':
        try {
          const terminal = terminalServer.getTerminal(sessionId);
          if (terminal) {
            terminal.clearHistory();
          }

          return res.json({
            type: 'clear_ack',
            sessionId,
            timestamp: Date.now()
          });
        } catch (clearError) {
          console.error('[WS API] Clear error:', clearError);
          return res.status(500).json({
            type: 'error',
            message: 'Failed to clear history',
            sessionId,
            timestamp: Date.now()
          });
        }

      default:
        return res.json({
          type: 'unknown_command',
          message: `Unknown command type: ${type}`,
          sessionId,
          timestamp: Date.now()
        });
    }
  } catch (error) {
    console.error('[WS API] Error handling message:', error);
    return res.status(500).json({
      type: 'error',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/ws/disconnect
 * 
 * Handle client disconnect notification from API Gateway
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { connectionId, sessionId } = req.body;

    console.log(`[WS API] Client disconnected: ${connectionId}, Session: ${sessionId}`);

    // Clean up terminal if it exists
    if (sessionId) {
      const terminal = terminalServer.getTerminal(sessionId);
      if (terminal) {
        terminalServer.destroyTerminal(sessionId);
        console.log(`[WS API] Terminal destroyed: ${sessionId}`);
      }
    }

    return res.json({
      success: true,
      message: 'Disconnected successfully'
    });
  } catch (error) {
    console.error('[WS API] Disconnect error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Disconnect failed'
    });
  }
});

/**
 * GET /api/ws/status/:sessionId
 * 
 * Get WebSocket connection status for a session
 */
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await labSessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        valid: false,
        message: 'Session not found'
      });
    }

    const terminal = terminalServer.getTerminal(sessionId);
    const activeTerminals = terminalServer.getActiveSessions();

    return res.json({
      valid: true,
      sessionId,
      status: session.status,
      terminalActive: !!terminal,
      activeSessions: activeTerminals,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('[WS API] Status error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Status check failed'
    });
  }
});

/**
 * POST /api/ws/broadcast
 * 
 * Broadcast message to all connected clients in a session
 * (This could be used for announcements, session timeouts, etc.)
 */
router.post('/broadcast', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: 'Session ID and message are required'
      });
    }

    // Note: Actual broadcasting would require maintaining connection mapping
    // This is a placeholder for future implementation

    console.log(`[WS API] Broadcast to session ${sessionId}:`, message);

    return res.json({
      success: true,
      message: 'Broadcast initiated'
    });
  } catch (error) {
    console.error('[WS API] Broadcast error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Broadcast failed'
    });
  }
});

export default router;
