/**
 * AWS Lambda WebSocket Handler
 * 
 * Handles WebSocket connections via API Gateway:
 * - $connect: Called when client connects
 * - $disconnect: Called when client disconnects
 * - $default: Called for any other message
 * 
 * Environment Variables:
 * - TABLE_NAME: DynamoDB table for connection storage
 * - APP_RUNNER_URL: Backend App Runner URL
 * - JWT_SECRET: JWT secret for token validation
 */

const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'WebSocketConnections';
const APP_RUNNER_URL = process.env.APP_RUNNER_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  console.log(`[WebSocket] Route: ${routeKey}, ConnectionId: ${connectionId}, Domain: ${domainName}, Stage: ${stage}`);

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(event);
      case '$disconnect':
        return await handleDisconnect(event);
      case '$default':
        return await handleMessage(event);
      default:
        console.log(`[WebSocket] Unknown route: ${routeKey}`);
        return { statusCode: 404, body: 'Route not found' };
    }
  } catch (error) {
    console.error('[WebSocket] Error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

/**
 * Handle $connect - Client connecting
 */
async function handleConnect(event) {
  const connectionId = event.requestContext.connectionId;
  const queryParams = event.queryStringParameters || {};
  const headers = event.headers || {};
  
  // Extract auth token from query params or headers
  const authToken = queryParams.token || headers.Authorization || headers.authorization;
  const sessionId = queryParams.sessionId;

  console.log(`[WebSocket] Connect - Token: ${authToken ? 'present' : 'missing'}, Session: ${sessionId}`);

  // Validate authentication
  if (!authToken) {
    console.log('[WebSocket] No auth token provided');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }

  try {
    // Verify JWT token
    const decoded = await verifyToken(authToken);
    const targetSessionId = sessionId || decoded.sessionId;

    if (!targetSessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    // Validate session with backend if URL is configured
    if (APP_RUNNER_URL) {
      try {
        const validateUrl = `${APP_RUNNER_URL}/api/labs/session/${targetSessionId}/validate`;
        console.log(`[WebSocket] Validating session with: ${validateUrl}`);
        
        const response = await fetch(validateUrl, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log('[WebSocket] Session validation failed:', errorData);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: errorData.error || 'Invalid or expired session' })
          };
        }

        const sessionData = await response.json();
        console.log('[WebSocket] Session validated:', sessionData.sessionId);
      } catch (validationError) {
        console.error('[WebSocket] Session validation error:', validationError);
        // Continue with connection - backend will handle invalid sessions
      }
    }

    // Store connection in DynamoDB
    const now = Date.now();
    await dynamoDB.put({
      TableName: TABLE_NAME,
      Item: {
        connectionId,
        sessionId: targetSessionId,
        userId: decoded.userId || decoded.sub || 'unknown',
        username: decoded.username || 'unknown',
        createdAt: now,
        expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours TTL
        metadata: {
          domainName,
          stage,
          connectedAt: new Date(now).toISOString()
        }
      },
      ConditionExpression: 'attribute_not_exists(connectionId)'
    }).promise();

    console.log(`[WebSocket] Connected: ${connectionId}, Session: ${targetSessionId}, User: ${decoded.userId}`);

    // Send welcome message to client
    const callbackUrl = `https://${domainName}/${stage}`;
    await sendToClient(connectionId, {
      type: 'connected',
      message: 'WebSocket connection established',
      sessionId: targetSessionId,
      timestamp: now,
      connectionId
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Connected successfully',
        sessionId: targetSessionId,
        connectionId
      })
    };

  } catch (error) {
    console.error('[WebSocket] Connect error:', error);
    
    if (error.message === 'The conditional request failed') {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Connection already exists' })
      };
    }
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to establish connection' })
    };
  }
}

/**
 * Handle $disconnect - Client disconnecting
 */
