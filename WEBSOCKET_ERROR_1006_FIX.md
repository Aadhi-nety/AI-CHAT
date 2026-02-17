# WebSocket Error 1006 Fix - Complete Solution

## Problem
WebSocket connections to AWS App Runner were failing with error code 1006 (abnormal closure), preventing terminal access in the cloud security training platform.

## Root Causes Identified

1. **AWS App Runner WebSocket Limitations**: AWS App Runner has limited WebSocket support and requires explicit HTTP server configuration
2. **Missing WebSocket Headers**: CORS configuration didn't include WebSocket-specific headers
3. **No Connection Timeout**: Sessions could hang indefinitely during validation
4. **Poor Error Handling**: Error messages weren't reaching clients before connection close
5. **Client-Side Timeout**: No client-side timeout mechanism

## Solution Implemented

### 1. Backend Changes (backend/src/server.ts)

#### HTTP Server Wrapper
```typescript
// Create HTTP server first (required for proper WebSocket support)
const server = http.createServer(app);

// Initialize express-ws with the HTTP server
const { app: wsApp } = expressWs(app, server);
```

#### Enhanced CORS Configuration
```typescript
const corsOptions = {
  origin: (origin, callback) => { /* ... */ },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "Upgrade", 
    "Connection", 
    "Sec-WebSocket-Key", 
    "Sec-WebSocket-Version", 
    "Sec-WebSocket-Extensions"
  ],
  exposedHeaders: ["Upgrade", "Connection"],
  credentials: true,
  maxAge: 86400
};
```

#### Connection Timeout (30 seconds)
```typescript
const WS_CONNECTION_TIMEOUT = 30000;

// In WebSocket handler:
const connectionTimeout = setTimeout(() => {
  console.error(`[Terminal:${sessionId}] Connection timeout`);
  ws.close(1008, "Connection timeout");
}, WS_CONNECTION_TIMEOUT);
```

#### WebSocket Test Endpoint
Added `/ws-test` endpoint for connectivity verification:
```typescript
wsApp.ws("/ws-test", (ws, req) => {
  ws.on("message", (msg) => {
    ws.send(JSON.stringify({
      type: "echo",
      received: JSON.parse(msg),
      timestamp: Date.now()
    }));
  });
});
```

#### Improved Error Handling
- Check WebSocket readyState before sending error messages
- Add delay before closing connection to ensure message delivery
- Better logging with connection timing information

### 2. Client-Side Changes (hooks/use-terminal.ts)

#### Connection Timeout (25 seconds)
```typescript
const CONNECTION_TIMEOUT = 25000;

connectionTimeoutRef.current = setTimeout(() => {
  if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
    ws.current.close(1008, "Client connection timeout");
  }
  setError(new Error("Connection timeout - no response from server"));
}, CONNECTION_TIMEOUT);
```

#### Enhanced Error Codes
Added specific error codes for better debugging:
- `CONNECTION_FAILED` - General connection failure
- `MAX_RETRIES_EXCEEDED` - All reconnection attempts failed
- `OFFLINE` - Browser is offline
- `MIXED_CONTENT` - HTTP/HTTPS mismatch
- `AWS_APP_RUNNER_ERROR` - AWS App Runner specific issues
- `SESSION_INVALID` - Session expired or not found
- `CONNECTION_TIMEOUT` - Server or client timeout
- `WEBSOCKET_CREATION_FAILED` - Failed to create WebSocket instance

#### Better Diagnostics
```typescript
interface ConnectionDiagnostics {
  url: string;
  attempts: number;
  lastError?: string;
  connectionTime?: number;
  errorCode?: string;  // NEW: Added error code tracking
}
```

#### Specific Close Code Handling
```typescript
const isInvalidSession = event.code === 4000;
const isServerError = event.code >= 4500;
const isConnectionTimeout = event.code === 1008;
const isAbnormalClosure = event.code === 1006;

if (isAbnormalClosure) {
  console.error("[Terminal] Abnormal closure - possible network or proxy issue");
  // Still attempt to reconnect
}
```

## Testing

### WebSocket Test Endpoint
Test connectivity using:
```javascript
const ws = new WebSocket('wss://your-app-runner-url/ws-test');
ws.onopen = () => ws.send(JSON.stringify({test: "message"}));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

### Health Check Endpoint
```bash
curl https://your-app-runner-url/health
# Returns: { status: "ok", websocket: "available", endpoints: [...] }
```

### Diagnostics Endpoint
```bash
curl https://your-app-runner-url/api/diagnostics/websocket
# Returns detailed WebSocket configuration
```

## Deployment Checklist

- [ ] Update AWS App Runner environment variables
- [ ] Ensure REDIS_URL is configured for session storage
- [ ] Verify CORS origins include your frontend domain
- [ ] Test WebSocket connection using /ws-test endpoint
- [ ] Check health endpoint returns 200 OK
- [ ] Verify session validation endpoint works
- [ ] Test terminal connection with actual lab session

## Environment Variables Required

```bash
# Required
REDIS_URL=redis://default:password@your-upstash-endpoint:6379
PORT=3001

# Optional but recommended
FRONTEND_URL=https://your-frontend-domain.vercel.app
AWS_REGION=ap-south-1
NODE_ENV=production
```

## Monitoring & Debugging

### Server Logs
Watch for these log patterns:
```
[Terminal] New connection attempt: <sessionId>
[Terminal] Session found for <sessionId>
[Terminal:<sessionId>] Connection established successfully in <time>ms
[Terminal:<sessionId>] Pong received
```

### Client Console
Watch for these messages:
```
[Terminal] Connecting to <url> (attempt 1/5)
[Terminal] Connected in <time>ms
[Terminal] Session validation successful
```

### Error Patterns
- `1006` - Abnormal closure (network/proxy issue)
- `1008` - Connection timeout
- `4000` - Invalid session
- `CONNECTION_TIMEOUT` - Client-side timeout

## Troubleshooting

### Issue: Still getting 1006 errors
1. Check AWS App Runner service is running
2. Verify WebSocket endpoint URL is correct
3. Test with /ws-test endpoint first
4. Check browser console for CORS errors
5. Verify Redis connection is working

### Issue: Session not found
1. Check Redis connection (REDIS_URL)
2. Verify session was created successfully
3. Check session hasn't expired
4. Look for session validation errors in logs

### Issue: Connection timeout
1. Increase timeout values if needed
2. Check server response time
3. Verify session lookup isn't hanging
4. Check Redis latency

## Files Modified

1. `backend/src/server.ts` - Enhanced WebSocket server
2. `hooks/use-terminal.ts` - Improved client-side handling
3. `TODO.md` - Task tracking
4. `WEBSOCKET_ERROR_1006_FIX.md` - This documentation

## Next Steps

1. Deploy updated backend to AWS App Runner
2. Test WebSocket connection with /ws-test
3. Verify terminal functionality with actual lab
4. Monitor error rates and connection times
5. Adjust timeout values if needed based on performance
