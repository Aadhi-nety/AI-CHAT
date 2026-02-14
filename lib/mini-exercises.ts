export interface MiniExercise {
  id: string;
  labId: string;
  stepNumber: number;
  title: string;
  description: string;
  challenge: string;
  expectedOutcome: string;
  hint: string;
  solution: string;
  difficulty: "easy" | "medium" | "hard";
}

export const miniExercises: MiniExercise[] = [
  {
    id: "ex-1-s3-1",
    labId: "lab-1-s3",
    stepNumber: 1,
    title: "Find the Public Bucket",
    description: "Use AWS CLI to enumerate and find publicly accessible S3 buckets",
    challenge:
      "List all S3 buckets without authentication using the --no-sign-request flag. Can you identify which bucket might be public?",
    expectedOutcome:
      "Successfully list S3 buckets and identify 'my-company-secrets-2025' as a candidate",
    hint: "Use 'aws s3api list-buckets' with the --no-sign-request flag to bypass authentication",
    solution: "aws s3api list-buckets --no-sign-request",
    difficulty: "easy",
  },
  {
    id: "ex-1-s3-2",
    labId: "lab-1-s3",
    stepNumber: 2,
    title: "Test Public Access",
    description: "Verify bucket accessibility without credentials",
    challenge: "Check if the 'my-company-secrets-2025' bucket allows public access by listing its contents",
    expectedOutcome: "Successfully list bucket contents without authentication",
    hint: "Use ls command with --no-sign-request to test public access",
    solution: "aws s3 ls s3://my-company-secrets-2025 --no-sign-request",
    difficulty: "easy",
  },
  {
    id: "ex-1-s3-3",
    labId: "lab-1-s3",
    stepNumber: 3,
    title: "Exfiltrate Sensitive Data",
    description: "Download confidential files from the public bucket",
    challenge:
      "Extract the 'financial-records.txt' file from the bucket without credentials to prove the vulnerability",
    expectedOutcome: "Successfully download and display file contents",
    hint: "Use cp command to copy objects from S3 to your local filesystem",
    solution: "aws s3 cp s3://my-company-secrets-2025/financial-records.txt . --no-sign-request",
    difficulty: "medium",
  },
  {
    id: "ex-2-iam-1",
    labId: "lab-2-iam",
    stepNumber: 1,
    title: "Identify Overpermissioned User",
    description: "Find IAM users with excessive permissions",
    challenge: "List IAM users and identify which one has administrative access through inline policies",
    expectedOutcome:
      "Identify 'junior-developer' user with AdministratorAccess inline policy",
    hint: "Use get-user-policy to check inline policies attached to users",
    solution: "aws iam list-users && aws iam list-user-policies --user-name junior-developer",
    difficulty: "medium",
  },
  {
    id: "ex-2-iam-2",
    labId: "lab-2-iam",
    stepNumber: 2,
    title: "Privilege Escalation",
    description: "Escalate privileges by attaching administrative policy",
    challenge: "Attach AdministratorAccess policy to your current user to gain full account control",
    expectedOutcome: "Successfully escalate to full AWS account administrator",
    hint: "Use attach-user-policy with the appropriate policy ARN",
    solution:
      "aws iam attach-user-policy --user-name junior-developer --policy-arn arn:aws:iam::aws:policy/AdministratorAccess",
    difficulty: "hard",
  },
  {
    id: "ex-3-ec2-1",
    labId: "lab-3-ec2",
    stepNumber: 1,
    title: "Discover EC2 Instances",
    description: "Find running EC2 instances in the account",
    challenge:
      "List all EC2 instances and identify their security group and public IP address",
    expectedOutcome: "Identify instance with SSH port open and public IP",
    hint: "Use describe-instances to get detailed instance information",
    solution:
      "aws ec2 describe-instances --query 'Reservations[].Instances[?State.Name==`running`]'",
    difficulty: "easy",
  },
  {
    id: "ex-3-ec2-2",
    labId: "lab-3-ec2",
    stepNumber: 2,
    title: "SSH Exploitation",
    description: "Gain shell access to EC2 instance",
    challenge:
      "Use SSH to connect to the instance and retrieve the flag file from /root/FLAG.txt",
    expectedOutcome: "SSH successfully and access EC2 instance",
    hint: "SSH uses port 22. Use the lab-key-pair.pem for authentication",
    solution: "ssh -i lab-key-pair.pem ec2-user@<instance-ip>",
    difficulty: "hard",
  },
  {
    id: "ex-4-lambda-1",
    labId: "lab-4-lambda",
    stepNumber: 1,
    title: "Find Lambda Functions",
    description: "Identify vulnerable Lambda functions",
    challenge: "List all Lambda functions and identify one that might expose sensitive data",
    expectedOutcome:
      "Identify 'process-payments' function with exposed secrets in environment variables",
    hint: "Use list-functions to enumerate all functions",
    solution: "aws lambda list-functions --region us-east-1",
    difficulty: "easy",
  },
  {
    id: "ex-4-lambda-2",
    labId: "lab-4-lambda",
    stepNumber: 2,
    title: "Extract Secrets from Function",
    description: "Retrieve sensitive data from function environment",
    challenge:
      "Get function configuration and extract database credentials from environment variables",
    expectedOutcome:
      "Successfully extract and display database connection string with credentials",
    hint: "Use get-function-configuration to view environment variables",
    solution: "aws lambda get-function-configuration --function-name process-payments",
    difficulty: "hard",
  },
  {
    id: "ex-5-dynamodb-1",
    labId: "lab-5-dynamodb",
    stepNumber: 1,
    title: "List DynamoDB Tables",
    description: "Discover database tables in the account",
    challenge: "Enumerate all DynamoDB tables without proper authorization",
    expectedOutcome: "Identify 'customers' and 'transactions' tables",
    hint: "Use list-tables to see available DynamoDB tables",
    solution: "aws dynamodb list-tables --no-sign-request",
    difficulty: "easy",
  },
  {
    id: "ex-5-dynamodb-2",
    labId: "lab-5-dynamodb",
    stepNumber: 2,
    title: "Scan for Data",
    description: "Extract data from accessible DynamoDB table",
    challenge: "Scan the customers table and extract all customer records",
    expectedOutcome: "Successfully retrieve all customer data including PII",
    hint: "Use scan operation to retrieve all items from table",
    solution: "aws dynamodb scan --table-name customers --no-sign-request",
    difficulty: "medium",
  },
];
