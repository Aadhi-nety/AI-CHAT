# AWS Labs Platform Deployment Guide

## Overview

This is a full-stack application with:
- **Frontend**: Next.js 16 with TypeScript (port 3000)
- **Backend**: Node.js Express + WebSocket server (ports 3001-3002)
- **Infrastructure**: AWS Control Tower for sandbox account management

## Local Development

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- AWS Account with Control Tower
- Cyberange API credentials

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
EOF

# Start development server
npm run dev
```

Frontend runs at: http://localhost:3000

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env
cat > .env << EOF
PORT=3001
TERMINAL_PORT=3002
NODE_ENV=development
CYBERANGE_API_URL=https://api.cyberange.com
CYBERANGE_API_KEY=your_api_key
JWT_SECRET=your_secret_key
AWS_REGION=us-east-1
AWS_CONTROL_TOWER_ENABLED=false
LAB_TIMEOUT_MINUTES=120
LAB_IDLE_TIMEOUT_MINUTES=30
EOF

# Start development server
npm run dev
```

Backend runs at: http://localhost:3001

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Create .env file for environment variables
cat > .env << EOF
CYBERANGE_API_URL=https://api.cyberange.com
CYBERANGE_API_KEY=your_api_key
JWT_SECRET=your_secret_key
AWS_REGION=us-east-1
AWS_MANAGEMENT_ACCOUNT_ID=123456789012
AWS_MANAGEMENT_ACCOUNT_ROLE_ARN=arn:aws:iam::123456789012:role/OrganizationAccountAccessRole
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
BACKEND_URL=http://localhost:3001
EOF

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build

```bash
# Build backend image
docker build -f backend/Dockerfile -t aws-labs-backend:latest ./backend

# Build frontend image
docker build -f Dockerfile -t aws-labs-frontend:latest .

# Run backend
docker run -d \
  -p 3001:3001 \
  -p 3002:3002 \
  --env-file .env \
  --name aws-labs-backend \
  aws-labs-backend:latest

# Run frontend
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 \
  --name aws-labs-frontend \
  aws-labs-frontend:latest
```

## Production Deployment

### AWS ECS Deployment

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name aws-labs-cluster

# Build and push images to ECR
aws ecr create-repository --repository-name aws-labs-backend
aws ecr create-repository --repository-name aws-labs-frontend

docker tag aws-labs-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aws-labs-backend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aws-labs-backend:latest

# Register task definitions and create services
# (See AWS ECS documentation for detailed steps)
```

### Vercel Deployment (Frontend Only)

```bash
# Deploy to Vercel
vercel deploy --prod

# Set environment variables in Vercel dashboard
# NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.com
```

## Configuration

### Environment Variables

**Frontend (.env.local)**
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

**Backend (.env)**
```
# Service
PORT=3001
NODE_ENV=production
TERMINAL_PORT=3002

# Cyberange
CYBERANGE_API_URL=https://api.cyberange.com
CYBERANGE_API_KEY=your_api_key
JWT_SECRET=your_jwt_secret

# AWS
AWS_REGION=us-east-1
AWS_CONTROL_TOWER_ENABLED=true
AWS_MANAGEMENT_ACCOUNT_ID=123456789012
AWS_MANAGEMENT_ACCOUNT_ROLE_ARN=arn:aws:iam::123456789012:role/OrganizationAccountAccessRole
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Lab Configuration
LAB_TIMEOUT_MINUTES=120
LAB_IDLE_TIMEOUT_MINUTES=30
```

## Cyberange Integration

### Step 1: Get API Endpoint
Contact Cyberange to get:
- Token validation endpoint URL
- API key for authentication

### Step 2: Update Backend Configuration
```bash
CYBERANGE_API_URL=https://your-cyberange-domain.com
CYBERANGE_API_KEY=your_key_here
```

### Step 3: Update Landing Page
The landing page accepts JWT tokens via URL parameters:
```
https://your-domain.com?token=YOUR_JWT&userId=USER_ID&purchaseId=PURCHASE_ID
```

When parameters are present, the user is automatically logged in and redirected to labs.

### Step 4: Configure Cyberange Callback
In Cyberange platform, set the callback URL to:
```
https://your-aws-labs-domain.com?token={jwt_token}&userId={user_id}&purchaseId={purchase_id}
```

## Testing

### Health Check
```bash
curl http://localhost:3001/health
```

### Start Lab Session
```bash
curl -X POST http://localhost:3001/api/labs/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "labId": "lab-1-s3",
    "purchaseId": "purchase-123",
    "token": "your_jwt_token"
  }'
```

### WebSocket Connection Test
```bash
wscat -c ws://localhost:3001/terminal/SESSION_ID
```

## Monitoring

### Logs
```bash
# Docker Compose
docker-compose logs -f backend
docker-compose logs -f frontend

# Docker
docker logs -f aws-labs-backend
docker logs aws-labs-frontend
```

### Metrics
- Monitor AWS Control Tower account creation times
- Track active sessions and sandbox accounts
- Monitor cost of sandbox accounts
- Track WebSocket connection status

### Health Checks
```bash
# Backend health
curl http://localhost:3001/health

# AWS SDK connectivity
# Check IAM role permissions
aws iam get-user
```

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
docker-compose logs backend

# Verify environment variables
cat backend/.env

# Test AWS credentials
aws sts get-caller-identity
```

### WebSocket Connection Fails
- Ensure CORS is properly configured
- Check firewall allows WebSocket connections
- Verify `NEXT_PUBLIC_BACKEND_URL` matches backend address

### Sandbox Account Creation Fails
- Check AWS Control Tower is enabled
- Verify IAM permissions for account creation
- Review CloudTrail logs for specific errors

### Terminal Commands Not Executing
- Ensure AWS CLI is installed in backend container
- Check IAM credentials in sandbox account are valid
- Verify command syntax

## Security Checklist

- [ ] AWS credentials not hardcoded (use environment variables)
- [ ] HTTPS enabled for production
- [ ] CORS properly configured for frontend domain
- [ ] JWT token validation implemented
- [ ] WebSocket connections authenticated
- [ ] Sandbox account destruction configured
- [ ] Cost controls and budgets set up
- [ ] CloudTrail logging enabled for all accounts
- [ ] Database backups configured
- [ ] Secrets manager for API keys

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify environment variables
3. Test connectivity to AWS
4. Contact Cyberange support for integration issues
