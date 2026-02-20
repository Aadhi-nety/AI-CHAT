# AWS Credentials Fix - TODO

## Problem
Error: "The security token included in the request is invalid" when running AWS CLI commands in the terminal.

## Root Cause Analysis
This error typically means:
1. The AWS access key ID or secret access key is invalid
2. The credentials have expired
3. The IAM user was not created properly in AWS

## Solution Plan

### 1. Add Credential Validation in Terminal Server
- [ ] Before executing any AWS command, validate credentials using `aws sts get-caller-identity`
- [ ] Return a clear error message if credentials are invalid
- [ ] Add logging to see what's happening

### 2. Improve IAM User Creation Error Handling
- [ ] Add better error handling in `aws-control-tower.service.ts`
- [ ] Log IAM user creation failures with details
- [ ] Validate access keys after creation

### 3. Add Debug Logging
- [ ] Log credentials being used (masked) in terminal-server.ts
- [ ] Log the full command and environment variables (masked)
- [ ] Add more detailed error messages

### 4. Improve Error Messages
- [ ] Return helpful error messages when credentials are invalid
- [ ] Include troubleshooting steps in error messages
- [ ] Suggest checking IAM user status

## Files to Modify
1. `backend/src/terminal-server.ts` - Add credential validation
2. `backend/src/services/aws-control-tower.service.ts` - Improve error handling

## Testing
- Test with valid AWS credentials
- Test with invalid credentials to verify error messages
- Test with expired credentials

## Notes
- The error "The security token included in the request is invalid" is different from permission errors
- This error means the credentials themselves are not valid AWS credentials
- Need to ensure IAM user creation is working correctly
