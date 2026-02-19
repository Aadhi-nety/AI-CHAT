# WebSocket 1006 Error - Complete Solution Guide

## ⚠️ Error You're Seeing

```
Connection error: AWS App Runner WebSocket connection failed. This may be due to: 
1) Service still starting, 2) Session not found, 3) Network issues. 
Failed to connect after 5 attempts. Last close code: 1006.
```

## 🔍 Root Cause Analysis

**Error 1006 (Abnormal Closure)** occurs because **AWS App Runner does NOT support long-lived WebSocket connections**. 

### Why It Happens:
1. **App Runner Load Balancer** has a 60-second idle timeout
2. **ECS task timeouts** terminate hanging connections  
3. **Health checks** interfere with persistent connections
4. **No WebSocket protocol support** in App Runner's networking layer

### Why Retries Don't Work:
- Each connection attempt hits the same infrastructure limitation
- App Runner kills connections that stay open too long
- Retrying doesn't fix the underlying timeout issue

---

## ✅ The Correct Solution

Your application **already has the correct fix implemented**:

### Current Architecture (Working ✓):
```
Frontend (HTTP Polling) 
  ↓
uses: useTerminalHttp hook  
  ↓
Sends: POST /api/ws/message {command}
Gets:  GET /api/ws/status/{sessionId}
  ↓
App Runner HTTP API (Fast Request/Response)
  ↓
Terminal Execution & Output
```

### Why This Works:
- ✅ App Runner optimized for **short HTTP requests** (milliseconds)
- ✅ No idle timeout issues
- ✅ Polling adds minimal latency (1-second polls)
- ✅ Automatic reconnection built-in
- ✅ Compatible with AWS infrastructure

---

## 🔧 Configuration Required

### 1. **Environment Variables** (Critical!)

Set these in your **Vercel deployment settings**:

```bash
# REQUIRED - App Runner backend URL
NEXT_PUBLIC_API_URL=https://2rrfaahu3d.ap-south-1.awsapprunner.com

# Optional - Only if using API Gateway WebSocket (not recommended for this setup)
# NEXT_PUBLIC_WS_API_URL=wss://{api-id}.execute-api.{region}.amazonaws.com/prod
```

### 2. **Backend Health Check**

Verify your backend `/health` endpoint:
```bash
curl https://2rrfaahu3d.ap-south-1.awsapprunner.com/health
```

Expected response:
```json
{
  "status": "ok",
  "websocket": "available",
  "port": 3001,
  "environment": "production"
}
```

### 3. **Required Backend Endpoints**

Your App Runner must expose these HTTP routes:

```
✓ GET    /health                          - Health check
✓ POST   /api/labs/start                  - Create session
✓ GET    /api/labs/session/:sessionId     - Get session
✓ GET    /api/ws/status/:sessionId        - Poll connection status
✓ POST   /api/ws/message                  - Send command
✓ GET    /api/ws/output/:sessionId        - Get terminal output
```

Check [backend/src/server.ts](backend/src/server.ts) has all routes defined.

---

## 🚫 What NOT To Do

### ❌ The Old Broken Approach (Do NOT Use)

```typescript
// BROKEN - Will fail with 1006 error
const ws = new WebSocket('wss://2rrfaahu3d.ap-south-1.awsapprunner.com/terminal/sessionId');

// BROKEN - Will also fail with 1006 error  
import { useTerminal } from '@/hooks/use-terminal';
const { isConnected } = useTerminal('wss://your-apprunner-url/terminal');
```

### ✅ The Correct Approach (What To Use)

```typescript
// CORRECT - Uses HTTP polling
import { useTerminalHttp } from '@/hooks/use-terminal-http';
const { isConnected, executeCommand } = useTerminalHttp(
  'https://2rrfaahu3d.ap-south-1.awsapprunner.com',
  sessionId
);
```

---

## 🐛 Troubleshooting Checklist

### Issue: Still seeing "AWS App Runner WebSocket connection failed"

**Check 1: Is code still using WebSocket?**
```bash
# Search for direct WebSocket usage
grep -r "useTerminal(" app/  # Should NOT find this except in old files
grep -r "new WebSocket" app/ # Should be EMPTY
grep -r "wss://" app/        # Should NOT match awsapprunner.com

# Correct usage:
grep -r "useTerminalHttp" app/ # Should find lab page
```

**Check 2: Environment variables set?**
```bash
# In Vercel Console or local .env.local:
echo $NEXT_PUBLIC_API_URL
# Should output: https://2rrfaahu3d.ap-south-1.awsapprunner.com
```

**Check 3: Backend is running?**
```bash
curl https://2rrfaahu3d.ap-south-1.awsapprunner.com/health
# Should return { "status": "ok", ... }
```

**Check 4: Session being created properly?**
```bash
# After starting a lab, check logs:
# 1. Frontend console (F12) - should show useTerminalHttp connecting
# 2. App Runner logs - should show POST /api/labs/start success
# 3. No "WebSocket" connection attempts in console
```

### Issue: "Session not found" error