async function handleDisconnect(event) {
  const connectionId = event.requestContext.connectionId;

  console.log(`[WebSocket] Disconnect: ${connectionId}`);

  try {
    // Get connection info before deleting
    const connectionData = await dynamoDB.get({
      TableName: TABLE_NAME,
      Key: { connectionId }
    }).promise();

    const sessionId = connectionData.Item?.sessionId;

    // Delete connection from DynamoDB
    await dynamoDB.delete({
      TableName: TABLE_NAME,
      Key: { connectionId }
    }).promise();

    console.log(`[WebSocket] Disconnected: ${connectionId}, Session: ${sessionId}`);

    // Notify backend about disconnect
    if (APP_RUNNER_URL && sessionId) {
      try {
        await fetch(`${APP_RUNNER_URL}/api/ws/disconnect`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': event.headers.Authorization || ''
          },
          body: JSON.stringify({ 
            connectionId,
            sessionId
          })
        }).catch(err => {
          console.error('[WebSocket] Backend disconnect notification failed:', err);
        });
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

/**
 * Handle $default - Handle messages from client
 */
async function handleMessage(event) {
  const connectionId = event.requestContext.connectionId;
  const body = event.body || '{}';
  let message;

  try {
    message = JSON.parse(body);
  } catch (error) {
    console.error('[WebSocket] Failed to parse message:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON message' })
    };
  }

  console.log(`[WebSocket] Message from ${connectionId}:`, message);

  // Handle ping
  if (message.type === 'ping') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        type: 'pong',
        timestamp: Date.now()
      })
    };
  }

  // Forward message to backend
  if (APP_RUNNER_URL) {
    try {
      const response = await fetch(`${APP_RUNNER_URL}/api/ws/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connection-Id': connectionId,
          'Authorization': event.headers.Authorization || ''
        },
        body: JSON.stringify({
          ...message,
          connectionId,
          timestamp: Date.now()
        })
      });

      const result = await response.json().catch(() => ({}));

      return {
        statusCode: response.ok ? 200 : response.status,
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

  return {
    statusCode: 200,
    body: JSON.stringify({
      type: 'ack',
      originalMessage: message.type,
      timestamp: Date.now()
    })
  };
}

/**
 * Send message to a specific client using API Gateway Management API
 */
async function sendToClient(connectionId, data) {
  try {
    const endpoint = `https://${process.env.DOMAIN_NAME}/${process.env.STAGE}`;
    const apiGateway = new AWS.ApiGatewayManagementApi({
      endpoint
    });

    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(data)
    }).promise();

    return true;
  } catch (error) {
    if (error.statusCode === 410) {
      console.log(`[WebSocket] Stale connection: ${connectionId}`);
      // Clean up stale connection
      await dynamoDB.delete({
        TableName: TABLE_NAME,
        Key: { connectionId }
      }).promise();
    } else {
      console.error('[WebSocket] Send to client error:', error);
    }
    return false;
  }
}

/**
 * Broadcast message to all clients in a session
 */
async function broadcastToSession(sessionId, data) {
  try {
    const result = await dynamoDB.query({
      TableName: TABLE_NAME,
      IndexName: 'SessionIdIndex',
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId
      }
    }).promise();

    const connections = result.Items || [];
    console.log(`[WebSocket] Broadcasting to ${connections.length} connections in session ${sessionId}`);

    const sendPromises = connections.map(conn => 
      sendToClient(conn.connectionId, data)
    );

    await Promise.allSettled(sendPromises);
    return connections.length;
  } catch (error) {
    console.error('[WebSocket] Broadcast error:', error);
    return 0;
  }
}

/**
 * Verify JWT token
 */
async function verifyToken(token) {
  try {
    // For development/testing, allow unsigned tokens
    if (process.env.NODE_ENV === 'development' || process.env.ALLOW_UNSIGNED) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload;
      }
    }

    // Verify with secret
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256', 'RS256']
    });
    
    return decoded;
  } catch (error) {
    console.error('[WebSocket] Token verification error:', error);
    throw error;
  }
}

module.exports = {
  handler: exports.handler,
  handleConnect,
  handleDisconnect,
  handleMessage,
  sendToClient,
  broadcastToSession,
  verifyToken
};
