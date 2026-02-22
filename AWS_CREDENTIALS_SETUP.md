# AWS Credentials Setup Guide

This guide helps you set up real AWS credentials to get actual AWS responses in the terminal.

## Quick Steps

### Step 1: Get AWS Credentials

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam)
2. Click on your username
3. Go to "Security credentials" tab
4. If no access key exists, click "Create access key"
5. **Copy and save**:
   - Access Key ID (e.g., `AKIAXXXXXXXXXXXXX`)
   - Secret Access Key (click "Show" to see it)

### Step 2: Update backend/.env File

Edit the `backend/.env` file with your credentials:

```
# CRITICAL: Set to production to use real AWS credentials
NODE_ENV=production
USE_DEV_CREDENTIALS=false

# Your AWS credentials from Step 1
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID_HERE
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY_HERE
AWS_REGION=us-east-1
```

### Step 3: Restart the Backend

```
bash
cd backend
npm run dev
```

### Step 4: Test It

In your terminal, run:
```
aws lambda list-functions
```

You should now see real Lambda functions (or empty list if none exist).

---

## Required IAM Permissions

Your IAM user needs at least these permissions:

| Service | Permission |
|---------|------------|
| Lambda | `lambda:ListFunctions`, `lambda:GetFunction` |
| S3 | `s3:ListBuckets`, `s3:ListObjects` |
| EC2 | `ec2:DescribeInstances` |
| IAM | `iam:ListUsers`, `iam:GetUser` |
| DynamoDB | `dynamodb:ListTables` |

For full access, attach policy: `AdministratorAccess`

---

## Troubleshooting

### Error: "Invalid AWS Access Key ID"

**Cause**: Wrong or expired credentials

**Fix**:
1. Go to AWS IAM Console
2. Verify your access key is "Active"
3. If not, create a new access key
4. Update your `.env` file

### Error: "SignatureDoesNotMatch"

**Cause**: Secret access key is incorrect

**Fix**:
1. Create new access key in IAM
2. Update the secret in `.env`

### Error: "Access Denied"

**Cause**: IAM user lacks permissions

**Fix**:
1. Go to IAM → Users → Your User
2. Add policy: `AdministratorAccess`

---

## Need AWS Account?

Free options:
1. **AWS Free Tier**: https://aws.amazon.com/free
2. **AWS Educate**: https://aws.amazon.com/education/awseducate/

---

## Summary

| Setting | Value |
|---------|-------|
| NODE_ENV | production |
| USE_DEV_CREDENTIALS | false |
| AWS_ACCESS_KEY_ID | Your key |
| AWS_SECRET_ACCESS_KEY | Your secret |
| AWS_REGION | us-east-1 (or your region) |
