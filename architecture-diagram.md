# AWS Security Labs Platform Architecture Diagram

```mermaid
graph TB
    subgraph "Cyberange Platform"
        CA[Cyberange Auth<br/>JWT Token Generation]
    end

    subgraph "User Browsers"
        B1[Browser 1]
        B2[Browser 2]
        B3[Browser 3]
    end

    subgraph "Frontend (Next.js 16)"
        LP[Landing Page<br/>Login Form]
        LD[Labs Dashboard]
        TI[Terminal Interface<br/>WebSocket Terminal]
    end

    subgraph "Backend (Node.js/Express)"
        MS[Main Server<br/>Port 3001<br/>REST APIs]
        WS[WebSocket Server<br/>Port 3002<br/>Terminal Execution]

        subgraph "Services"
            CS[CyberangeService<br/>JWT Validation<br/>Purchase Verification]
            ACTS[AWSControlTowerService<br/>Account Creation<br/>Credential Generation]
            LSS[LabSessionService<br/>Session Management<br/>Cleanup]
            TS[TerminalServer<br/>Command Execution]
        end
    end

    subgraph "AWS Infrastructure"
        subgraph "Management Account"
            CT[AWS Control Tower<br/>Organizations]
            ORG[AWS Organizations<br/>Sandbox OU]
            IAM_M[IAM Roles<br/>OrganizationAccountAccessRole]
        end

        subgraph "Sandbox Accounts"
            SA1[Sandbox Account 1<br/>Lab-specific IAM<br/>S3/IAM/EC2/etc.]
            SA2[Sandbox Account 2<br/>Lab-specific IAM<br/>S3/IAM/EC2/etc.]
            SA3[Sandbox Account N<br/>Lab-specific IAM<br/>S3/IAM/EC2/etc.]
        end
    end

    CA -->|JWT Token + Redirect| B1
    CA -->|JWT Token + Redirect| B2
    CA -->|JWT Token + Redirect| B3

    B1 -->|HTTP/WebSocket| LP
    B2 -->|HTTP/WebSocket| LD
    B3 -->|HTTP/WebSocket| TI

    LP -->|HTTP REST| MS
    LD -->|HTTP REST| MS
    TI -->|WebSocket| WS

    MS --> CS
    MS --> ACTS
    MS --> LSS

    WS --> TS

    CS -->|Validate JWT| CA
    ACTS -->|Create Accounts| CT
    ACTS -->|Manage IAM| IAM_M
    ACTS -->|Provision| SA1
    ACTS -->|Provision| SA2
    ACTS -->|Provision| SA3

    TS -->|Execute Commands| SA1
    TS -->|Execute Commands| SA2
    TS -->|Execute Commands| SA3

    ORG --> SA1
    ORG --> SA2
    ORG --> SA3

    style CA fill:#e1f5fe
    style LP fill:#f3e5f5
    style LD fill:#f3e5f5
    style TI fill:#f3e5f5
    style MS fill:#fff3e0
    style WS fill:#fff3e0
    style CS fill:#e8f5e8
    style ACTS fill:#e8f5e8
    style LSS fill:#e8f5e8
    style TS fill:#e8f5e8
    style CT fill:#ffebee
    style ORG fill:#ffebee
    style IAM_M fill:#ffebee
    style SA1 fill:#fff8e1
    style SA2 fill:#fff8e1
    style SA3 fill:#fff8e1
```

## Diagram Explanation

### Components:
- **Cyberange Platform**: External authentication and purchase management system
- **Frontend**: Next.js application with login, dashboard, and terminal interfaces
- **Backend**: Express server handling REST APIs and WebSocket connections
- **Services**: Modular backend services for different functionalities
- **AWS Infrastructure**: Management account for orchestration and sandbox accounts for isolation

### Data Flow:
1. Users authenticate via Cyberange and receive JWT tokens
2. Frontend communicates with backend via HTTP and WebSocket
3. Backend validates tokens and manages lab sessions
4. AWS Control Tower creates isolated sandbox accounts per session
5. Commands execute in sandbox accounts with temporary credentials
6. Sessions auto-cleanup with account destruction

### Security Features:
- Per-user isolated AWS accounts
- Temporary credentials with auto-revocation
- JWT-based authentication
- Cost controls and monitoring

This diagram provides a high-level overview of the system architecture. For detailed component interactions, refer to the ARCHITECTURE.md file.
