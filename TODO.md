# WebSocket 1006 Fix - Implementation TODO

## Overview
Fix persistent WebSocket 1006 (abnormal closure) errors by implementing AWS API Gateway WebSocket architecture.

## Root Cause
AWS App Runner does NOT support long-lived WebSocket connections. The ~25s timeout and 1006 errors are caused by App Runner's underlying ALB/ECS infrastructure closing idle connections.

## Solution Architecture
```
Browser → API Gateway (WebSocket) → Lambda → App Runner (HTTP only)
```

---

## TODO Items

### Phase 1: AWS Infrastructure Setup

- [ ] 1.1 Create DynamoDB table `WebSocketConnections`
  - Partition key: `connectionId` (String)
  - Enable TTL on `expiresAt`

- [ ] 1.2 Create Lambda function `websocket-handler`
  - Runtime: Node.js 18.x
  - Use existing Lambda execution role (due to IAM restrictions)
  - Code: Use `lambda/websocket-handler.js`
  - Environment variables:
    - `TABLE_NAME`: WebSocketConnections
    - `APP_RUNNER_URL`: Your App Runner HTTPS URL
    - `JWT_SECRET`: Your JWT secret
    - `DOMAIN_NAME`: {api-id}.execute-api.{region}.amazonaws.com
    - `STAGE`: prod

- [ ] 1.3 Create API Gateway WebSocket API
  - API name: TerminalWebSocketAPI
  - Routes: $connect, $disconnect, $default
  - Integration: Lambda function
  - Deploy to stage: prod

- [ ] 1.4 Note the WebSocket URL
  - Format: wss://{api-id}.execute-api.{region}.amazonaws.com/prod

### Phase 2: Backend Updates (App Runner)

- [ ] 2.1 Add WebSocket message endpoint
  - POST /api/ws/message
  - Handle: ping, command, resize
  - Return: JSON responses

- [ ] 2.2 Add disconnect notification endpoint
  - POST /api/ws/disconnect
  - Cleanup terminal sessions

- [ ] 2.3 Test endpoints locally

### Phase 3: Frontend Updates

- [ ] 3.1 Update environment variables
  - NEXT_PUBLIC_WS_URL: wss://{api-id}.execute-api.{region}.amazonaws.com/prod
  - Remove any direct App Runner WebSocket URLs

- [ ] 3.2 Update terminal component to use useTerminalApiGateway hook
  - Or ensure existing hook passes correct URL

- [ ] 3.3 Test WebSocket connection

### Phase 4: Validation

- [ ] 4.1 Verify 1006 errors are gone
  - Check browser console
  - Should connect to API Gateway, not App Runner

- [ ] 4.2 Check CloudWatch logs
  - Lambda: Connection lifecycle
  - App Runner: Message handling

- [ ] 4.3 Test timeout behavior
  - Should maintain connection > 10 minutes (API Gateway limit)

---

## Current Status: Awaiting AWS IAM Permission Fix

The user is blocked by IAM permission error:
```
User is not authorized to perform: iam:CreateRole 
with an explicit deny in identity-based policy
```

### Workaround Options:
1. **Use existing Lambda execution role** - Select existing role during Lambda creation
2. **Request admin assistance** - Ask AWS admin to create role manually
3. **Use pre-built solution** - Deploy from AWS Serverless Application Repository

---

## Files Reference

| File | Purpose |
|------|---------|
| `lambda/websocket-handler.js` | Lambda function code (ready to use) |
| `hooks/use-terminal-api-gateway.ts` | Frontend hook for API Gateway (ready to use) |
| `WEBSOCKET_1006_FIX_COMPLETE.md` | Complete implementation guide |
| `AWS_API_GATEWAY_WEBSOCKET_SETUP.md` | Original setup documentation |

---

## Notes

- App Runner should NOT handle WebSockets directly
- Lambda forwards messages to App Runner via HTTPS
- Frontend connects to API Gateway, not App Runner
- JWT token passed via query string parameters
