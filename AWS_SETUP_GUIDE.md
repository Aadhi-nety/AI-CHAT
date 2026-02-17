# AWS Control Tower Setup Guide

This guide walks you through setting up AWS Control Tower to create sandbox accounts for the AWS Labs platform.

## Prerequisites

- AWS Account (preferably a dedicated organization account)
- AWS Management Console access
- Sufficient AWS service quotas
- ~30 minutes to complete initial setup

## Step 1: Enable AWS Organizations

1. Go to [AWS Organizations Console](https://console.aws.amazon.com/organizations)
2. Click "Create an organization"
3. Choose "All features" to enable full AWS Organizations capabilities
4. Confirm the organization creation
5. Verify your management account email

## Step 2: Deploy AWS Control Tower

1. Navigate to [AWS Control Tower Console](https://console.aws.amazon.com/controltower)
2. Click "Set up landing zone"
3. **Home region**: Choose your primary region (e.g., us-east-1)
4. **Additional AWS Regions**: Select regions where you want to govern resources
5. Review and accept the AWS service permissions
6. Click "Create landing zone" (this takes ~45 minutes)

### What Gets Created:
- AWS Organizations structure
- Foundational Organizational Units (OUs):
  - Management
  - Security
  - Sandbox (we'll use this for labs)
- Baseline guardrails and controls

## Step 3: Create Sandbox OU

After Control Tower is ready:

1. Go to AWS Organizations Console
2. Create a new Organizational Unit named "AWS-Labs-Sandbox"
3. Note the OU ID (you'll need it)

## Step 4: Configure Sandbox Account Template

1. In Control Tower, go to "Account Factory"
2. Create an account template with these settings:
   - **Account Name**: `lab-sandbox-{timestamp}`
   - **Email**: Use email templating (e.g., `lab-sandbox+{random}@yourdomain.com`)
   - **Organization Unit**: AWS-Labs-Sandbox
   - **IAM Role Name**: `OrganizationAccountAccessRole`

## Step 5: Get Your Management Account Credentials

1. Go to IAM Console in your management account
2. Create an IAM user for the AWS Labs service:
   - **Username**: `aws-labs-service`
   - **Access type**: Programmatic access
3. Attach policy: `AdministratorAccess` (or more restrictive based on your security requirements)
4. Save the Access Key ID and Secret Access Key
5. Create trust relationship with your sandbox OU

### Example Trust Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::MANAGEMENT-ACCOUNT-ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "aws-labs-external-id"
        }
      }
    }
  ]
}
```

## Step 6: Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_CONTROL_TOWER_ENABLED=true
AWS_MANAGEMENT_ACCOUNT_ID=123456789012
AWS_MANAGEMENT_ACCOUNT_ROLE_ARN=arn:aws:iam::123456789012:role/OrganizationAccountAccessRole
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Cyberange Integration
CYBERANGE_API_URL=https://api.cyberange.com
CYBERANGE_API_KEY=your_api_key

# Service Configuration
JWT_SECRET=your_secret_key_here
LAB_TIMEOUT_MINUTES=120
LAB_IDLE_TIMEOUT_MINUTES=30

# If you deploy the backend to AWS App Runner (or any public host),
# set the public URL here as well.  the frontend needs two matching
# environment variables so it can call the REST API and open the
# WebSocket connection:
#
#   NEXT_PUBLIC_API_URL=https://2rrfaahu3d.ap-south-1.awsapprunner.com
#   NEXT_PUBLIC_BACKEND_URL=https://2rrfaahu3d.ap-south-1.awsapprunner.com
#
# (remove any trailing whitespace; the client will trim but warns otherwise.)
# Update these in your Next.js `.env.production`/Vercel settings before
# building the frontend.
```

## Step 7: Deploy the Service

### Using Docker Compose:
```bash
docker-compose up -d
```

### Manual Deployment:
```bash
cd backend
npm install
npm run build
npm start
```

## Step 8: Test the Setup

1. **Health Check**:
```bash
curl http://localhost:3001/health
```

2. **Start a Lab Session**:
```bash
curl -X POST http://localhost:3001/api/labs/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "labId": "lab-1-s3",
    "purchaseId": "purchase-123",
    "token": "your_cyberange_token"
  }'
```

## Security Best Practices

1. **Least Privilege IAM**: Create restrictive policies per lab type
2. **Time-Limited Access**: Automatically destroy sandbox accounts after lab expiration
3. **Audit Logging**: Enable CloudTrail for all sandbox accounts
4. **VPC Isolation**: Deploy sandboxes in isolated VPCs
5. **Cost Controls**: Set AWS Budgets alerts for sandbox accounts
6. **Encryption**: Enable encryption at rest and in transit

## Cost Optimization

Sandbox accounts incur costs. Consider:
- Automatic cleanup after lab completion
- Consolidating test resources
- Using AWS Free Tier where applicable
- Setting up cost allocation tags

## Troubleshooting

### Issue: Control Tower Deployment Fails
- Ensure your AWS account supports all required regions
- Check service quotas (email verification, account creation limits)
- Review CloudTrail logs for detailed error messages

### Issue: Account Creation Times Out
- Control Tower can take 5-10 minutes per account
- Check the Control Tower Dashboard for ongoing deployments
- Verify email address is accessible

### Issue: IAM Role Assumption Fails
- Verify the trust relationship is correctly configured
- Check External ID matches in both policies
- Ensure management account has proper permissions

## Monitoring

Monitor sandbox account creation and usage:
```bash
# Check active sessions
curl http://localhost:3001/health

# View AWS Control Tower dashboard
# Monitor CloudTrail for all account activities
# Review AWS Cost Explorer for sandbox spending
```

## Cleanup

To disable Control Tower and remove sandbox accounts:
1. Go to Control Tower Console
2. Deregister all member accounts
3. Disable Control Tower (this removes guardrails only)
4. Manually close AWS accounts in Organizations console

---

**Next Steps**: 
- Configure Cyberange integration endpoint
- Deploy the frontend Next.js application
- Run your first lab session
