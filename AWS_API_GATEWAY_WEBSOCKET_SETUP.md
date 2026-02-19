# AWS API Gateway WebSocket Setup Guide

## Architecture Overview

```
┌─────────────────┐     wss://{api}.execute-api.{region}.amazonaws.com/{stage}     ┌─────────────────┐
│   Next.js       │ ───────────────────────────────────────────────────────────────►│  API Gateway    │
│   Frontend      │                                                                     │  WebSocket API │
│   (Vercel)      │◄───────────────────────────────────────────────────────────────│                 │
└─────────────────┘                                                                     └────────┬────────┘
                                                                                               │
                                                                                               │ $connect, $disconnect, @routes
                                                                                               │
                                                                                               ▼
                                                                                      ┌─────────────────┐
                                                                                      │   Lambda        │
│   Backend         │◄──────────────────────────────────────────────────────────────│   Function      │
│   (App Runner)   │         HTTPS (JWT validation, Business Logic)                 │   (Node.js)     │
│                  │──────────────────────────────────────────────────────────────►│                 │
└─────────────────┘                                                                     └─────────────────┘
```

## Components

1. **API Gateway WebSocket API**: Manages WebSocket connections
2. **Lambda Function**: Handles connection lifecycle and message routing
3. **App Runner Backend**: Handles business logic and terminal operations
4. **DynamoDB**: Stores connection IDs and session mappings
5. **ElastiCache Redis**: Stores session data and terminal state

## Prerequisites

- AWS Account with appropriate permissions
- Node.js backend deployed on App Runner (or Lambda)
- Next.js frontend deployed on Vercel
- Domain configured (optional but recommended)

---

## Step 1: Create DynamoDB Table for Connection Management

1. Go to DynamoDB Console
2. Create table:
   - Table name: `WebSocketConnections`
   - Partition key: `connectionId` (String)
   - Sort key: `sessionId` (String)
3. Enable TTL on `expiresAt` for automatic cleanup
4. Note the ARN for IAM policy

---

## Step 2: Create Lambda Function for WebSocket Handling

Create a new Lambda function with the following code:

```
javascript
// lambda/websocket-handler.js
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'WebSocketConnections';
const APP_RUNNER_URL = process.env.APP_RUNNER_URL;
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  console.log(`[WebSocket] Route: ${routeKey}, ConnectionId: ${connectionId}`);

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(event);
      case '$disconnect':
        return await handleDisconnect(event);
      case '$default':
        return await handleMessage(event);
      default:
        return { statusCode: 404, body: 'Route not found' };
    }
  } catch (error) {
    console.error('[WebSocket] Error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function handleConnect(event) {
  const connectionId = event.requestContext.connectionId;
  const queryParams = event.queryStringParameters || {};
  const authToken = queryParams.token || event.headers?.Authorization;

  // Validate JWT token
  if (!authToken) {
    console.log('[WebSocket] No auth token provided');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }

  // Verify JWT (implement based on your JWT library)
  try {
    const decoded = verifyToken(authToken);
    const sessionId = queryParams.sessionId || decoded.sessionId;

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    // Store connection in DynamoDB
    await dynamoDB.put({
      TableName: TABLE_NAME,
      Item: {
        connectionId,
        sessionId,
        userId: decoded.userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      }
    }).promise();

    console.log(`[WebSocket] Connected: ${connectionId}, Session: ${sessionId}`);

    // Validate session with backend
    if (APP_RUNNER_URL) {
      try {
        const response = await fetch(`${APP_RUNNER_URL}/api/labs/session/${sessionId}/validate`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const error = await response.json();
          return {
            statusCode: 400,
            body: JSON.stringify({ error: error.error || 'Invalid session' })
          };
        }
      } catch (err) {
        console.error('[WebSocket] Session validation error:', err);
        // Continue anyway - let backend handle it
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Connected',
        sessionId,
        connectionId
      })
    };
  } catch (error) {
    console.error('[WebSocket] Auth error:', error);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }
}

async function handleDisconnect(event) {
  const connectionId = event.requestContext.connectionId;

  try {
    // Remove connection from DynamoDB
    await dynamoDB.delete({
      TableName: TABLE_NAME,
      Key: { connectionId }
    }).promise();

    console.log(`[WebSocket] Disconnected: ${connectionId}`);

    // Notify backend about disconnect
    if (APP_RUNNER_URL) {
      try {
        await fetch(`${APP_RUNNER_URL}/api/ws/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId })
        }).catch(() => {});
      } catch (err) {
        console.error('[WebSocket] Disconnect notification error:', err);
      }
    }

    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('[WebSocket] Disconnect error:', error);
    return { statusCode: 500, body: 'Error disconnecting' };
  }
}

