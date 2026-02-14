# AWS Labs Platform - API Reference

## Overview

The AWS Labs Platform exposes a REST API for session management and a WebSocket API for terminal access.

**Base URL:** `http://localhost:3001` (development) or your deployed domain

## REST API Endpoints

### 1. Start Lab Session

Create a new lab session and generate sandbox AWS account.

**Endpoint:**
```
POST /api/labs/start
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "user-123",
  "labId": "lab-1-s3",
  "purchaseId": "purchase-456",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Yes | Unique user identifier from Cyberange |
| labId | string | Yes | Lab ID (lab-1-s3, lab-2-iam, etc.) |
| purchaseId | string | Yes | Purchase ID from Cyberange |
| token | string | Yes | JWT token from Cyberange |

**Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "webSocketUrl": "ws://localhost:3001/terminal/550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": 1704067200000,
    "credentials": {
      "accessKeyId": "AKIA...",
      "secretAccessKey": "...",
      "region": "us-east-1"
    }
  }
}
```

**Error Responses:**

400 Bad Request:
```json
{
  "error": "Missing required fields"
}
```

401 Unauthorized:
```json
{
  "error": "Invalid token"
}
```

500 Internal Server Error:
```json
{
  "error": "Failed to create sandbox account"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3001/api/labs/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "labId": "lab-1-s3",
    "purchaseId": "purchase-456",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

### 2. Get Session Details

Retrieve information about an active lab session.

**Endpoint:**
```
GET /api/labs/session/:sessionId
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session ID from start response |

**Response (200 OK):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "labId": "lab-1-s3",
  "status": "active",
  "expiresAt": 1704067200000,
  "credentials": {
    "accessKeyId": "AKIA...",
    "region": "us-east-1"
  }
}
```

**Error Responses:**

404 Not Found:
```json
{
  "error": "Session not found or expired"
}
```

**Example cURL:**
```bash
curl http://localhost:3001/api/labs/session/550e8400-e29b-41d4-a716-446655440000
```

---

### 3. Extend Session

Extend the duration of an active lab session.

**Endpoint:**
```
POST /api/labs/session/:sessionId/extend
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session ID |

**Request Body:**
```json
{
  "minutes": 30
}
```

**Body Parameters:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| minutes | number | 30 | Minutes to extend session |

**Response (200 OK):**
```json
{
  "success": true,
  "newExpiresAt": 1704067200000
}
```

**Error Responses:**

404 Not Found:
```json
{
  "error": "Session not found"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3001/api/labs/session/550e8400-e29b-41d4-a716-446655440000/extend \
  -H "Content-Type: application/json" \
  -d '{"minutes": 30}'
```

---

### 4. End Lab Session

Terminate a lab session and destroy the sandbox AWS account.

**Endpoint:**
```
POST /api/labs/session/:sessionId/end
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session ID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session ended"
}
```

**Error Responses:**

404 Not Found:
```json
{
  "error": "Session not found"
}
```

500 Internal Server Error:
```json
{
  "error": "Failed to destroy sandbox account"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3001/api/labs/session/550e8400-e29b-41d4-a716-446655440000/end
```

---

### 5. Health Check

Check if the backend service is running and healthy.

**Endpoint:**
```
GET /health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": 1704067200000
}
```

**Example cURL:**
```bash
curl http://localhost:3001/health
```

---

## WebSocket API

### Terminal Connection

Connect to real-time terminal for AWS CLI command execution.

**WebSocket URL:**
```
ws://localhost:3001/terminal/:sessionId
```

Or with TLS:
```
wss://your-domain.com/terminal/:sessionId
```

**Message Format:**

#### Client → Server: Command Execution

```json
{
  "type": "command",
  "command": "aws s3 ls"
}
```

#### Client → Server: Terminal Resize

```json
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}
```

#### Server → Client: Connection Established

```json
{
  "type": "connected",
  "message": "Connected to AWS CLI Terminal for lab-1-s3",
  "credentials": {
    "region": "us-east-1"
  }
}
```

#### Server → Client: Command Output

```json
{
  "type": "output",
  "data": "{\"command\":\"aws s3 ls\",\"exitCode\":0,\"stdout\":\"2024-01-01 10:00:00 my-bucket\\n\",\"stderr\":\"\",\"timestamp\":1704067200000}"
}
```

Output data is JSON-stringified containing:
- `command` - Original command
- `exitCode` - Exit code (0 = success)
- `stdout` - Standard output
- `stderr` - Standard error
- `timestamp` - Execution timestamp

#### Server → Client: Error

