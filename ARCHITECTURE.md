# AWS Labs Platform Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cyberange Platform                          │
│  (User Authentication, Purchase Management, JWT Generation)      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    JWT Token + Redirect
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │ Browser │        │ Browser │        │ Browser │
    │ (Client)│        │ (Client)│        │ (Client)│
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                     HTTP/WebSocket
                            │
         ┌──────────────────┼──────────────────┐
         │                                     │
    ┌────▼──────────────┐          ┌──────────▼────────┐
    │   Frontend        │          │   Backend Service │
    │  (Next.js 16)     │          │  (Node.js/Express)│
    │                   │          │                   │
    │ • Login page      │          │ • Lab APIs        │
    │ • Labs dashboard  │          │ • Session manager │
    │ • Terminal UI     │◄────────►│ • WebSocket       │
    │                   │  HTTP    │ • Terminal exec   │
    └───────────────────┘          │                   │
                                   └──────────┬────────┘
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        │                     │                     │
                   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
                   │ AWS STS  │          │ AWS     │          │ Cyberange│
                   │ AssumeRole           │ Control │          │  API     │
                   │          │          │ Tower   │          │          │
                   └────┬────┘          └────┬────┘          └────┬────┘
                        │                    │                    │
         ┌──────────────┘                    │                    │
         │                                   │                    │
    ┌────▼──────────────────────────────────▼─────────────────────┐
    │              AWS Management Account                          │
    │  (Organizations, Control Tower, IAM)                         │
    │                                                              │
    │  • Create member accounts in sandbox OU                      │
    │  • Manage IAM users and permissions                          │
    │  • Generate temporary credentials                            │
    └──────────────────┬───────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
    │ Sandbox │  │ Sandbox │  │ Sandbox │
    │Account 1│  │Account 2│  │Account 3│
    │         │  │         │  │         │
    │ S3 + ┌──┐ │ IAM + ┌──┐ │ EC2 + ┌──┐
    │ IAM +│S3│ │ STS +│IM│ │ STS +│SG│
    │ STS +└──┘ │ SSH +└──┘ │ SSH +└──┘
    │           │           │
    └────┬──────┘           │
         │                  │
         └──────────┬───────┘
                    │
              AWS CLI Access
              (via terminal)
```

## Component Architecture

### 1. Frontend (Next.js 16)

**Pages:**
- `/` - Landing page with login form
- `/labs` - Dashboard showing all available labs
- `/labs/[labId]` - Individual lab with terminal interface

**Components:**
- Terminal UI with real-time command output
- Lab guide with step-by-step instructions
- Session timer with auto-extend functionality
- AWS credential display panel

**API Communication:**
- HTTP REST API for session management
- WebSocket for terminal command execution
- Real-time status updates

### 2. Backend Service (Node.js/Express)

**Main Server (Port 3001):**
```
POST /api/labs/start          - Start lab session
GET  /api/labs/session/:id    - Get session details
POST /api/labs/session/:id/extend - Extend session
POST /api/labs/session/:id/end    - End session
GET  /health                  - Health check
```

**WebSocket Server (Port 3002):**
```
ws://localhost:3002/terminal/:sessionId
  - Execute AWS CLI commands
  - Receive real-time output
  - Handle terminal resize events
```

**Services:**

1. **CyberangeService**
   - Validates JWT tokens
   - Fetches purchase details
   - Notifies session start/end
   
2. **AWSControlTowerService**
   - Creates sandbox AWS accounts
   - Generates IAM users with temporary credentials
   - Attaches lab-specific IAM policies
   - Destroys accounts on session expiry
   
3. **LabSessionService**
   - Manages session lifecycle
   - Tracks active sessions in memory
   - Handles session expiry and cleanup
   - Extends session duration
   
4. **TerminalServer**
   - Manages terminal instances
   - Executes AWS CLI commands with user credentials
   - Returns command output

### 3. AWS Infrastructure

**Management Account:**
- Hosts AWS Control Tower
- Contains Organizations structure
- Manages Sandbox OU
- Provides template for sandbox account creation

**Sandbox Accounts:**
- Created per user session (or shared if configured)
- Have lab-specific IAM permissions
- Isolated from production
- Auto-destroyed after session expiry

**IAM Structure:**
```
Management Account
├── OrganizationAccountAccessRole
│   └── Used by backend to assume role in sandboxes
├── aws-labs-service (IAM User)
│   └── Programmatic access for account creation
└── Organizations API access

