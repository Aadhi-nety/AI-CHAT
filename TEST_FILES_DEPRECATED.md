# Deprecated Test Files - DO NOT USE

This directory contains old test files that attempt direct WebSocket connections to AWS App Runner. 
**These will NOT work and will always fail with error code 1006.**

## Why These Files Don't Work

AWS App Runner:
- ❌ Does NOT support long-lived WebSocket connections
- ❌ Terminates idle connections after ~25-60 seconds
- ❌ Not optimized for WebSocket protocol
- ✅ IS optimized for short HTTP requests

## Old Files (Deprecated)

- `test-websocket-aws-apprunner.js` - Tries direct WebSocket (BROKEN)
- `test-websocket-comprehensive.js` - Tries direct WebSocket (BROKEN)  
- `test-websocket-connection.js` - Tries direct WebSocket (BROKEN)
- `test-websocket-error.js` - Tries direct WebSocket (BROKEN)
- `test-websocket-fix.js` - Tries direct WebSocket (BROKEN)
- `test-websocket-thorough.js` - Tries direct WebSocket (BROKEN)

## What To Do Instead

### For Testing Terminal Connection:

```bash
# Test HTTP connectivity to App Runner
curl https://2rrfaahu3d.ap-south-1.awsapprunner.com/health

# Test session creation endpoint
curl -X POST https://2rrfaahu3d.ap-south-1.awsapprunner.com/api/labs/start \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","labId":"lab-1","purchaseId":"test","token":"test"}'

# Test command execution via HTTP polling
curl https://2rrfaahu3d.ap-south-1.awsapprunner.com/api/ws/status/SESSION_ID
```

### For Testing in Application:

1. Start frontend: `npm run dev`
2. Navigate to login page
3. Login with any email/password
4. Click "Start Lab"
5. Check browser console (F12) for connection messages
6. You should see HTTP polling, NOT WebSocket

## Correct Implementation

The correct approach uses the `useTerminalHttp` hook which:
- Sends commands via: `POST /api/ws/message`
- Polls for output via: `GET /api/ws/status/:sessionId`
- Works perfectly with App Runner
- Adds ~1 second latency due to polling interval

See [WEBSOCKET_1006_SOLUTION.md](../WEBSOCKET_1006_SOLUTION.md) for complete guide.

## If You Need WebSocket

If you absolutely need true WebSocket support (rare), use:
1. **API Gateway WebSocket** + Lambda → App Runner (complex)
2. **Different hosting** that supports WebSocket (Heroku, Railway, self-hosted)

See [AWS_API_GATEWAY_WEBSOCKET_SETUP.md](../AWS_API_GATEWAY_WEBSOCKET_SETUP.md) for API Gateway approach.

## Archive Note

These files are kept for reference/history only. 
**Do not run these tests or expect them to work.**

Date archived: February 18, 2026
