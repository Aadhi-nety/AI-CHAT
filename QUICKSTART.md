# Quick Start Guide - AWS Labs Platform

## 5-Minute Setup (Demo Mode)

This gets the platform running locally without AWS integration for testing.

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (optional)

### Step 1: Clone & Install

```bash
# Install frontend
npm install

# Install backend
cd backend
npm install
cd ..
```

### Step 2: Start Backend

```bash
cd backend

# Create .env file
cat > .env << EOF
PORT=3001
TERMINAL_PORT=3002
NODE_ENV=development
CYBERANGE_API_URL=https://api.cyberange.com
CYBERANGE_API_KEY=demo
JWT_SECRET=demo-secret
AWS_CONTROL_TOWER_ENABLED=false
LAB_TIMEOUT_MINUTES=120
EOF

# Start
npm run dev
```

Backend starts at: **http://localhost:3001**

### Step 3: Start Frontend

In a new terminal:

```bash
# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
EOF

# Start
npm run dev
```

Frontend starts at: **http://localhost:3000**

### Step 4: Access the Platform

1. Open http://localhost:3000
2. Login with any email/password (demo mode accepts all credentials)
3. Click "Start Lab" on any lab
4. Terminal appears with AWS CLI ready

## Full Setup with AWS (30 minutes)

### Step 1: AWS Control Tower Setup

Follow [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md) to:
1. Enable AWS Organizations
2. Deploy Control Tower
3. Create Sandbox OU
4. Get Management Account credentials

### Step 2: Configure Backend

```bash
cd backend

cat > .env << EOF
# Service
PORT=3001
TERMINAL_PORT=3002
NODE_ENV=development

# Cyberange
CYBERANGE_API_URL=https://your-cyberange-api.com
CYBERANGE_API_KEY=your_api_key_here
JWT_SECRET=your_secret_key_here

# AWS Configuration
AWS_REGION=us-east-1
AWS_CONTROL_TOWER_ENABLED=true
AWS_MANAGEMENT_ACCOUNT_ID=123456789012
AWS_MANAGEMENT_ACCOUNT_ROLE_ARN=arn:aws:iam::123456789012:role/OrganizationAccountAccessRole
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Lab Configuration
LAB_TIMEOUT_MINUTES=120
LAB_IDLE_TIMEOUT_MINUTES=30
EOF

npm run dev
```

### Step 3: Test

```bash
# Check backend health
curl http://localhost:3001/health

# Test AWS credentials
aws sts get-caller-identity

# Verify Control Tower
aws organizations list-accounts
```

### Step 4: Start Frontend

```bash
npm run dev
```

## Docker Deployment (Single Command)

```bash
# Create .env with your config
cat > .env << EOF
CYBERANGE_API_URL=https://api.cyberange.com
CYBERANGE_API_KEY=your_api_key
JWT_SECRET=your_secret
AWS_REGION=us-east-1
AWS_MANAGEMENT_ACCOUNT_ID=123456789012
AWS_MANAGEMENT_ACCOUNT_ROLE_ARN=arn:aws:iam::123456789012:role/...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
EOF

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Access at: **http://localhost:3000**

## Available Labs

After login, you'll see 7 labs:

1. **S3 Lab** - Exploit misconfigured S3 buckets
2. **IAM Lab** - Master privilege escalation
3. **EC2 Lab** - Security group exploitation
4. **Lambda Lab** - Extract data from functions
5. **DynamoDB Lab** - Table scanning techniques
6. **CloudTrail Lab** - API investigation
7. **SSM Lab** - Session Manager exploitation

Each lab:
- Creates a real AWS sandbox account
- Has lab-specific IAM permissions
- Provides step-by-step guide
- Expires after 2 hours (configurable)

## Integration with Cyberange

### Getting Started

1. **Contact Cyberange**
   - Get API endpoint URL
   - Get API key
   
2. **Update Configuration**
   ```env
   CYBERANGE_API_URL=https://cyberange-api.com
   CYBERANGE_API_KEY=your_key_here
   ```

3. **Set Callback in Cyberange**
   - Add redirect: `https://your-domain.com`
   - With parameters: `?token={jwt}&userId={id}&purchaseId={pid}`

4. **Users will be auto-logged in** when redirected from Cyberange

### JWT Token Format

Cyberange should send tokens containing:
```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "labId": "lab-1-s3",
  "expiresAt": 1234567890,
  "purchaseId": "purchase-456"
}
```

## Common Issues

### Backend Won't Start

```bash
# Check Node version
node --version  # Should be 18+

# Check port conflicts
lsof -i :3001

# Review logs
cd backend && npm run dev
```

### Frontend Can't Connect to Backend

```bash
# Verify backend is running
curl http://localhost:3001/health

# Check NEXT_PUBLIC_BACKEND_URL
echo $NEXT_PUBLIC_BACKEND_URL

# Should be http://localhost:3001
```

### WebSocket Connection Fails

- Ensure backend is running on correct port
- Check firewall allows WebSocket (ws://)
- Verify `NEXT_PUBLIC_BACKEND_URL` is correct

### AWS Commands Don't Work

In demo mode:
- Commands are simulated
- Real AWS commands fail (expected)

For real AWS:
- Enable `AWS_CONTROL_TOWER_ENABLED=true`
- Verify AWS credentials
- Check IAM permissions

### Docker Issues

```bash
# View logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Reset everything
docker-compose down -v
```

## Next Steps

1. **Customize Lab Content**
   - Edit `LAB_CONTENT` in `/app/labs/[labId]/page.tsx`
   - Add your own commands and explanations

2. **Deploy to Production**
   - Follow [DEPLOYMENT.md](./DEPLOYMENT.md)
   - Set up HTTPS, domain, etc.

3. **Monitor Usage**
   - Set up CloudWatch dashboards
   - Track session duration and cost

4. **Scale Up**
   - Follow horizontal scaling in [ARCHITECTURE.md](./ARCHITECTURE.md)

## Support

- **Backend issues**: Check `/backend/.env` configuration
- **AWS issues**: Verify credentials in IAM console
- **Cyberange integration**: Contact Cyberange support
- **General help**: Review [ARCHITECTURE.md](./ARCHITECTURE.md)

## Security Reminders

Before production:
- [ ] Change `JWT_SECRET` to strong random value
- [ ] Enable HTTPS
- [ ] Set up CloudTrail logging
- [ ] Configure AWS Budgets
- [ ] Enable MFA on management account
- [ ] Use VPC endpoints for private access
- [ ] Set up WAF for frontend

---

**Ready to go!** Start at http://localhost:3000
