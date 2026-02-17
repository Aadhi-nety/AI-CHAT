# WebSocket Connection Fix - TODO

## Tasks

### 1. Enhanced WebSocket Error Logging ✅ COMPLETED
- [x] Add detailed logging in `backend/src/server.ts` for WebSocket connection attempts
- [x] Log origin, session ID, and specific failure reasons
- [x] Add connection attempt counter and timing information

**Changes made:**
- Added client IP and origin logging
- Added request headers logging for debugging
- Added connection timing measurements
- Added detailed error logging with error codes and stack traces
- Added session validation success logging

### 2. Fix CORS for WebSocket Connections ✅ COMPLETED
- [x] Update CORS configuration in `backend/src/server.ts` to allow WebSocket upgrade requests
- [x] Add proper handling for WebSocket-specific headers
- [x] Allow dynamic origins based on environment

**Changes made:**
- Implemented dynamic CORS origin checking
- Added support for `FRONTEND_URL` environment variable
- Added WebSocket-specific headers (`Upgrade`, `Connection`)
- Added localhost development origins
- Added CORS blocking warnings for debugging

### 3. Improve Session Validation ✅ COMPLETED
- [x] Add detailed logging in `lab-session.service.ts` for session lookup failures
- [x] Ensure session expiry check is accurate with timezone handling
- [x] Add session creation timestamp logging

**Changes made:**
- Added `getActiveSessionIds()` method to list active sessions
- Enhanced session not found logging with active session list
- Added ISO timestamp formatting for better readability
- Added session validation success logging with expiry countdown
- Added total active sessions count logging

### 4. Fix AWS Region Configuration ✅ COMPLETED
- [x] Update `backend/src/server.ts` to use the correct region from environment or session
- [x] Ensure credentials include the correct region (ap-south-1)
- [x] Add region validation and logging

**Changes made:**
- Added `region` field to `SandboxAccount` interface
- Updated `createSandboxAccount()` to accept region parameter (default: ap-south-1)
- Updated terminal instance creation to use session region
- Added region logging in server startup
- Changed default region from us-east-1 to ap-south-1

### 5. Add WebSocket Connection Diagnostics ✅ COMPLETED
- [x] Create a diagnostic endpoint to test WebSocket connectivity
- [x] Add connection health checks in the frontend
- [x] Implement better error messages for users

**Changes made:**
- Added `/api/diagnostics/websocket` endpoint
- Added `ConnectionDiagnostics` interface to frontend
- Added diagnostics state tracking in `useTerminal` hook
- Added connection time tracking
- Added specific error messages for different failure scenarios

### 6. Update Frontend Error Handling ✅ COMPLETED
- [x] Improve error messages in `hooks/use-terminal.ts`
- [x] Add connection timeout handling with better UX
- [x] Show specific failure reasons to users

**Changes made:**
- Added specific error messages for:
  - Max reconnection attempts reached
  - Offline/network connectivity issues
  - Mixed content errors (HTTP vs HTTPS)
- Added connection attempt logging with attempt numbers
- Added connection time measurement
- Improved error messages with close codes
- Added diagnostics return value for UI display

## Summary of Changes

### Files Modified:
1. `backend/src/server.ts` - Enhanced logging, CORS, region handling, diagnostics endpoint
2. `backend/src/services/lab-session.service.ts` - Better session validation logging
3. `backend/src/services/aws-control-tower.service.ts` - Region support in sandbox accounts
4. `hooks/use-terminal.ts` - Improved error handling and diagnostics

### Key Improvements:
- **Better Debugging**: Detailed logs for connection attempts, session validation, and errors
- **CORS Flexibility**: Dynamic origin checking with environment variable support
- **Region Support**: Proper ap-south-1 region handling throughout the stack
- **User Experience**: Specific error messages and connection diagnostics
- **Reliability**: Enhanced error handling and reconnection logic

## Testing Checklist
- [ ] Test WebSocket connection from Vercel deployment
- [ ] Verify CORS allows the frontend origin
- [ ] Check that ap-south-1 region is used correctly
- [ ] Verify session creation and validation logging
- [ ] Test error scenarios (offline, invalid session, etc.)
- [ ] Verify diagnostics endpoint returns correct data

## Progress Tracking
- Started: 2024
- Current Task: Testing and verification
- Completed Tasks: 6/6 ✅
- Status: **READY FOR TESTING**
