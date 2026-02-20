# AWS App Runner IAM Role Setup Guide

## Overview
Your application has been updated to use IAM Instance Role credentials instead of hardcoded AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY. This guide walks you through the AWS setup required to complete the fix.

## Error Caused By
**Before:** The container was using hardcoded/invalid static credentials passed via environment variables
**Error:** `Invalid AWS Access Key ID: The security token included in the request is invalid`
**After:** The container will use the IAM Instance Role attached to the App Runner service

## Steps to Complete the Setup

### 1. Verify/Create the IAM Role (AppRunner-AWSLabs-InstanceRole)

```bash
# Check if the role exists
aws iam get-role --role-name AppRunner-AWSLabs-InstanceRole

# If role doesn't exist, create it
aws iam create-role \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "tasks.apprunner.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'
```

### 2. Attach AmazonSSMReadOnlyAccess Policy

```bash
# Attach the SSM read-only policy (needed for SSM operations in labs)
aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess

# Attach other necessary policies based on your labs' requirements
# Example: For EC2 access
aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/EC2ReadOnlyAccess

# Example: For IAM access
aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/IAMReadOnlyAccess

# Example: For S3 access
aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

### 3. Create an App Runner Service IAM Role

If your App Runner service doesn't have an associated IAM role:

```bash
# Create the role for App Runner service
aws iam create-role \
  --role-name AppRunner-Service-Role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "apprunner.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

# Attach the default App Runner service policy
aws iam attach-role-policy \
  --role-name AppRunner-Service-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
```

### 4. Update Your App Runner Service Configuration

In your App Runner service settings:

1. Go to **AWS App Runner Console** → Your Service → **Configuration** → **Instance Settings**
2. Under **Instance role** (if available), select or attach: `AppRunner-AWSLabs-InstanceRole`
3. Alternatively, use the CLI:

```bash
aws apprunner update-service \
  --service-arn arn:aws:apprunner:REGION:ACCOUNT_ID:service/SERVICE_NAME/SERVICE_ID \
  --instance-configuration \
    IamInstanceRole=arn:aws:iam::ACCOUNT_ID:role/AppRunner-AWSLabs-InstanceRole
```

### 5. Verify the Configuration

After updating App Runner, verify that credentials are working:

```bash
# SSH into the App Runner container or check logs
aws apprunner describe-service --service-arn YOUR_SERVICE_ARN --query 'Service.InstanceConfiguration.IamInstanceRole'

# Inside the container, test:
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:role/AppRunner-AWSLabs-InstanceRole"
# }
```

## Code Changes Made

### Removed from Code:
- ❌ Hardcoded `AWS_ACCESS_KEY_ID` environment variable from docker-compose.yml
- ❌ Hardcoded `AWS_SECRET_ACCESS_KEY` environment variable from docker-compose.yml
- ❌ Explicit credential parameters passed to AWS SDK clients
- ❌ Environment variable injection of credentials in terminal-server.ts

### Updated in Code:
- ✅ Terminal server now uses default AWS SDK credential chain
- ✅ Region is configured via AWS_REGION environment variable
- ✅ Credentials validation removed for non-lab scenarios
- ✅ WebSocket routes no longer pass explicit credentials

## Testing After Setup

1. **Rebuild and redeploy your container:**
   ```bash
   docker-compose up --build
   # or
   docker build -f backend/Dockerfile -t aws-labs-backend .
   aws apprunner start-deployment --service-arn YOUR_SERVICE_ARN
   ```

2. **Check application logs:**
   ```bash
   aws apprunner describe-service --service-arn YOUR_SERVICE_ARN --query 'Service.ServiceLog'
   ```

3. **Test AWS CLI commands:**
   - Access the terminal in labs
   - Run: `aws sts get-caller-identity`
   - Should show the AppRunner-AWSLabs-InstanceRole ARN

4. **Monitor for errors:**
   - Look for error logs in App Runner console
   - Search for "Invalid AWS Access Key" - should be gone
   - Check for "Validating AWS credentials from IAM role" in logs

## Troubleshooting

### Still Getting "Invalid AWS Access Key" Error
1. Verify IAM role is attached to App Runner service
2. Check role trust relationship includes `tasks.apprunner.amazonaws.com`
3. Ensure required policies are attached to the role
4. Wait 5-10 minutes for policy propagation
5. Restart the App Runner service

### "UnauthorizedOperation" or "AccessDenied" Errors
- The role exists and is being used, but lacks required permissions
- Add the necessary managed policies or create a custom policy
- For labs, typically need: SSM, EC2, IAM, S3, CloudFormation permissions

### Role Not Taking Effect
1. Confirm service restart: `aws apprunner start-deployment --service-arn YOUR_SERVICE_ARN`
2. Check service logs: `aws apprunner describe-service --service-arn ...`
3. Look for role ARN in logs confirming it's being loaded

## Security Notes

✅ **These changes improve security by:**
- Removing hardcoded credentials
- Using temporary, auto-rotating credentials from IAM role
- Following AWS best practices
- Eliminating credential exposure risk

⚠️ **Important:**
- Never commit AWS credentials to version control
- Use IAM roles for all AWS services
- Regularly audit role permissions
- Use least privilege principle for policies

## Next Steps

1. Create/verify IAM role in your AWS account
2. Attach required policies
3. Link role to App Runner service
4. Rebuild and redeploy container
5. Verify with `aws sts get-caller-identity`
