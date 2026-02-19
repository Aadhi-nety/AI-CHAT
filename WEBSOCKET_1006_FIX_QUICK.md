# WebSocket 1006 Error - Quick Fix & Verification

## 🔴 Issue Found & Fixed

### Critical Problem Discovered:
**The HTTP polling routes were NOT mounted in the backend!**

```typescript
// ❌ BEFORE (Routes imported but never used)
import websocketRoutes from "./routes/websocket.routes";
app.use(express.json());
// Missing: app.use("/api/ws", websocketRoutes);

// ✅ AFTER (Routes properly mounted)
import websocketRoutes from "./routes/websocket.routes";
app.use(express.json());
app.use("/api/ws", websocketRoutes);  // NOW PROPERLY MOUNTED
```

**Impact**: The frontend couldn't reach `/api/ws/status` or `/api/ws/message` endpoints!

---

## ✅ What Was Fixed

### 1. **Backend Routes Now Mounted**
- `POST /api/ws/message` - Execute terminal commands
- `GET /api/ws/status/:sessionId` - Poll for connection status  
- `GET /api/ws/output/:sessionId` - Get terminal output
- `POST /api/ws/disconnect` - Handle disconnections
- `POST /api/ws/broadcast` - Broadcast messages

### 2. **Documentation Created**
- [WEBSOCKET_1006_SOLUTION.md](WEBSOCKET_1006_SOLUTION.md) - Complete troubleshooting guide
- [TEST_FILES_DEPRECATED.md](TEST_FILES_DEPRECATED.md) - Why old test files don't work

### 3. **Environment Configuration**
You need to set these environment variables in Vercel:

```
NEXT_PUBLIC_API_URL=https://2rrfaahu3d.ap-south-1.awsapprunner.com
```

---

## 🧪 Quick Verification

### Step 1: Verify Backend Routes Exist
```bash
# Test health check
curl https://2rrfaahu3d.ap-south-1.awsapprunner.com/health

# Expected response:
# {"status":"ok","timestamp":..., "endpoints":[...]}
```

### Step 2: Verify Environment Variable is Set
In Vercel Project Settings → Environment Variables, confirm:
```
NEXT_PUBLIC_API_URL=https://2rrfaahu3d.ap-south-1.awsapprunner.com
```

### Step 3: Rebuild & Deploy
```bash
# Redeploy to Vercel to pick up the environment variable
vercel deploy --prod
```

### Step 4: Test in Browser
1. Go to your app
2. Login with any email/password
3. Click "Start Lab"
4. Open F12 (Developer Console)
5. You should see:
   ```
   [Terminal HTTP] Connecting to https://... for session abc123
   [Terminal HTTP] Connected in XXXms
   ```
6. You should NOT see:
   ```
   ❌ WebSocket connection to 'wss://...' failed
   ❌ Abnormal closure (1006)
   ❌ Error: Session not found
   ```

---

## 📊 How HTTP Polling Works


```
Frontend (Browser)
  ↓
User types command: "aws s3 ls"
  ↓
POST /api/ws/message {command: "aws s3 ls", sessionId: "xyz"}
  ↓
App Runner executes command
  ↓
Returns: {type: "output", data: "bucket1\nbucket2\n"}
  ↓
Frontend polls: GET /api/ws/status/xyz
  ↓
Frontend updates display with output
  ↓
Repeat every 1 second (configurable)
```

**Latency**: ~1000ms per command (due to 1-second polling interval)  
**Can be improved**: Reduce `POLL_INTERVAL` in [hooks/use-terminal-http.ts](hooks/use-terminal-http.ts#L46)

---

## 🐛 If You Still See Errors

### Error: "Session not found"
1. Check NEXT_PUBLIC_API_URL is set correctly
2. Make sure you went through full login → start lab flow
3. Check browser console for the exact error

### Error: "Connection timeout"
1. Verify App Runner is running: `curl https://2rrfaahu3d.ap-south-1.awsapprunner.com/health`
2. Check if backend restarted recently
3. Wait a few moments and retry if App Runner is starting up

### Error: "Failed to connect after 5 attempts"
1. Ensure NEXT_PUBLIC_API_URL doesn't have trailing slash
2. Clear browser cache: `Ctrl+Shift+Delete`
3. Try in incognito window
4. Check if there's a firewall/proxy blocking HTTPS

### Still See WebSocket Errors
1. Search your code for `useTerminal(` usage (should be `useTerminalHttp`)
2. Search for `new WebSocket(` (should use HTTP polling instead)
3. Search for `wss://` (should NOT match awsapprunner.com)

Run these searches:
```bash
grep -r "useTerminal(" app/          # Wrong if found
grep -r "useTerminalHttp" app/       # Correct usage
grep -r "awsapprunner.com" app/      # Should NOT find wss://
```

---

## 📈 Monitoring

After the fix, you should notice:
- ✅ No more WebSocket 1006 errors
- ✅ Commands execute successfully
- ✅ Terminal output appears (with ~1s delay)
- ✅ Can run multiple commands in sequence
- ✅ Session stays active for full duration

---

## 🎯 Next Steps

1. **Deploy the backend code**
   ```bash
   cd backend
   npm run build  # if applicable
   # Deploy to App Runner via your CI/CD or manual push
   ```

2. **Set environment variable in Vercel**
   - Project Settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_URL=https://2rrfaahu3d.ap-south-1.awsapprunner.com`

3. **Redeploy frontend**
   ```bash
   vercel deploy --prod
   ```

4. **Test end-to-end**
   - Login → Start Lab → Execute command
   - Check no errors in console

5. **Monitor in production**
   - Check App Runner logs for any errors
   - Monitor terminal command execution

---

## 📝 Summary of Changes

| File | Change | Reason |
|------|--------|--------|
| backend/src/server.ts | Added `app.use("/api/ws", websocketRoutes)` | Routes were imported but never mounted! |
| WEBSOCKET_1006_SOLUTION.md | Created new | Complete troubleshooting guide |
| TEST_FILES_DEPRECATED.md | Created new | Document why old WebSocket tests fail |

---

**Issue Status**: ✅ FIXED - HTTP polling routes now accessible  
**Date Fixed**: February 18, 2026  
**Requires**: Backend redeploy + environment variable configuration