```json
{
  "type": "error",
  "message": "Session expired"
}
```

**Example JavaScript:**

```javascript
// Connect to terminal
const ws = new WebSocket('ws://localhost:3001/terminal/550e8400-e29b-41d4-a716-446655440000');

// Connection opened
ws.onopen = () => {
  console.log('Connected');
  
  // Execute command
  ws.send(JSON.stringify({
    type: 'command',
    command: 'aws s3 ls'
  }));
};

// Receive messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'output') {
    const result = JSON.parse(message.data);
    console.log('Exit code:', result.exitCode);
    console.log('Output:', result.stdout);
    if (result.stderr) {
      console.error('Error:', result.stderr);
    }
  }
};

// Error handling
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Connection closed
ws.onclose = () => {
  console.log('Disconnected');
};
```

**Example wscat CLI:**

```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c ws://localhost:3001/terminal/550e8400-e29b-41d4-a716-446655440000

# After connecting, type and press Enter:
{"type":"command","command":"aws iam get-user"}
```

---

## Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid parameters or missing fields |
| 401 | Unauthorized | Invalid or expired token |
| 404 | Not Found | Session not found or expired |
| 500 | Server Error | Internal server error |

---

## Authentication

The API validates JWT tokens from Cyberange. Tokens should be included in the request body for POST /api/labs/start.

**Token Validation:**
1. Token is sent to `/api/labs/start`
2. Backend calls Cyberange API to validate
3. On success, session is created
4. On failure, 401 Unauthorized is returned

**WebSocket Authentication:**
- Session must exist and be active
- Invalid session ID returns WebSocket close code 4000
- Expired session closes connection with error message

---

## Rate Limiting

Currently not implemented. In production, consider:
- Rate limit by IP address
- Rate limit by user ID
- Rate limit lab creation to prevent abuse

---

## CORS

CORS is enabled for all origins in development. For production, configure:

```env
# In backend .env
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error description"
}
```

Some errors may include additional context:

```json
{
  "error": "Failed to create sandbox account",
  "details": "AWS Control Tower error: ...",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Pagination

Not applicable - all API endpoints return single objects or array of limited size.

---

## Versioning

Current API version: v1 (implicit)

Future versions may use path versioning:
- `/api/v1/labs/start`
- `/api/v2/labs/start`

---

## Monitoring API Usage

Monitor these metrics:

**Requests per endpoint:**
```bash
POST   /api/labs/start              # Lab session creation
GET    /api/labs/session/:sessionId  # Session queries
POST   /api/labs/session/:sessionId/extend  # Extension requests
POST   /api/labs/session/:sessionId/end     # Session termination
GET    /health                      # Health checks
```

**WebSocket metrics:**
- Connection count
- Command execution count per session
- Connection duration
- Average command execution time

---

## Testing API

### Using cURL

```bash
# 1. Start a lab
SESSION_DATA=$(curl -X POST http://localhost:3001/api/labs/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "labId": "lab-1-s3",
    "purchaseId": "test-123",
    "token": "test-token"
  }')

SESSION_ID=$(echo $SESSION_DATA | jq -r '.session.sessionId')

# 2. Get session details
curl http://localhost:3001/api/labs/session/$SESSION_ID | jq .

# 3. Extend session
curl -X POST http://localhost:3001/api/labs/session/$SESSION_ID/extend \
  -H "Content-Type: application/json" \
  -d '{"minutes": 30}'

# 4. End session
curl -X POST http://localhost:3001/api/labs/session/$SESSION_ID/end
```

### Using Postman

1. Import the collection from examples
2. Set variables:
   - `base_url` = http://localhost:3001
   - `session_id` = from start response
3. Run requests in order

### Using Node.js

```javascript
const apiClient = require('./lib/api-client');

async function testAPI() {
  // Start lab
  const response = await apiClient.startLab(
    'test-user',
    'lab-1-s3',
    'test-123',
    'test-token'
  );
  
  console.log('Session:', response.session.sessionId);
  
  // Get details
  const session = await apiClient.getSession(response.session.sessionId);
  console.log('Status:', session.status);
  
  // Extend
  const extended = await apiClient.extendSession(
    response.session.sessionId,
    30
  );
  console.log('Extended until:', new Date(extended.newExpiresAt));
  
  // End
  const ended = await apiClient.endSession(response.session.sessionId);
  console.log('Ended:', ended.success);
}

testAPI();
```

---

## Support

For API issues:
1. Check server logs: `docker-compose logs backend`
2. Verify Cyberange token: JWT should decode successfully
3. Check AWS credentials: `aws sts get-caller-identity`
4. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
