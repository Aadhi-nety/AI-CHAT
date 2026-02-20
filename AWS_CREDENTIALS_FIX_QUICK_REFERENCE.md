# AWS Credentials Fix - Quick Reference

## Problem
```
Invalid AWS Access Key ID
The security token included in the request is invalid
```

## Root Cause
Hardcoded AWS credentials in docker-compose.yml were invalid/expired. Container wasn't using IAM Instance Role.

## Solution Implemented
✅ Removed hardcoded credentials from code
✅ Container now uses IAM Instance Role (auto-rotating temporary credentials)
✅ Follows AWS security best practices

---

## Files Changed
```
✅ docker-compose.yml                              (removed 2 env vars)
✅ backend/src/terminal-server.ts                  (removed credential injection)
✅ backend/src/routes/websocket.routes.ts          (removed credential passing)
✅ backend/src/services/aws-control-tower.service.ts (updated credential detection)
```

---

## AWS Setup Needed (3 Steps)

### Step 1: Create IAM Role
```bash
aws iam create-role \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

### Step 2: Attach Policies
```bash
# Minimum requirement
aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess

# Add based on your labs
aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/EC2ReadOnlyAccess

aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/IAMReadOnlyAccess

aws iam attach-role-policy \
  --role-name AppRunner-AWSLabs-InstanceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

### Step 3: Attach Role to App Runner
```bash
aws apprunner update-service \
  --service-arn arn:aws:apprunner:REGION:ACCOUNT_ID:service/SERVICE_NAME/SERVICE_ID \
  --instance-configuration IamInstanceRole=arn:aws:iam::ACCOUNT_ID:role/AppRunner-AWSLabs-InstanceRole
```

---

## Deploy & Test

### Deploy New Code
```bash
# Rebuild container
docker-compose build backend

# Push to registry
docker push YOUR_REGISTRY/aws-labs-backend:latest

# Deploy to App Runner
aws apprunner start-deployment \
  --service-arn arn:aws:apprunner:REGION:ACCOUNT_ID:service/SERVICE_NAME/SERVICE_ID \
  --force-latest-image
```

### Verify It Works
```bash
# In lab terminal, run:
aws sts get-caller-identity

# Expected output (NOT an error):
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:role/AppRunner-AWSLabs-InstanceRole"
}
```

---

## Verification Checklist

**Code:**
- [ ] docker-compose.yml has NO `AWS_ACCESS_KEY_ID`
- [ ] docker-compose.yml has NO `AWS_SECRET_ACCESS_KEY`
- [ ] terminal-server.ts doesn't inject credentials into env
- [ ] websocket.routes.ts doesn't pass credentials to TerminalInstance

**AWS:**
- [ ] IAM role `AppRunner-AWSLabs-InstanceRole` exists
- [ ] Required policies attached to role
- [ ] Role attached to App Runner service

**Application:**
- [ ] Container rebuilt with new code
- [ ] New image pushed to registry
- [ ] App Runner redeployed with new image
- [ ] `aws sts get-caller-identity` returns role ARN (not error)
- [ ] No "Invalid AWS Access Key" errors in logs

---

## Key Changes Explained

### Before (Broken ❌)
```typescript
// Docker: Pass hardcoded keys
AWS_ACCESS_KEY_ID=EXPIRED_KEY
AWS_SECRET_ACCESS_KEY=EXPIRED_SECRET

// Code: Use those keys
const env = {
  AWS_ACCESS_KEY_ID: credentials.accessKeyId,      // ❌ Hardcoded
  AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey  // ❌ Hardcoded
};

const sts = new AWS.STS({
  accessKeyId: credentials.accessKeyId,      // ❌ Explicit
  secretAccessKey: credentials.secretAccessKey  // ❌ Explicit
});
```

### After (Fixed ✅)
```typescript
// Docker: No credentials passed
NODE_ENV=production
AWS_REGION=us-east-1

// Code: Use default credential chain (IAM role)
const env = {
  AWS_DEFAULT_REGION: this.region,  // ✅ Only region
  AWS_REGION: this.region
};

const sts = new AWS.STS({
  region: this.region  // ✅ Only region, SDK finds credentials
});
```

---

## How It Works Now

1. **App Runner starts** → IAM role credentials auto-injected
2. **Container starts** → No hardcoded credentials passed
3. **AWS SDK initializes** → Finds credentials from IAM role
4. **User runs CLI** → Uses temporary, rotating credentials
5. **Credentials expire** → AWS SDK auto-refreshes them

---

## Still Getting Errors?

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid AWS Access Key" | Using old code with hardcoded keys | Rebuild & redeploy container |
| "AccessDenied" | Role lacks permissions | Attach required policies to role |
| "InvalidParameterValue" | Role name typo | Verify role name exactly matches |
| Session expires/fails | Credentials not loading | Check App Runner role attachment |

---

## Documentation Files

Created for reference:
- `APP_RUNNER_IAM_SETUP.md` - Detailed AWS setup guide
- `AWS_CREDENTIALS_FIX_SUMMARY.md` - Complete change documentation
- `AWS_CREDENTIALS_FIX_VERIFICATION.md` - Testing & troubleshooting guide
- `AWS_CREDENTIALS_FIX_QUICK_REFERENCE.md` - This file

---

## Next Actions

1. ✅ Code changes complete
2. ⏳ Create IAM role in AWS (see Step 1 above)
3. ⏳ Attach policies to role (see Step 2 above)
4. ⏳ Link role to App Runner service (see Step 3 above)
5. ⏳ Rebuild and redeploy container
6. ⏳ Test with `aws sts get-caller-identity`
