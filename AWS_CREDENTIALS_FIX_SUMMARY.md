# AWS Credentials Fix - Summary of Changes

**Issue:** App Runner container receiving "Invalid AWS Access Key ID" error with invalid security token.

**Root Cause:** Hardcoded AWS credentials environment variables were invalid or expired; container was not using IAM Instance Role.

**Solution:** Convert container to use IAM Instance Role credentials instead of hardcoded static credentials.

---

## Files Modified

### 1. **docker-compose.yml**
**Changes Made:**
- ❌ **REMOVED:** `AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}` (line 18)
- ❌ **REMOVED:** `AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}` (line 19)

**Why:** These environment variables were pointing to invalid/expired credentials. App Runner will now use the IAM Instance Role attached to the service, which provides temporary, auto-rotating credentials.

**Before:**
```yaml
environment:
  NODE_ENV: production
  ...
  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
```

**After:**
```yaml
environment:
  NODE_ENV: production
  ...
  AWS_REGION: ${AWS_REGION:-us-east-1}
  AWS_CONTROL_TOWER_ENABLED: ${AWS_CONTROL_TOWER_ENABLED:-false}
```

---

### 2. **backend/src/terminal-server.ts**
**Changes Made:**

#### a. Modified AWSCredentials Interface
- ❌ Removed explicit requirement for `accessKeyId` and `secretAccessKey`
- ✅ Only requires `region` (optional `accessKeyId` and `secretAccessKey` remain for lab scenarios)

**Before:**
```typescript
export interface AWSCredentials {
  accessKeyId: string;        // ❌ Now optional
  secretAccessKey: string;    // ❌ Now optional
  region: string;
}
```

**After:**
```typescript
export interface AWSCredentials {
  accessKeyId?: string;       // ✅ Optional
  secretAccessKey?: string;   // ✅ Optional
  region: string;
}
```

#### b. Modified Constructor
- ❌ Removed storage of full credentials object
- ✅ Only stores region for AWS SDK configuration

**Before:**
```typescript
constructor(sessionId: string, credentials: AWSCredentials) {
  this.sessionId = sessionId;
  this.credentials = credentials;  // ❌ Stored entire credentials
}
```

**After:**
```typescript
constructor(sessionId: string, credentials: AWSCredentials) {
  this.sessionId = sessionId;
  this.region = credentials.region || process.env.AWS_REGION || 'us-east-1';  // ✅ Only store region
}
```

#### c. Updated `validateCredentials()` Method
- ❌ Removed `isTemporaryCredential()` check
- ❌ Removed explicit credential passing to AWS STS client
- ✅ AWS SDK now uses default credential chain (IAM role)

**Before:**
```typescript
private isTemporaryCredential(): boolean {
  return (
    this.credentials.accessKeyId === "DEVKEY" ||
    this.credentials.accessKeyId?.startsWith("AKIA") === false
  );
}

private async validateCredentials() {
  if (this.isTemporaryCredential()) {
    console.log(`[Terminal:${this.sessionId}] ✓ Using temporary lab credentials`);
    return { valid: true };
  }
  
  const sts = new AWS.STS({
    accessKeyId: this.credentials.accessKeyId,
    secretAccessKey: this.credentials.secretAccessKey,
    region: this.credentials.region,  // ❌ Explicit credentials
  });
}
```

**After:**
```typescript
private async validateCredentials() {
  const sts = new AWS.STS({
    region: this.region,  // ✅ Only region, no explicit credentials
  });
}
```

#### d. Updated `executeCommand()` Method
- ❌ Removed `AWS_ACCESS_KEY_ID` from environment object
- ❌ Removed `AWS_SECRET_ACCESS_KEY` from environment object
- ✅ AWS SDK uses default credential chain via IAM role

**Before:**
```typescript
const env = {
  ...process.env,
  AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,      // ❌ Injected credentials
  AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,  // ❌ Injected credentials
  AWS_DEFAULT_REGION: this.credentials.region,
  AWS_REGION: this.credentials.region,
};

console.log(
  `[Terminal:${this.sessionId}] Environment: Region=${this.credentials.region}, KeyId=${...}`
);
```

**After:**
```typescript
const env = {
  ...process.env,
  AWS_DEFAULT_REGION: this.region,  // ✅ Only region
  AWS_REGION: this.region,           // ✅ Only region
};

console.log(
  `[Terminal:${this.sessionId}] Environment: Region=${this.region}, using IAM role credentials`
);
```

#### e. Updated AWS SDK Client Initialization
- ❌ Removed explicit credential parameters from all AWS SDK client constructors
- ✅ AWS SDK uses default credential provider chain

