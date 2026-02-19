# WebSocket 1006 Fix - Complete AWS Architecture Implementation

## 1. Root Cause Explanation

### Why AWS App Runner Causes WebSocket 1006 Errors

**Root Cause**: AWS App Runner is NOT designed for long-lived WebSocket connections. Here's why:

1. **Connection Duration Limits**: App Runner's underlying infrastructure (AWS ECS under the hood) has idle connection timeouts that are much shorter than what WebSockets require. The ALB (Application Load Balancer) in front of App Runner has a default idle timeout of 60 seconds, but this can be exceeded or behave inconsistently.

2. **No WebSocket Aware Routing**: App Runner's default configuration treats WebSocket connections as regular HTTP connections that complete quickly. When the connection stays open, the infrastructure may terminate it as "hanging" or "idle".

3. **Instance Scaling Behavior**: App Runner can scale to zero and when starting new instances, existing WebSocket connections are dropped without proper graceful shutdown.

4. **25-Second Timeout**: The ~25 second timeout you're seeing is likely due to:
   - App Runner health check intervals
   - ALB idle timeout enforcement
   - CloudWatch metrics collection intervals
   - Proxy/load balancer connection limits

5. **Why Retries Fail**: Retrying doesn't help because:
   - Each new connection hits the same infrastructure limitations
   - The App Runner service may be starting/scaling
   - The underlying ALB keeps closing long-lived connections

## 2. Correct Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CORRECT AWS WEBSOCKET ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────────────────────┘

Browser (WebSocket Client)
        │
        │ wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}
        │ ?sessionId=xxx&token=xxx
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        AWS API Gateway (WebSocket API)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐   │
│  │   $connect │  │  $disconnect │  │   $default    │  │   Custom Routes │   │
│  │   Route    │  │    Route      │  │    Route       │  │   (sendMessage) │   │
│  └──────┬──────┘  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘   │
└─────────┼────────────────┼──────────────────┼────────────────────┼───────────┘
          │                │                  │                    │
          │ IAM Authorizer │                  │                    │
          ▼                ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          AWS Lambda Function                                    │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  • JWT Validation on $connect                                              │ │
│  │  • Store connectionId in DynamoDB                                          │ │
│  │  • Forward messages to App Runner via HTTPS                                │ │
│  │  • Send responses back via ApiGatewayManagementApi                       │ │
│  │  • Handle $disconnect cleanup                                              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
          │
          │ HTTPS (HTTP/1.1) - App Runner handles plain HTTP
          │ POST /api/ws/message
          │ X-Connection-Id: xxx
          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     AWS App Runner (HTTP Only - No WebSocket)                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  • Express.js REST API                                                     │ │
│  │  • Terminal session management                                             │ │
│  │  • Command execution                                                       │ │
│  │  • Returns JSON responses (NOT WebSocket frames)                           │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         AWS ElastiCache (Redis)                                │
│  • Session storage                                                             │
│  • Terminal state                                                              │
│  • Connection metadata                                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 3. IAM Permission Issue - Workarounds

### The Error You're Facing

```
User: arn:aws:iam::766363046973:user/aadhithya@iitm is not authorized to perform: 
iam:CreateRole on resource: arn:aws:iam::766363046973:role/service-role/websocket-handler-role-xxx 
with an explicit deny in an identity-based policy: arn:aws:iam::766363046973:policy/RestrictedUserResourceIsolation
```

### Solutions

#### Option A: Use an Existing Lambda Execution Role (Recommended)

1. Go to IAM Console → Roles
2. Look for existing Lambda execution roles (e.g., `lambda_basic_execution`)
3. Note the role ARN
4. When creating the Lambda function, select "Use an existing role" instead of creating a new one

#### Option B: Request Permission from AWS Admin

Contact your AWS administrator to:
1. Create the Lambda execution role manually
2. Attach the necessary policy
3. Or add your user to a group that can create roles

#### Option C: Use AWS Serverless Application Repository

Deploy a pre-built WebSocket solution instead of creating your own Lambda.

