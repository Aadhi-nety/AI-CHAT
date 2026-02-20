# AWS Credentials Fix - Verification Guide

## Summary of Changes

All hardcoded AWS credentials have been removed from your codebase. The application now uses AWS IAM Instance Role credentials (recommended AWS best practice).

---

## Files Changed (4 total)

### ✅ 1. docker-compose.yml
**Status:** ✅ Removed hardcoded credentials
- Removed `AWS_ACCESS_KEY_ID` environment variable
- Removed `AWS_SECRET_ACCESS_KEY` environment variable
- Kept `AWS_REGION` for SDK configuration

### ✅ 2. backend/src/terminal-server.ts
**Status:** ✅ Updated to use IAM role credentials
- Made `accessKeyId` and `secretAccessKey` optional in AWSCredentials interface
- Removed credential storage from TerminalInstance
- Removed explicit credential passing to AWS SDK clients
- Updated environment variable setup to not inject credentials
- AWS SDK now uses default credential provider chain

### ✅ 3. backend/src/routes/websocket.routes.ts
**Status:** ✅ Stopped passing explicit credentials
- Changed to pass only `region` when creating TerminalInstance
- Removed `accessKeyId` and `secretAccessKey` from terminal creation

### ✅ 4. backend/src/services/aws-control-tower.service.ts
**Status:** ✅ Updated credential handling
- Changed to detect IAM role presence instead of requiring environment variables
- Now supports both explicit credentials (for dev) and IAM role (for App Runner)
- Updated error messages to reference IAM role configuration

### ⚠️ backend/Dockerfile
**Status:** ℹ️ No changes needed
- Dockerfile already has no hardcoded credentials
- Includes AWS CLI installation which is correct

---

## Pre-Deployment Checklist

Before redeploying your container to App Runner:

### Code Verification
- [ ] No `AWS_ACCESS_KEY_ID` in docker-compose.yml
- [ ] No `AWS_SECRET_ACCESS_KEY` in docker-compose.yml
- [ ] No `AWS_ACCESS_KEY_ID` in Dockerfile
- [ ] No `AWS_SECRET_ACCESS_KEY` in Dockerfile
- [ ] terminal-server.ts doesn't set credentials in environment
- [ ] All AWS SDK clients created with only region config

### AWS Account Setup
- [ ] IAM role `AppRunner-AWSLabs-InstanceRole` exists
- [ ] Policies attached to role:
  - [ ] AmazonSSMReadOnlyAccess (minimum)
  - [ ] EC2ReadOnlyAccess (if labs use EC2)
  - [ ] IAMReadOnlyAccess (if labs use IAM)
  - [ ] AmazonS3ReadOnlyAccess (if labs use S3)
  - [ ] OrganizationsFullAccess (if using Control Tower)
- [ ] App Runner service has role attached

### Application Setup
- [ ] Container rebuilt with new code
- [ ] docker-compose.yml updated (no AWS credentials)
- [ ] Environment variables checked (no hardcoded keys in .env files)

---

## Testing After Deployment

### 1. Test Terminal AWS CLI Commands
```bash
# In the lab terminal, run:
aws sts get-caller-identity

# Expected output:
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:role/AppRunner-AWSLabs-InstanceRole"
}
```

### 2. Test SSM Commands
```bash
# In the lab terminal:
aws ssm describe-instance-information

# Should list EC2 instances (or return empty list if none exist)
```

### 3. Test S3 Commands
```bash
# In the lab terminal:
aws s3 ls

# Should list S3 buckets accessible to the role
```

### 4. Test EC2 Commands
```bash
# In the lab terminal:
aws ec2 describe-instances

# Should list EC2 instances accessible to the role
```

### 5. Check Application Logs
```bash
# View App Runner logs for any credential errors
aws apprunner describe-service --service-arn YOUR_SERVICE_ARN

# Look for these positive signs in logs:
# ✓ "Validating AWS credentials from IAM role"
# ✓ "using IAM role credentials"
# ✓ No "Invalid AWS Access Key" errors
```

---

## Troubleshooting

