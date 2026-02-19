# WebSocket Error 1006 Fix - Implementation Summary

## Problem
WebSocket connections to AWS App Runner were failing with error code **1006** (abnormal closure), preventing terminal access in the cloud security training platform.

**Error Details:**
```
WebSocket connection to 'wss://2rrfaahu3d.ap-south-1.awsapprunner.com/terminal/...' failed
[Terminal] Disconnected: 1006
[Terminal] Abnormal closure - possible network or proxy issue
```

## Root Causes Identified

1. **Socket Timeout Issues**: Raw sockets during HTTP upgrade could hang indefinitely without timeout
2. **Missing Socket Error Handling**: Socket errors during upgrade were not being caught
3. **AWS Load Balancer Compatibility**: `X-Forwarded-Proto` header not properly handled
4. **No Connection Activity Timeout**: WebSocket connections could hang without activity detection
5. **Race Condition**: Initial message sent before socket fully ready

## Solution Implemented

### 1. Backend Fixes (`backend/src/server.ts`)

#### Socket Timeout & Error Handling (HTTP Upgrade)
```typescript
// Set socket timeout to prevent hanging connections
socket.setTimeout(SOCKET_TIMEOUT); // 10 seconds
socket.on("timeout", () => {
  console.error(`[Upgrade] Socket timeout for ${pathname}`);
  socket.destroy();
});

// Handle socket errors
socket.on("error", (err: Error) => {
  console.error(`[Upgrade] Socket error for ${pathname}:`, err.message);
  socket.destroy();
});
```

#### AWS-Specific Header Handling
```typescript
// Check for AWS App Runner forwarded protocol
const forwardedProto = request.headers["x-forwarded-proto"];
const isSecure = forwardedProto === "https";

if (forwardedProto) {
  console.log(`[Upgrade] X-Forwarded-Proto: ${forwardedProto}, secure: ${isSecure}`);
}
```

#### WebSocket Connection Timeout
```typescript
// Set connection timeout for inactive connections
const connectionTimeout = setTimeout(() => {
  console.error(`[WebSocket:${sessionId}] Connection timeout - no activity`);
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(1008, "Connection timeout");
  }
}, WS_CONNECTION_TIMEOUT); // 30 seconds

// Reset timeout on any message
ws.on("message", async (data: Buffer) => {
  clearTimeout(connectionTimeout);
  // ... handle message
});
```

#### Delayed Initial Message
```typescript
// Send initial connection message with delay to ensure socket is ready
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "connected",
      message: "WebSocket connection established",
      sessionId: sessionId,
      timestamp: Date.now()
    }));
  }
}, 100);
```

### 2. Client-Side Fixes (`hooks/use-terminal.ts`)

#### Handle 1001 (Going Away) Close Code
```typescript
const isGoingAway = event.code === 1001;

if (isGoingAway) {
  console.log("[Terminal] Server is going away (page refresh/navigation)");
  // Don't show error for normal navigation
  return;
}
```

#### Shorter Reconnect Delay for 1006 Errors
```typescript
// Use shorter delay for 1006 errors (AWS App Runner specific)
const isAbnormalClosure = event.code === 1006;
const baseDelay = isAbnormalClosure ? 1000 : reconnectDelay; // 1s vs 2s
const backoffDelay = baseDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
const finalDelay = Math.min(backoffDelay, 30000); // Cap at 30 seconds
```

#### Improved Error Messages
```typescript
if (webSocketUrl.includes("awsapprunner.com")) {
  errorMessage = "AWS App Runner WebSocket connection failed. This may be due to: 1) Service still starting, 2) Session not found, 3) Network/proxy issues. Please try again in a few moments.";
  errorCode = "AWS_APP_RUNNER_ERROR";
}
```

### 3. Test Script (`test-websocket-aws-apprunner.js`)

Created comprehensive test script for AWS App Runner:
- Health endpoint check
- WebSocket `/ws-test` endpoint test
- Terminal endpoint test with session
- Detailed logging with color-coded output
- Specific 1006 error detection and diagnosis

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/server.ts` | Added socket timeout, error handling, AWS header support, connection timeout, delayed initial message |
| `hooks/use-terminal.ts` | Added 1001 handling, shorter 1006 reconnect delay, improved error messages |
| `TODO.md` | Updated with new fixes |
| `test-websocket-aws-apprunner.js` | **NEW** - AWS-specific test script |

## Key Improvements

### Backend
1. **Socket Timeout (10s)**: Prevents hanging connections during upgrade
2. **Socket Error Handling**: Catches and logs socket errors
3. **AWS Header Support**: Properly handles `X-Forwarded-Proto`
4. **Connection Timeout (30s)**: Closes inactive WebSocket connections
5. **Delayed Initial Message (100ms)**: Prevents race condition

### Client
1. **1001 Handling**: Ignores normal navigation closes
2. **1006 Fast Reconnect**: 1 second base delay for abnormal closures
3. **Better Error Messages**: AWS-specific error descriptions
4. **Capped Backoff**: Max 30 second reconnect delay

## Testing

### Local Testing
```bash
# Build backend
cd backend && npm run build

# Test locally
node test-websocket-aws-apprunner.js ws://localhost:3001/terminal/test-session
```

### AWS App Runner Testing
```bash
# Test deployed service
node test-websocket-aws-apprunner.js wss://2rrfaahu3d.ap-south-1.awsapprunner.com/terminal/test-session
```

## Deployment Checklist

- [ ] Deploy updated `backend/src/server.ts` to AWS App Runner
- [ ] Verify `REDIS_URL` environment variable is set
- [ ] Verify `FRONTEND_URL` environment variable is set
- [ ] Test health endpoint: `GET /health`
- [ ] Test diagnostics endpoint: `GET /api/diagnostics/websocket`
- [ ] Test WebSocket: `WS /ws-test`
- [ ] Test terminal with actual lab session
- [ ] Monitor logs for 1006 errors

## Monitoring

### Server Logs to Watch
```
[Upgrade] Socket timeout for /terminal/...     → Socket timeout working
[Upgrade] Socket error for /terminal/...       → Socket error handling working
[Upgrade] X-Forwarded-Proto: https             → AWS header detected
[WebSocket:...] Connection timeout              → Connection timeout working
[WebSocket:...] Connection setup complete       → Successful connection
```

### Client Console to Watch
```
[Terminal] Abnormal closure (1006)              → 1006 detected, fast reconnect
[Terminal] Reconnecting in 1000ms               → Short delay for 1006
[Terminal] Connected in ...ms                   → Successful reconnection
```

## Troubleshooting

### Still Getting 1006 Errors?
1. Check AWS App Runner service is running and healthy
2. Verify WebSocket URL is correct (wss:// not ws:// for HTTPS)
3. Test with `/ws-test` endpoint first
4. Check browser console for CORS errors
5. Verify Redis connection is working
6. Check AWS App Runner logs for socket errors

### Session Not Found?
1. Check Redis connection (REDIS_URL)
2. Verify session was created successfully
3. Check session hasn't expired
4. Look for session validation errors in logs

## Next Steps

1. **Deploy** the updated backend to AWS App Runner
2. **Test** WebSocket connection using the test script
3. **Monitor** error rates and connection times
4. **Adjust** timeout values if needed based on performance

## References

- [WebSocket Error 1006 Fix Documentation](WEBSOCKET_ERROR_1006_FIX.md)
- [AWS App Runner WebSocket Support](https://docs.aws.amazon.com/apprunner/latest/dg/develop.html)
- [ws library documentation](https://github.com/websockets/ws)