#### Option D: Use AWS SAM with Admin Assistance

Create a SAM template and have an admin deploy it:

```
yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: WebSocket API for Terminal

Resources:
  WebSocketFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: index.handler
      Runtime: nodejs18.x
      CodeUri: ./lambda
      Environment:
        Variables:
          TABLE_NAME: !Ref ConnectionsTable
          APP_RUNNER_URL: !Ref AppRunnerUrl
          JWT_SECRET: !Ref JwtSecret
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ConnectionsTable

  ConnectionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: WebSocketConnections
      AttributeDefinitions:
        - AttributeName: connectionId
          AttributeType: S
      KeySchema:
        - AttributeName: connectionId
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
```

## 4. Step-by-Step AWS Setup (Manual)

### Step 1: Create DynamoDB Table

1. Go to DynamoDB Console
2. Create table:
   - **Table name**: `WebSocketConnections`
   - **Partition key**: `connectionId` (String)
3. Create a GSI for session queries (optional):
   - **Index name**: `SessionIdIndex`
   - **Partition key**: `sessionId` (String)
4. Enable TTL on `expiresAt` for automatic cleanup

### Step 2: Create Lambda Function (Without Creating Role)

1. Go to Lambda Console
2. Click "Create function"
3. Select "Author from scratch"
4. Configure:
   - **Name**: `websocket-handler`
   - **Runtime**: Node.js 18.x
   - **Architecture**: arm64
5. **Key**: Under "Permissions", click "Change default execution role"
6. Select "Use an existing role" and choose an existing Lambda execution role
7. Copy the code from `lambda/websocket-handler.js`
8. Set environment variables:
   - `TABLE_NAME`: `WebSocketConnections`
   - `APP_RUNNER_URL`: Your App Runner HTTPS URL
   - `JWT_SECRET`: Your JWT secret
   - `DOMAIN_NAME`: Your API Gateway domain
   - `STAGE`: prod (or your stage name)

### Step 3: Create API Gateway WebSocket API

1. Go to API Gateway Console
2. Click "Create API" → "WebSocket API"
3. Configure:
   - **API name**: `TerminalWebSocketAPI`
   - **Route selection expression**: `$request.body.action`
4. Add routes:
   - `$connect` → Integration: Lambda function
   - `$disconnect` → Integration: Lambda function  
   - `$default` → Integration: Lambda function
5. Click "Create API"
6. Go to "Stages" → "Create stage"
7. Deploy to a stage (e.g., `prod`)
8. Note the **WebSocket URL**: 
   
```
   wss://{api-id}.execute-api.{region}.amazonaws.com/prod
   
```

### Step 4: Update Lambda Environment Variables

After deploying API Gateway, update Lambda environment variables:
- `DOMAIN_NAME`: `{api-id}.execute-api.{region}.amazonaws.com`
- `STAGE`: `prod`

### Step 5: Configure CORS (Optional)

If testing from localhost, add CORS configuration in API Gateway:
1. Go to your API → "CORS"
2. Enable "CORS"
3. Add allowed origins: `http://localhost:3000`, your production domain

## 5. Frontend Fix - Next.js

### Update Environment Variables

In your Next.js environment (.env.production):

```
bash
# BEFORE (WRONG - causes 1006 errors)
NEXT_PUBLIC_WS_URL=wss://your-app.ap-south-1.awsapprunner.com/terminal

# AFTER (CORRECT - API Gateway)
NEXT_PUBLIC_WS_URL=wss://{api-id}.execute-api.ap-south-1.amazonaws.com/prod
```

### Update the Terminal Component

If using the custom hook, make sure it's configured correctly:

```
typescript
// In your terminal component
import { useTerminalApiGateway } from '@/hooks/use-terminal-api-gateway';

// Use the hook with sessionId and token
const { isConnected, executeCommand, resizeTerminal, error } = useTerminalApiGateway({
  sessionId: sessionId,
  token: authToken,
  onMessage: handleMessage,
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
  onError: (err) => console.error('Error:', err),
});
```

### Alternative: Update Existing Hook