Sandbox Account
└── lab-user-{userId}-{timestamp}
    ├── S3 permissions (lab-1)
    ├── IAM permissions (lab-2)
    ├── EC2 permissions (lab-3)
    └── Lab-specific policies
```

## Data Flow

### User Login Flow
```
1. User arrives from Cyberange with JWT token
2. Frontend stores token in localStorage
3. Redirects to /labs page
4. Backend validates token with Cyberange API
```

### Lab Session Creation
```
1. User clicks "Start Lab"
2. Frontend calls POST /api/labs/start with:
   - userId, labId, purchaseId, token
3. Backend:
   - Validates token with Cyberange
   - Creates sandbox account via Control Tower
   - Generates IAM user with temp credentials
   - Creates LabSession record
4. Frontend receives:
   - sessionId
   - WebSocket URL
   - AWS credentials (for reference)
5. Frontend connects to WebSocket terminal
```

### Command Execution Flow
```
1. User types command in terminal UI
2. Frontend sends via WebSocket: {"type": "command", "command": "aws s3 ls"}
3. Backend:
   - Validates session is active
   - Sets AWS credentials as environment variables
   - Spawns child process: /bin/sh -c "aws s3 ls"
   - Captures stdout/stderr
4. Returns JSON response with output
5. Frontend updates terminal display
```

### Session Cleanup
```
1. User clicks "End Lab" OR session expires
2. Backend calls destroySandboxAccount()
3. AWS:
   - Removes IAM user
   - Closes sandbox account
   - Cleanup runs asynchronously
4. LabSession marked as destroyed
5. Frontend redirects to /labs
```

## Security Considerations

### Authentication & Authorization
- JWT tokens validated with Cyberange API
- Session IDs used for WebSocket authentication
- AWS credentials never sent to frontend (except for display)
- Each session has unique sandbox account with minimal permissions

### Isolation
- Each user gets isolated AWS account
- IAM policies restrict access to lab-specific resources
- No cross-user access possible
- Automatic account destruction prevents leakage

### Credential Management
- Temporary AWS credentials generated per session
- Credentials auto-revoked when session ends
- Never stored in logs
- Environment variables only during command execution

### Command Execution
- Commands executed in isolated child process
- AWS CLI runs with session credentials
- Output validated before returning to client
- Timeout protection (30 seconds)

### Cost Control
- AWS Budgets configured per sandbox account
- Session timeouts prevent runaway costs
- Automatic resource cleanup on expiry
- Cost monitoring via Cost Explorer

## Scaling Considerations

### Current Implementation (Single Node)
- All sessions stored in memory
- Suitable for development and testing
- Maximum ~100 concurrent sessions on modern hardware

### For Production Scale

**Database:**
- Store sessions in PostgreSQL/DynamoDB
- Persist command history
- Track usage analytics

**Message Queue:**
- Use Redis/RabbitMQ for command queuing
- Distribute terminal execution across workers
- Enable session migration across servers

**Load Balancing:**
- Horizontal scaling with load balancer
- Sticky sessions for WebSocket persistence
- Auto-scaling based on concurrent sessions

**AWS Account Pooling:**
- Pre-create sandbox accounts
- Reuse accounts across sessions (with cleanup)
- Reduce account creation latency

## Monitoring & Logging

### Frontend Metrics
- Page load times
- Session creation success rate
- Terminal command execution time
- WebSocket connection reliability

### Backend Metrics
- API response times
- Session creation rate
- Sandbox account creation time
- WebSocket message latency
- Error rates by component

### AWS Metrics
- Account creation time (via Control Tower)
- Cost per session
- IAM user creation time
- API rate limits

### Logs
- Request/response logs
- Error stack traces
- Command execution logs (sanitized)
- Session lifecycle events

## Future Enhancements

1. **Multi-Region Support**
   - Deploy backend in multiple regions
   - Route users to nearest region
   - Cross-region account management

2. **Advanced Terminal Features**
   - Full PTY support
   - File upload/download
   - Session recording/playback
   - Syntax highlighting

3. **Analytics**
   - User progress tracking
   - Lab completion metrics
   - Knowledge assessment
   - Certificate generation

4. **Content Management**
   - PDF guide integration
   - Video tutorials
   - Interactive walkthroughs
   - Lab difficulty progression

5. **Enterprise Features**
   - Team management
   - Corporate training program
   - Audit logging
   - Custom lab templates