async function handleMessage(event) {
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(event.body || '{}');

  console.log(`[WebSocket] Message from ${connectionId}:`, body);

  // Forward message to backend
  if (APP_RUNNER_URL) {
    try {
      const response = await fetch(`${APP_RUNNER_URL}/api/ws/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connection-Id': connectionId
        },
        body: JSON.stringify({
          ...body,
          connectionId
        })
      });

      const result = await response.json();

      // Send response back to client
      return {
        statusCode: 200,
        body: JSON.stringify(result)
      };
    } catch (error) {
      console.error('[WebSocket] Message forwarding error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to process message' })
      };
    }
  }

  return { statusCode: 200, body: 'Message received' };
}

// Simple JWT verification (replace with actual implementation)
function verifyToken(token) {
  // Implement JWT verification based on your library
  // This is a placeholder
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

---

## Step 3: Create API Gateway WebSocket API

### 3.1 Create the API

1. Go to API Gateway Console
2. Choose "WebSocket API" → "Build"
3. Configure:
   - API name: `AWSLabsWebSocketAPI`
   - Route selection expression: `$request.body.action`
   - Click "Create"

### 3.2 Configure Routes

Add the following routes:

| Route | Integration Type | Lambda Function |
|-------|-----------------|-----------------|
| `$connect` | Lambda | websocket-handler |
| `$disconnect` | Lambda | websocket-handler |
| `$default` | Lambda | websocket-handler |

### 3.3 Configure Integration

For each route:
1. Click "Integration"
2. Choose "Lambda Function"
3. Select your region and function name
4. Check "Use default timeout" or set custom (29 seconds for WebSocket)

### 3.4 Configure Stage

1. Go to "Stages" → "Create stage"
2. Stage name: `prod` (or `dev`)
3. Deployment ID: Create new deployment
4. Configure:
   - Enable logging
   - Set log level: INFO
   - Enable CloudWatch Metrics

### 3.5 Note the WebSocket URL

After deployment, note your WebSocket URL:
```
wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

---

## Step 4: Configure IAM Permissions

Create an IAM role for Lambda with this policy:

```
json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:{region}:{account}:table/WebSocketConnections"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:{region}:{account}:*"
    }
  ]
}
```

---

## Step 5: Update Backend for WebSocket Messages

Update your App Runner backend to handle messages from API Gateway:

```
typescript
// backend/src/routes/websocket.routes.ts
import express from 'express';

const router = express.Router();

// Handle messages from API Gateway
router.post('/api/ws/message', async (req, res) => {
  try {
    const { connectionId, type, command, sessionId } = req.body;
    
    console.log(`[WS] Message from ${connectionId}:`, { type, command });

    switch (type) {
      case 'ping':
        res.json({ type: 'pong', timestamp: Date.now() });
        break;

      case 'command':
        // Execute terminal command
        const result = await executeTerminalCommand(sessionId, command);
        res.json({
          type: 'command_result',
          result,
          timestamp: Date.now()
        });
        break;

      case 'resize':
        // Resize terminal
        await resizeTerminal(sessionId, req.body.cols, req.body.rows);
        res.json({
          type: 'resize_ack',
          timestamp: Date.now()
        });
        break;

      default:
        res.json({ type: 'unknown_command' });
    }
  } catch (error) {
    console.error('[WS] Message handling error:', error);
    res.status(500).json({ error: 'Failed to handle message' });
  }
});

// Handle disconnect notification
router.post('/api/ws/disconnect', async (req, res) => {
  try {
    const { connectionId } = req.body;
    console.log(`[WS] Client disconnected: ${connectionId}`);
    // Clean up any resources
    res.json({ success: true });
  } catch (error) {
    console.error('[WS] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to handle disconnect' });
  }
});

async function executeTerminalCommand(sessionId: string, command: string) {
  // Implement terminal command execution
  // This should use your existing terminal-server.ts
  return { output: 'Command executed', exitCode: 0 };
}

async function resizeTerminal(sessionId: string, cols: number, rows: number) {
  // Implement terminal resize
}

export default router;
```

---

## Step 6: Update Frontend WebSocket Connection

Update the `use-terminal.ts` hook to connect to API Gateway:

```
typescript
// Updated use-terminal.ts for API Gateway WebSocket

// Get WebSocket URL from environment
const WS_API_URL = process.env.NEXT_PUBLIC_WS_API_URL || 
  'wss://your-api-id.execute-api.ap-south-1.amazonaws.com/prod';

export function useTerminal(
  sessionId: string,
  token: string,
  options: UseTerminalOptions = {}
) {
  // ... existing code ...

  const connect = useCallback(async () => {
    if (!sessionId || !token) {
      console.error('[Terminal] Missing sessionId or token');
      return;
    }

    // Construct WebSocket URL with query params
    const wsUrl = new URL(WS_API_URL);
    wsUrl.searchParams.set('sessionId', sessionId);
    wsUrl.searchParams.set('token', token);

    const fullUrl = wsUrl.toString();
    
    console.log(`[Terminal] Connecting to: ${fullUrl}`);

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      console.error('[Terminal] Connection timeout');
      if (ws.current?.readyState !== WebSocket.OPEN) {
        ws.current?.close(1008, 'Connection timeout');
      }
    }, 25000);

    try {
      ws.current = new WebSocket(fullUrl);

      ws.current.onopen = () => {
        clearTimeout(connectionTimeoutRef.current);
        console.log('[Terminal] Connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        options.onConnect?.();
      };

      // ... rest of the WebSocket handling code ...
    } catch (error) {
      console.error('[Terminal] Connection error:', error);
      handleReconnect();
    }
  }, [sessionId, token]);

  // ... rest of the hook ...
}
```

---

## Step 7: Environment Variables

### Backend (.env)
```
bash
# API Gateway Configuration
API_GATEWAY_WS_URL=wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}

# DynamoDB
DYNAMODB_TABLE=WebSocketConnections

# JWT
JWT_SECRET=your_jwt_secret
```

### Frontend (.env.production)
```
bash
# API Gateway WebSocket URL
NEXT_PUBLIC_WS_API_URL=wss://{api-id}.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_API_URL=https://{app-runner-url}
```

---

## Step 8: Testing

### Test WebSocket Connection

```
javascript
// test-websocket-api-gateway.js
const WebSocket = require('ws');

const WS_URL = 'wss://{api-id}.execute-api.{region}.amazonaws.com/prod?sessionId=test-session&token={jwt-token}';

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('[Test] Connected');
  ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('message', (data) => {
  console.log('[Test] Received:', JSON.parse(data));
});

ws.on('error', (error) => {
  console.error('[Test] Error:', error);
});

ws.on('close', (code, reason) => {
  console.log('[Test] Closed:', code, reason);
});
```

---

## Monitoring & Troubleshooting

### CloudWatch Logs
- API Gateway Access Logs: Monitor request/response
- Lambda Logs: Check function execution
- CloudWatch Metrics: Monitor connection counts

### Common Issues

1. **403 Forbidden**
   - Check API Gateway route configuration
   - Verify Lambda integration is correct

2. **1006 Abnormal Closure**
   - Check idle timeout settings (default 10 minutes)
   - Implement ping/pong keepalive
   - Check Lambda timeout (max 29 seconds)

3. **Connection Timeout**
   - Increase idle timeout in API Gateway
   - Implement reconnection strategy in frontend

---

## Cost Optimization

- API Gateway: $0.25 per million messages
- Lambda: Free tier (1M requests/month)
- DynamoDB: Pay per request mode for development
- Estimated cost: $10-50/month for moderate usage

---

## Security Best Practices

1. **JWT Validation**: Validate tokens on $connect
2. **IP Restrictions**: Use API Gateway usage plans
3. **Rate Limiting**: Configure throttling
4. **SSL/TLS**: Use wss:// (WebSocket Secure)
5. **Connection Validation**: Verify session before allowing connection