**Before:**
```typescript
const awsCredentials = {
  accessKeyId: this.credentials.accessKeyId,
  secretAccessKey: this.credentials.secretAccessKey,
  region: this.credentials.region,
};

const sts = new AWS.STS(awsCredentials);
const s3 = new AWS.S3(awsCredentials);
const ec2 = new AWS.EC2(awsCredentials);
const iam = new AWS.IAM(awsCredentials);
const ssm = new AWS.SSM(awsCredentials);
```

**After:**
```typescript
const awsCredentials = {
  region: this.region,  // ✅ Only region
};

const sts = new AWS.STS(awsCredentials);
const s3 = new AWS.S3(awsCredentials);
const ec2 = new AWS.EC2(awsCredentials);
const iam = new AWS.IAM(awsCredentials);
const ssm = new AWS.SSM(awsCredentials);
```

---

### 3. **backend/src/routes/websocket.routes.ts**
**Changes Made:**
- ❌ **REMOVED:** Passing `iamAccessKeyId` to createTerminal
- ❌ **REMOVED:** Passing `iamSecretAccessKey` to createTerminal  
- ✅ **UPDATED:** Only pass region information

**Before:**
```typescript
terminal = terminalServer.createTerminal(sessionId, {
  accessKeyId: session.sandboxAccount.iamAccessKeyId,        // ❌ Removed
  secretAccessKey: session.sandboxAccount.iamSecretAccessKey, // ❌ Removed
  region: session.sandboxAccount.region || 'us-east-1'
});
```

**After:**
```typescript
// AWS SDK will use IAM role credentials from environment
terminal = terminalServer.createTerminal(sessionId, {
  region: session.sandboxAccount.region || process.env.AWS_REGION || 'us-east-1'
});
```

---

## How AWS Credential Chain Works Now

1. **App Runner Service starts** → IAM Instance Role is automatically provided
2. **Container environment** → AWS SDK automatically detects role credentials:
   - Reads from environment variables set by App Runner
   - Uses temporary credentials that auto-rotate
   - No manual credential management needed
3. **AWS CLI/SDK calls** → Uses role credentials instead of hardcoded keys
4. **Permission check** → Based on policies attached to the IAM role

### Credential Provider Chain (in order):
1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) - **Now removed**
2. AWS credentials file (~/.aws/credentials) - Not used in container
3. **IAM Instance Role credentials** ← **Used now**
4. Container role credentials

---

## AWS Setup Required (Next Steps)

See `APP_RUNNER_IAM_SETUP.md` for detailed instructions:

1. ✅ Create IAM role: `AppRunner-AWSLabs-InstanceRole`
2. ✅ Attach policies:
   - AmazonSSMReadOnlyAccess (minimum requirement)
   - Other policies based on your lab requirements (EC2, S3, IAM, etc.)
3. ✅ Attach role to App Runner service
4. ✅ Redeploy container
5. ✅ Verify with: `aws sts get-caller-identity`

---

## Verification Checklist

- [ ] docker-compose.yml has no AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY
- [ ] terminal-server.ts doesn't set credentials in environment
- [ ] websocket.routes.ts doesn't pass explicit credentials to TerminalInstance
- [ ] Dockerfile has no hardcoded credentials (unchanged)
- [ ] IAM role created in AWS account
- [ ] Policies attached to IAM role
- [ ] Role linked to App Runner service
- [ ] Container rebuilt and redeployed
- [ ] Test with: `aws sts get-caller-identity` returns correct role ARN
- [ ] Lab operations (EC2, S3, IAM commands) work without "Invalid AWS Access Key" errors

---

## Security Improvements

✅ **Before:** Hardcoded static credentials in environment variables
❌ **Risk:** Credentials could be exposed, leaked in logs, or expire without rotation

✅ **After:** IAM Instance Role with temporary, auto-rotating credentials
✅ **Benefit:** 
- Automatic credential rotation
- No credential exposure risk
- Follows AWS security best practices
- Fine-grained permission control via IAM policies

---

## Rollback Instructions (If Needed)

To revert these changes:
1. Restore `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to docker-compose.yml
2. Restore explicit credential passing in terminal-server.ts
3. Restore credential passing in websocket.routes.ts
4. Rebuild and redeploy

However, this would return to the insecure hardcoded credentials approach.

---

## References

- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [AWS IAM Roles Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)
- [AWS SDK Credential Chain](https://docs.aws.amazon.com/sdk-for-javascript/latest/developer-guide/setting-credentials.html)
- [AWS App Runner IAM Roles](https://docs.aws.amazon.com/apprunner/latest/dg/security_iam_service-with-iam.html)