**Solution:**
1. Make sure `NEXT_PUBLIC_API_URL` is correctly set
2. Verify session is being created at `/api/labs/start`
3. Check if session expires too quickly (default: 1 hour)
4. Clear localStorage: `localStorage.clear()` and start fresh

### Issue: Commands not executing

**Solution:**
1. Check `/api/ws/status/{sessionId}` endpoint returns `terminalActive: true`
2. Verify AWS credentials are being passed to terminal
3. Check backend logs for command execution errors
4. Ensure Redis is connected (if using session store)

---

## 📊 Expected Behavior

### Correct Connection Flow:
1. User logs in
2. Clicks "Start Lab"
3. `POST /api/labs/start` creates session
4. Frontend gets session ID
5. Navigates to lab page
6. `useTerminalHttp` connects via HTTP polling (no WebSocket!)
7. User types command
8. `POST /api/ws/message` sends command
9. `GET /api/ws/status` polls for output
10. Terminal output displayed (1-second latency)

### What You Should See in Console:
```
[Terminal HTTP] Connecting to https://2rrfaahu3d.ap-south-1.awsapprunner.com for session abc123
[Terminal HTTP] Connected in 150ms
[Terminal HTTP] Polling for messages...
$ your-command
[output shown]
```

### What You Should NOT See:
```
❌ WebSocket connection to 'wss://...' failed
❌ Abnormal closure (1006)
❌ Connection timeout error
❌ wss:// anywhere in console for awsapprunner.com
```

---

## 🔄 Architecture Decision Tree

### Should I use WebSocket?
```
Are you deploying to AWS App Runner? 
  └─→ YES  → NO, use HTTP polling (useTerminalHttp)
  └─→ NO   → Maybe, depends on infrastructure
```

### Should I use API Gateway WebSocket?
```
Do you need true WebSocket support over HTTP connection limit?
  └─→ YES  → Consider API Gateway + Lambda (complex setup)
  └─→ NO   → Use HTTP polling (simpler, works for most cases)
```

### Recommended Setup:
```
✅ App Runner + HTTP Polling
✅ API Gateway Lambda + WebSocket (if needed)
❌ App Runner + Direct WebSocket (DO NOT USE)
```

---

## 📝 Implementation Files

These files implement HTTP polling correctly:

- [hooks/use-terminal-http.ts](hooks/use-terminal-http.ts) - HTTP polling hook ✓
- [app/labs/[labId]/page.tsx](app/labs/[labId]/page.tsx) - Lab page using HTTP ✓
- [backend/src/routes/websocket.routes.ts](backend/src/routes/websocket.routes.ts) - Backend routes ✓

These files use old WebSocket approach and should NOT be used:

- [hooks/use-terminal.ts](hooks/use-terminal.ts) - Old WebSocket hook (deprecated)
- [test-websocket-aws-apprunner.js](test-websocket-aws-apprunner.js) - Test file (old)
- [lambda/websocket-handler.js](lambda/websocket-handler.js) - Lambda handler (optional)

---

## 🚀 Quick Start to Fix This

### Step 1: Verify Environment Variable
```bash
# In Vercel project settings, add:
NEXT_PUBLIC_API_URL=https://2rrfaahu3d.ap-south-1.awsapprunner.com
```

### Step 2: Remove Old Test Files (Optional)
```bash
rm test-websocket-aws-apprunner.js
rm test-websocket-comprehensive.js
# Keep others for reference
```

### Step 3: Verify Backend is Accessible
```bash
curl https://2rrfaahu3d.ap-south-1.awsapprunner.com/health
```

### Step 4: Clear Browser Cache
```bash
# F12 → Application → Clear Site Data
# Or use incognito window
```

### Step 5: Test Lab Flow
1. Navigate to `/`
2. Login with any email/password
3. Click "Start Lab"
4. Verify no WebSocket errors in console
5. Try running a command

---

## ⚡ Performance Notes

### HTTP Polling Performance:
- **Connection establishment**: ~150ms
- **Command latency**: ~1000ms (1-second poll interval)
- **Output update**: Immediate on next poll
- **Network overhead**: ~1KB per poll

### If You Need Lower Latency:
1. Reduce `POLL_INTERVAL` in [hooks/use-terminal-http.ts](hooks/use-terminal-http.ts#L46)
2. Consider API Gateway WebSocket for true WebSocket (complex)
3. Profile actual latency in your use case

---

## 🆘 Still Having Issues?

1. **Check browser console** (F12) for actual error message
2. **Check backend logs** in App Runner console
3. **Verify `NEXT_PUBLIC_API_URL` is set** without typos
4. **Verify network connectivity** - ping the App Runner URL
5. **Try in incognito window** to clear cache
6. **Restart backend service** in App Runner dashboard

---

## 📚 Additional Resources

- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [Why App Runner Doesn't Support WebSocket](https://docs.aws.amazon.com/apprunner/latest/dg/service-runtime-support.html)
- [Alternative: API Gateway WebSocket Setup](AWS_API_GATEWAY_WEBSOCKET_SETUP.md)
- [HTTP Polling vs WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**Last Updated**: February 18, 2026  
**Status**: Production Ready ✓