If you want to keep using the existing `useTerminal` hook, ensure the URL is correct:

```
typescript
// The hook automatically handles JWT in query string
const webSocketUrl = `${process.env.NEXT_PUBLIC_WS_URL}?sessionId=${sessionId}&token=${token}`;
```

## 6. Backend Updates Required

### Add HTTP Endpoint for WebSocket Messages

Add this route to your Express backend (App Runner):

```
typescript
// backend/src/routes/websocket.routes.ts

import express from 'express';

const router = express.Router();

// Handle messages from API Gateway Lambda
router.post('/api/ws/message', async (req, res) => {
  try {
    const { connectionId, type, command, sessionId, cols, rows } = req.body;
    
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
          result: result.output,
          exitCode: result.exitCode,
          timestamp: Date.now()
        });
        break;

      case 'resize':
        await resizeTerminal(sessionId, cols, rows);
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
    const { connectionId, sessionId } = req.body;
    console.log(`[WS] Client disconnected: ${connectionId}, Session: ${sessionId}`);
    
    // Clean up terminal session if needed
    await cleanupTerminalSession(sessionId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[WS] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to handle disconnect' });
  }
});

export default router;
```

## 7. Validation Checklist

### Confirm 1006 is Fixed

1. **Check Browser Console**:
   - Should see: `[Terminal] Connected successfully`
   - Should NOT see: `WebSocket connection to 'wss://...awsapprunner.com' failed`

2. **Check Network Tab**:
   - WebSocket connection should be to: `wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
   - NOT to: `wss://{app-id}.awsapprunner.com`

3. **Check CloudWatch Logs**:
   - Lambda logs should show: `[WebSocket] Route: $connect, ConnectionId: xxx`
   - Backend logs should show: `[WS] Message from xxx`

### Timeout Values to Verify

| Component | Expected Timeout | Configuration |
|-----------|-----------------|---------------|
| API Gateway | 10 minutes (600s) | Default idle timeout |
| Lambda | 29 seconds | Function timeout |
| Client ping | 30 seconds | Ping interval |
| Client connection | 20 seconds | Connection timeout |

### CloudWatch Logs to Check

1. **API Gateway Access Logs**:
   - Monitor WebSocket connection lifecycle
   
2. **Lambda Function Logs**:
   
```
   [WebSocket] Route: $connect, ConnectionId: xxx
   [WebSocket] Connected: xxx, Session: xxx
   [WebSocket] Message from xxx: { type: 'command' }
   
```

3. **App Runner Logs**:
   
```
   [WS] Message from xxx: { type: 'command' }
   [Terminal] Executing: ls -la
   
```

## 8. Troubleshooting

### Still Getting 1006?

1. **Verify URL**: Check browser network tab - are you connecting to API Gateway, not App Runner?

2. **Check Lambda**: Is the Lambda function being invoked? Check CloudWatch.

3. **Verify CORS**: If seeing CORS errors, configure CORS in API Gateway.

4. **Check Idle Timeout**: API Gateway defaults to 10 minutes. If you need longer, consider:
   - Implementing ping/pong every 30 seconds
   - Using AWS WSS WebSockets (more expensive but longer timeouts)

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | Missing/invalid JWT token | Verify token is passed in query string |
| 500 Internal Server | Lambda error | Check CloudWatch logs |
| 1006 Abnormal Closure | Server closed connection | Check Lambda and App Runner logs |
| Connection Timeout | Network/permission issue | Check security groups, VPC settings |

## Summary

The fix involves:
1. **Using API Gateway WebSocket API** instead of direct App Runner WebSocket
2. **Lambda as the connection manager** that forwards messages to App Runner via HTTPS
3. **App Runner handles only HTTP** (no WebSocket handling)
4. **Frontend connects to API Gateway** with JWT in query string

This architecture eliminates 1006 errors because:
- API Gateway is designed for WebSocket connections
- Lambda manages connections with proper timeouts
- App Runner only handles short-lived HTTP requests
- The infrastructure properly supports long-lived connections
