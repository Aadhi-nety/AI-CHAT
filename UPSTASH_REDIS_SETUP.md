# Upstash Redis Setup for AWS App Runner

## Overview
This implementation uses Upstash Redis (serverless external Redis) for shared session storage across AWS App Runner container instances. No VPC configuration or ElastiCache permissions required.

## Configuration

### 1. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com)
2. Create a new Redis database
3. Choose region closest to your AWS App Runner deployment
4. Copy the Redis URL (format: `redis://default:password@host:port`)

### 2. AWS App Runner Environment Variables

Set this environment variable in your AWS App Runner service:

```
REDIS_URL=redis://default:your-password@your-instance.upstash.io:6379
```

**Important:** Do NOT include the `rediss://` prefix - use `redis://` even for TLS connections. The code automatically enables TLS for Upstash URLs.

### 3. Local Development

For local development, you can:
- Use the same Upstash Redis URL (recommended for testing production-like behavior)
- Or set up a local Redis instance and use: `REDIS_URL=redis://localhost:6379`

## Features

### Session Storage
- Sessions stored in Redis with automatic TTL (2 hours default)
- Grace period: 10 seconds for session activation
- All session operations are async/await

### Connection Handling
- Automatic TLS for Upstash connections
- Connection retry with exponential backoff (max 10 attempts)
- Connection timeout: 10 seconds
- Command timeout: 5 seconds

### Error Handling
- No in-memory fallback in production (fail fast)
- Detailed logging for all Redis operations
- Health check endpoint: `/api/diagnostics/websocket`

## Health Check

Test Redis connectivity:

```bash
curl https://your-app-runner-url/api/diagnostics/websocket
```

Expected response:
```json
{
  "status": "ok",
  "websocketEndpoint": "/terminal/:sessionId",
  "supportedProtocols": ["ws", "wss"],
  "corsOrigins": ["..."],
  "awsRegion": "us-east-1",
  "timestamp": 1234567890,
  "activeSessions": ["session-id-1", "session-id-2"]
}
```

## Troubleshooting

### Connection Issues
Check logs for:
- `[Redis] CRITICAL: REDIS_URL environment variable is not set`
- `[Redis] Connecting to: redis://default:****@host:port`
- `[Redis] Connected successfully to Upstash`

### Session Not Found
- Verify session was created: Check `[LabSession] Session created` log
- Verify Redis storage: Check `[Redis] Session stored` log
- Check session TTL hasn't expired

### WebSocket Connection Fails
1. Check session exists: `GET /api/labs/session/:sessionId/validate`
2. Verify Redis health: `GET /api/diagnostics/websocket`
3. Check WebSocket URL format in client

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AWS App       │     │   Upstash       │     │   AWS App       │
│   Runner        │◄───►│   Redis         │◄───►│   Runner        │
│   Instance 1    │     │   (Serverless)  │     │   Instance 2    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                               │
         └──────────────────┬────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  WebSocket       │
                   │  Terminal        │
                   │  Connections   │
                   └─────────────────┘
```

## Security

- Redis URL with password stored in AWS App Runner environment variables
- TLS automatically enabled for Upstash connections
- Password masked in logs
- No VPC peering required (public endpoint with auth)

## Cost

Upstash offers:
- Free tier: 10,000 commands/day
- Pay-as-you-go: ~$0.20 per 100K commands
- Pro tier: Fixed pricing for higher volumes

For typical lab usage (~100 sessions/day), free tier is usually sufficient.
