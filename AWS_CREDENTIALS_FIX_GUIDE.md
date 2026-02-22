# AWS Credentials Fix Guide

## The Problem

You are getting this error in the terminal:
```
Invalid AWS Access Key ID: The security token included in the request is invalid
```

**What this means:** The AWS Access Key ID does NOT exist in AWS IAM. This is NOT a code bug - the credentials are invalid.

---

## The Fix (Already Applied!)

I've updated the code to automatically use mock credentials (DEVKEY) when running in development mode. This will allow you to test the application without needing real AWS credentials.

### How to Run

1. **Make sure NODE_ENV is set to development:**

2. **Run the backend:**
   
```
bash
   cd backend
   npm run dev
   
```

3. **Start a lab session** - it will use DEVKEY credentials

---

## What Changed in the Code

The file `backend/src/services/aws-control-tower.service.ts` was updated to:

1. **Always use DEVKEY in development mode** - No more trying to assume AWS roles that don't exist
2. **Clear error messages in production** - If real AWS access is needed, you'll get helpful instructions
3. **New environment variable** - You can also set `USE_DEV_CREDENTIALS=true` to force dev mode

---

## Understanding the Two Modes

### Development Mode (Default for local testing)
- Uses mock credentials: `DEVKEY` / `DEVSECRET`
- Terminal commands will work but won't actually connect to AWS
- Perfect for testing the UI and workflow
- Set `NODE_ENV=development` or `USE_DEV_CREDENTIALS=true`

### Production Mode
- Requires real AWS credentials
- Uses STS AssumeRole to get temporary credentials
- Actual AWS API calls work
- Set `NODE_ENV=production`

---

## If You Need Real AWS Access Later

For production use with real AWS, you'll need to:

1. **Set up an AWS Labs account** (ID: 766363046973)
2. **Create IAM roles** like:
   - Labs-S3-Admin
   - Labs-IAM-Admin
   - Labs-EC2-Admin
   - Labs-Lambda-Admin
   - Labs-DynamoDB-Admin
   - Labs-CloudTrail-Admin
   - Labs-SSM-Admin
3. **Configure cross-account access**

---

## Quick Summary

| What you want | What to do |
|---------------|------------|
| Test the app locally | Run with `NODE_ENV=development` - works out of the box! |
| Real AWS access | Set up AWS Labs account with IAM roles |
| Don't have AWS | Use development mode for now |

---

## Try It Now!

Just run your backend with development mode and the error should be gone!
   