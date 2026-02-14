export interface TroubleshootingItem {
  error: string;
  cause: string;
  solution: string;
  preventionTip: string;
}

export interface TroubleshootingGuide {
  labId: string;
  title: string;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  commonIssues: TroubleshootingItem[];
}

export const troubleshootingGuides: Record<string, TroubleshootingGuide> = {
  "lab-1-s3": {
    labId: "lab-1-s3",
    title: "S3 Security Lab - Troubleshooting Guide",
    faq: [
      {
        question: "Why can't I list any buckets with --no-sign-request?",
        answer:
          "The command 'aws s3 ls --no-sign-request' lists buckets you have permission to access anonymously. If no results appear, you may not have unauthenticated access to any public buckets. Try searching for the specific bucket name or use authenticated credentials.",
      },
      {
        question: "What's the difference between ListBucket and GetObject permissions?",
        answer:
          "ListBucket permission allows listing objects in a bucket. GetObject permission allows reading object contents. A bucket can be publicly readable (GetObject) but not listable (no ListBucket), meaning you need to know the exact file path.",
      },
      {
        question: "How do I download multiple files from S3?",
        answer:
          'Use "aws s3 sync" to recursively download all objects: aws s3 sync s3://bucket-name . --no-sign-request. Files will be saved to your local directory with the same structure as S3.',
      },
      {
        question: "What does 'AllUsers' mean in bucket ACLs?",
        answer:
          "'AllUsers' refers to unauthenticated internet users. If a bucket ACL grants permissions to AllUsers, it means anyone without AWS credentials can perform those actions. This is extremely dangerous for sensitive data.",
      },
    ],
    commonIssues: [
      {
        error: "NoSuchBucket",
        cause: "The bucket name doesn't exist or is in a different AWS region than specified",
        solution:
          "Verify the exact bucket name spelling. Try: aws s3 ls | grep bucket-name. If still not found, the bucket may be in another region or deleted.",
        preventionTip:
          "Always verify bucket names with 's3 ls' first. Use regional endpoints if accessing buckets in specific regions.",
      },
      {
        error: "AccessDenied or 403 Forbidden",
        cause: "The bucket exists but you don't have permission to access it (not publicly accessible)",
        solution:
          "The bucket has restricted permissions. If testing security, use authenticated AWS credentials with appropriate IAM policies.",
        preventionTip:
          "Implement S3 Block Public Access settings and verify bucket policies before deploying to production.",
      },
      {
        error: "InvalidArgument",
        cause: "Syntax error in command or invalid parameter value",
        solution:
          "Check command syntax carefully. Verify bucket names don't contain special characters and follow S3 naming rules (lowercase, hyphens, dots, numbers only).",
        preventionTip:
          "Use AWS CLI documentation with --help flag to verify command syntax before execution.",
      },
      {
        error: "Connection timeout",
        cause: "Network connectivity issue or endpoint is unreachable",
        solution:
          "Check internet connection. Verify AWS endpoint is accessible. Try with --endpoint-url if using S3-compatible service.",
        preventionTip:
          "For internal systems, ensure security groups allow outbound access to S3 endpoints.",
      },
    ],
  },
  "lab-2-iam": {
    labId: "lab-2-iam",
    title: "IAM Privilege Escalation - Troubleshooting Guide",
    faq: [
      {
        question: "What's the difference between attached policies and inline policies?",
        answer:
          "Attached policies are managed policies (created separately and can be reused). Inline policies are embedded directly in users/roles. To escalate, you need CreatePolicyVersion or PutUserPolicy permissions.",
      },
      {
        question: "How do I know what permissions a user has?",
        answer:
          "Use: aws iam list-attached-user-policies --user-name USERNAME (for managed policies) and aws iam list-user-policies --user-name USERNAME (for inline policies). Then get details with get-user-policy or get-policy-version.",
      },
      {
        question: "What does 'AssumeRole' permission do?",
        answer:
          "AssumeRole allows a user to switch to a different IAM role, potentially gaining its higher permissions. Check trust relationships with get-role and look for broad Principal conditions.",
      },
      {
        question: "Can I escalate privileges without being an IAM admin?",
        answer:
          "Yes, if you have specific permissions like: CreateAccessKey, CreateLoginProfile, AttachUserPolicy, PutUserPolicy, or AssumeRole to privileged roles. These are often overlooked in security groups.",
      },
    ],
    commonIssues: [
      {
        error: "AccessDenied when running IAM commands",
        cause: "Your current user/role lacks IAM:* permissions or specific IAM action permissions",
        solution:
          "You may not have permission to enumerate or modify IAM. Check your current privileges with: aws iam get-user and aws iam list-attached-user-policies.",
        preventionTip:
          "Follow principle of least privilege. Only grant IAM permissions to users who absolutely need them.",
      },
      {
        error: "NoSuchEntity - User or role not found",
        cause: "Username is misspelled or the user doesn't exist",
        solution:
          "List all users first: aws iam list-users to see exact names. IAM is case-sensitive.",
        preventionTip:
          "Maintain a documented inventory of all IAM users and roles for quick reference.",
      },
      {
        error: "MalformedPolicyDocument when creating policy",
        cause: "JSON policy syntax is invalid",
        solution:
          "Validate JSON syntax. Use jq or JSON validators. Most common: missing commas, incorrect statement structure, or invalid ARN format.",
        preventionTip:
          "Use AWS Policy Generator or validated templates instead of writing policies from scratch.",
      },
      {
        error: "Cannot attach policy - policy limit exceeded",
        cause: "User already has maximum (10) inline policies or maximum attached policies",
        solution:
          "Either consolidate policies or remove unused ones. Check: aws iam list-user-policies --user-name USERNAME",
        preventionTip:
          "Monitor policy counts. Consider using managed policies instead of creating excessive inline policies.",
      },
    ],
  },
  "lab-3-ec2": {
    labId: "lab-3-ec2",
    title: "EC2 Security - Troubleshooting Guide",
    faq: [
      {
        question: "How do I find EC2 instances with open SSH access?",
        answer:
          'Use: aws ec2 describe-security-groups --filters Name=ip-permission.from-port,Values=22 Name=ip-permission.cidr,Values=0.0.0.0/0. This finds security groups allowing SSH from anywhere.',
      },
      {
        question: "What is IMDS and why is it dangerous?",
        answer:
          "IMDS (Instance Metadata Service) allows EC2 instances to query their metadata including temporary credentials. If accessible from outside the instance, attackers can steal credentials. Always use IMDSv2 with tokens.",
      },
      {
        question: "Can I access IMDS from my laptop?",
        answer:
          "No, IMDS is only accessible from within the EC2 instance (169.254.169.254). However, if you gain shell access to an instance via SSH or RCE, you can then query IMDS.",
      },
      {
        question: "How do I protect against IMDS exploitation?",
        answer:
          "Use IMDSv2 which requires tokens and HTTP PUT requests (harder to exploit). Disable IMDS if not needed. Restrict security groups. Use IAM instance profiles with minimal permissions.",
      },
    ],
    commonIssues: [
      {
        error: "UnauthorizedOperation - User not authorized to perform ec2:DescribeInstances",
        cause: "Your IAM user/role lacks EC2 read permissions",
        solution:
          "Request IAM permissions or use credentials with EC2 access. Minimum: ec2:DescribeInstances and ec2:DescribeSecurityGroups.",
        preventionTip:
          "Use service roles and instance profiles instead of embedding credentials in instances.",
      },
      {
        error: "Connection refused when trying SSH",
        cause: "Security group doesn't allow inbound SSH (port 22) or instance IP is wrong",
        solution:
          "Verify: 1) Public IP address is correct, 2) Security group allows inbound TCP 22, 3) Network ACLs allow traffic, 4) Instance is running.",
        preventionTip:
          "Restrict SSH to specific IPs instead of 0.0.0.0/0. Use Systems Manager Session Manager instead of SSH when possible.",
      },
      {
        error: "Permission denied when trying SSH with key",
        cause: "Private key has wrong permissions or is incorrect key for the instance",
        solution:
          "Check: chmod 400 keyfile.pem. Verify you're using the correct key pair for this instance. Check authorized_keys on instance.",
        preventionTip:
          "Rotate SSH keys regularly. Use AWS Systems Manager Session Manager for more secure shell access.",
      },
      {
        error: "IMDS not responding or connection timeout",
        cause: "Instance uses IMDSv2 only, or IMDS is disabled, or network routing issue",
        solution:
          "If IMDSv2, use: TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H X-aws-ec2-metadata-token-ttl-seconds:21600) then curl with -H X-aws-ec2-metadata-token:$TOKEN",
        preventionTip:
          "Force IMDSv2 to reduce exploitation surface. Monitor metadata service access patterns.",
      },
    ],
  },
};

export function getTroubleshootingGuide(
  labId: string
): TroubleshootingGuide | undefined {
  return troubleshootingGuides[labId];
}

export function searchTroubleshootingGuide(
  labId: string,
  searchTerm: string
): TroubleshootingItem[] {
  const guide = troubleshootingGuides[labId];
  if (!guide) return [];

  return guide.commonIssues.filter(
    (issue) =>
      issue.error.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.cause.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.solution.toLowerCase().includes(searchTerm.toLowerCase())
  );
}
