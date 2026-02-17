# Upstash Redis Setup Guide for AWS App Runner

## Quick Start

### 1. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com)
2. Click "Create Database"
3. Select region closest to your AWS App Runner service
4. Choose "Redis" as the type
5. Note down the Redis URL (format: `redis://default:password@host:port`)

### 2. Configure AWS App Runner

**CRITICAL: Environment variables must be set in AWS App Runner Console, NOT in .env file**

1. Go to [AWS App Runner Console](https://console.aws.amazon.com/apprunner)
2. Select your service
3. Click **"Configuration"** tab
4. Under **"Environment variables"**, click **"Edit"**
5. Add the following environment variable:
   - **Name**: `REDIS_URL`
   - **Value**: `redis://default:YOUR_PASSWORD@YOUR_ENDPOINT.upstash.io:6379`
6. Click **"Save changes"**
7. Click **"Deploy"** to redeploy with new configuration

### 3. Verify Deployment

Check App Runner logs for:
```
[Redis] Connected successfully to Upstash
[Redis] Client ready - session storage operational
```

## Environment Variable Format

```
REDIS_URL=redis://default:password@endpoint.upstash.io:6379
```

**Important**: Do NOT include `redis-cli --tls -u` prefix - just the URL.

## Troubleshooting

### Error: "REDIS_URL is required for production session storage"

**Cause**: Environment variable not set in AWS App Runner

**Solution**: Follow step 2 above to add REDIS_URL in App Runner Console.

### Error: "Invalid REDIS_URL format"

**Cause**: URL format is incorrect

**Solution**: Ensure URL starts with `redis://` or `rediss://`, not `redis-cli`.

### Connection Timeout

**Cause**: Network issues or incorrect endpoint

**Solution**: 
- Verify endpoint is correct in Upstash console
- Check security group rules allow outbound connections
- Ensure TLS is enabled (automatic for upstash.io domains)

## Local Development

Create `backend/.env` file:

```env
REDIS_URL=redis://default:password@localhost:6379
PORT=3001
NODE_ENV=development
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   App Runner    │────▶│  Upstash Redis  │◀────│   App Runner    │
│   Instance 1    │     │   (Serverless)  │     │   Instance 2    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        └───────────────────────────────────────────────┘
                    Shared Session Storage
```

## Support

- Upstash Docs: https://docs.upstash.com/redis
- AWS App Runner Docs: https://docs.aws.amazon.com/apprunner