### Error: "Invalid AWS Access Key ID"
**Cause:** Still using old hardcoded credentials
**Solution:** 
1. Verify docker-compose.yml doesn't have AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY
2. Rebuild container: `docker-compose build`
3. Restart service: `aws apprunner start-deployment --service-arn YOUR_ARN`

### Error: "AccessDenied" or "UnauthorizedOperation"
**Cause:** IAM role doesn't have required permissions
**Solution:**
1. Check App Runner has correct role attached
2. Attach required policies to the role (see APP_RUNNER_IAM_SETUP.md)
3. Wait 5 minutes for policies to propagate
4. Restart service

### Error: "InvalidValue" when starting App Runner
**Cause:** Incorrect IAM role reference
**Solution:**
1. Verify role name is exactly: `AppRunner-AWSLabs-InstanceRole`
2. Use full ARN: `arn:aws:iam::ACCOUNT_ID:role/AppRunner-AWSLabs-InstanceRole`
3. Check role exists: `aws iam get-role --role-name AppRunner-AWSLabs-InstanceRole`

### Terminal commands still failing
**Cause:** Terminal is using old code
**Solution:**
1. Force redeploy: `aws apprunner start-deployment --service-arn YOUR_ARN --force-latest-image`
2. Check task logs in CloudWatch
3. Verify service is updated: `aws apprunner describe-service --service-arn YOUR_ARN`

---

## Security Verification

### ✅ Credentials Are NOT:
- [ ] Hardcoded in code
- [ ] Stored in environment variables
- [ ] Exposed in docker-compose.yml
- [ ] Logged in application output
- [ ] Visible in CloudWatch logs

### ✅ Credentials ARE:
- [x] Using temporary IAM role credentials
- [x] Auto-rotating (every ~3600 seconds)
- [x] Fine-grained (based on IAM policies)
- [x] Auditable (via CloudTrail)
- [x] Revocable (by removing role)

---

## Performance Impact

**Expected:** No negative impact
- AWS SDK still uses same service APIs
- IAM role credential fetching has <100ms overhead (cached)
- Temporary credentials are auto-renewed in background

---

## Rollback Instructions (If Issues Occur)

If you need to revert to the previous version:

```bash
# Option 1: Revert code changes
git checkout backend/src/terminal-server.ts
git checkout backend/src/routes/websocket.routes.ts
git checkout docker-compose.yml

# Option 2: Re-add hardcoded credentials (NOT RECOMMENDED)
# Edit docker-compose.yml and add back:
# AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
# AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}

# Option 3: Rebuild and redeploy old image
docker-compose build
docker push YOUR_REGISTRY/aws-labs-backend:latest
aws apprunner start-deployment --service-arn YOUR_ARN
```

---

## Related Documentation

- [APP_RUNNER_IAM_SETUP.md](APP_RUNNER_IAM_SETUP.md) - Detailed AWS configuration steps
- [AWS_CREDENTIALS_FIX_SUMMARY.md](AWS_CREDENTIALS_FIX_SUMMARY.md) - Complete change summary
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [App Runner Instance Role](https://docs.aws.amazon.com/apprunner/latest/dg/security_iam_service-with-iam.html)

---

## Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild container
docker-compose build backend

# 3. Test locally (if possible)
docker-compose up

# 4. Push to container registry
docker tag aws-labs-backend:latest YOUR_REGISTRY/aws-labs-backend:latest
docker push YOUR_REGISTRY/aws-labs-backend:latest

# 5. Deploy to App Runner
aws apprunner start-deployment \
  --service-arn arn:aws:apprunner:REGION:ACCOUNT_ID:service/SERVICE_NAME/SERVICE_ID \
  --force-latest-image

# 6. Monitor deployment
aws apprunner describe-service --service-arn YOUR_SERVICE_ARN \
  --query 'Service.ServiceStatus'

# 7. Test in labs
# Create new lab and run: aws sts get-caller-identity
```

---

## Support

For issues or questions:
1. Check CloudWatch logs for detailed error messages
2. Review APP_RUNNER_IAM_SETUP.md for configuration issues
3. Verify IAM role and policies are correct
4. Check AWS App Runner service documentation
