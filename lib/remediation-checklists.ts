export interface RemediationStep {
  title: string;
  description: string;
  commands: string[];
  verification: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface RemediationChecklist {
  labId: string;
  vulnerabilityTitle: string;
  description: string;
  impact: string;
  steps: RemediationStep[];
  additionalResources: Array<{
    title: string;
    url: string;
  }>;
}

export const remediationChecklists: Record<string, RemediationChecklist> = {
  "lab-1-s3": {
    labId: "lab-1-s3",
    vulnerabilityTitle: "Public S3 Bucket Exposure",
    description:
      "S3 buckets with public read access due to misconfigured ACLs or bucket policies allowing unauthenticated access.",
    impact:
      "Attackers can enumerate and download all files from the bucket without authentication, leading to data breaches, credential theft, and compliance violations.",
    steps: [
      {
        title: "Enable Block Public Access",
        description:
          "Block public access setting prevents any public bucket policies or ACLs from being applied, regardless of their contents.",
        commands: [
          "aws s3api put-public-access-block --bucket BUCKET-NAME --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
        ],
        verification:
          "aws s3api get-public-access-block --bucket BUCKET-NAME | grep true",
        difficulty: "easy",
      },
      {
        title: "Review and Fix Bucket Policy",
        description:
          "Remove or restrict the bucket policy to deny public access and allow only authenticated principals.",
        commands: [
          "aws s3api get-bucket-policy --bucket BUCKET-NAME > policy.json",
          "# Edit policy.json to remove public access (Principal: '*')",
          "aws s3api put-bucket-policy --bucket BUCKET-NAME --policy file://policy.json",
        ],
        verification:
          "aws s3api get-bucket-policy --bucket BUCKET-NAME | grep -v '*'",
        difficulty: "medium",
      },
      {
        title: "Review and Fix Bucket ACL",
        description:
          "Change bucket ACL from public-read or public-read-write to private, restricting access to owner only.",
        commands: [
          "aws s3api get-bucket-acl --bucket BUCKET-NAME",
          "aws s3api put-bucket-acl --bucket BUCKET-NAME --acl private",
        ],
        verification:
          "aws s3api get-bucket-acl --bucket BUCKET-NAME | grep 'FULL_CONTROL'",
        difficulty: "easy",
      },
      {
        title: "Revoke Object ACLs",
        description:
          "Remove public ACLs from individual objects if they were set to public-read or public-read-write.",
        commands: [
          "aws s3api list-objects --bucket BUCKET-NAME --query 'Contents[*].Key' | xargs -I {} aws s3api put-object-acl --bucket BUCKET-NAME --key {} --acl private",
        ],
        verification:
          "aws s3api list-object-versions --bucket BUCKET-NAME --query 'Versions[*].Key' | xargs -I {} aws s3api get-object-acl --bucket BUCKET-NAME --key {}",
        difficulty: "hard",
      },
      {
        title: "Enable Bucket Versioning and MFA Delete",
        description:
          "Enable versioning to track changes and MFA Delete to require multi-factor authentication for object deletion.",
        commands: [
          "aws s3api put-bucket-versioning --bucket BUCKET-NAME --versioning-configuration Status=Enabled",
          "aws s3api put-bucket-versioning --bucket BUCKET-NAME --versioning-configuration Status=Enabled,MFADelete=Enabled --mfa 'arn:aws:iam::ACCOUNT-ID:mfa/device-name' 123456",
        ],
        verification:
          "aws s3api get-bucket-versioning --bucket BUCKET-NAME | grep Status",
        difficulty: "hard",
      },
      {
        title: "Enable Server-Side Encryption",
        description:
          "Enable default encryption for all objects in the bucket using S3-managed keys (SSE-S3) or customer-managed keys (SSE-KMS).",
        commands: [
          "aws s3api put-bucket-encryption --bucket BUCKET-NAME --server-side-encryption-configuration '{\"Rules\": [{\"ApplyServerSideEncryptionByDefault\": {\"SSEAlgorithm\": \"AES256\"}}]}'",
        ],
        verification:
          "aws s3api get-bucket-encryption --bucket BUCKET-NAME",
        difficulty: "medium",
      },
      {
        title: "Enable Bucket Logging",
        description:
          "Enable S3 access logging to track all requests to the bucket for auditing and forensics.",
        commands: [
          "aws s3api put-bucket-logging --bucket BUCKET-NAME --bucket-logging-status '{\"LoggingEnabled\": {\"TargetBucket\": \"LOGGING-BUCKET\", \"TargetPrefix\": \"logs/\"}}'",
        ],
        verification:
          "aws s3api get-bucket-logging --bucket BUCKET-NAME | grep TargetBucket",
        difficulty: "medium",
      },
    ],
    additionalResources: [
      {
        title: "AWS S3 Security Best Practices",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/security.html",
      },
      {
        title: "S3 Block Public Access",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html",
      },
      {
        title: "OWASP: Insecure Direct Object References",
        url: "https://owasp.org/www-community/attacks/IDOR",
      },
    ],
  },
  "lab-2-iam": {
    labId: "lab-2-iam",
    vulnerabilityTitle: "IAM Privilege Escalation",
    description:
      "Users with excessive IAM permissions can escalate their privileges to admin access through various methods like AttachUserPolicy, PutUserPolicy, or AssumeRole.",
    impact:
      "Attackers gain admin-level access to AWS account, allowing them to modify resources, create backdoors, exfiltrate data, and launch attacks on other services.",
    steps: [
      {
        title: "Audit User Permissions",
        description:
          "Review all users and their attached policies to identify those with dangerous permissions.",
        commands: [
          "aws iam list-users --query 'Users[*].UserName'",
          "aws iam list-attached-user-policies --user-name USERNAME",
          "aws iam list-user-policies --user-name USERNAME",
        ],
        verification:
          "aws iam list-attached-user-policies --user-name USERNAME | grep AdministratorAccess",
        difficulty: "easy",
      },
      {
        title: "Remove Admin Policies from Non-Admin Users",
        description:
          "Detach AdministratorAccess and other overly permissive policies from users who don't need them.",
        commands: [
          "aws iam detach-user-policy --user-name USERNAME --policy-arn arn:aws:iam::aws:policy/AdministratorAccess",
          "aws iam delete-user-policy --user-name USERNAME --policy-name INLINE-POLICY-NAME",
        ],
        verification:
          "aws iam list-attached-user-policies --user-name USERNAME",
        difficulty: "easy",
      },
      {
        title: "Implement Least Privilege",
        description:
          "Create custom policies that grant only the minimum permissions needed for each user's role.",
        commands: [
          "# Create custom policy granting only necessary actions",
          "aws iam create-policy --policy-name MinimalS3Access --policy-document file://minimal-policy.json",
          "aws iam attach-user-policy --user-name USERNAME --policy-arn arn:aws:iam::ACCOUNT-ID:policy/MinimalS3Access",
        ],
        verification:
          "aws iam get-user-policy --user-name USERNAME --policy-name POLICY-NAME",
        difficulty: "hard",
      },
      {
        title: "Disable Root Account Access Keys",
        description:
          "Ensure root account doesn't have long-term access keys. Use temporary credentials via MFA.",
        commands: [
          "aws iam list-access-keys --user-name root",
          "# If keys exist, delete them (if they're not being used)",
          "aws iam delete-access-key --access-key-id AKIAIOSFODNN7EXAMPLE",
        ],
        verification:
          "aws iam list-access-keys | grep 'AccessKeyId' | wc -l",
        difficulty: "medium",
      },
      {
        title: "Enable MFA for All Users",
        description:
          "Require Multi-Factor Authentication for all IAM users, especially those with elevated permissions.",
        commands: [
          "aws iam enable-mfa-device --user-name USERNAME --serial-number arn:aws:iam::ACCOUNT-ID:mfa/device-name --authentication-code1 123456 --authentication-code2 654321",
        ],
        verification:
          "aws iam list-mfa-devices --user-name USERNAME",
        difficulty: "medium",
      },
      {
        title: "Create Restrictive Trust Policies for Roles",
        description:
          "Restrict which principals can assume roles to prevent unauthorized privilege escalation.",
        commands: [
          "aws iam update-assume-role-policy-document --role-name ROLE-NAME --policy-document file://restrictive-trust-policy.json",
        ],
        verification:
          "aws iam get-role --role-name ROLE-NAME | grep AssumeRolePolicyDocument",
        difficulty: "hard",
      },
      {
        title: "Monitor IAM Changes with CloudTrail",
        description:
          "Enable CloudTrail logging and set up alerts for IAM policy changes and escalation attempts.",
        commands: [
          "aws cloudtrail create-trail --name iam-audit-trail --s3-bucket-name AUDIT-BUCKET",
          "aws cloudtrail start-logging --name iam-audit-trail",
        ],
        verification:
          "aws cloudtrail describe-trails | grep Name",
        difficulty: "hard",
      },
    ],
    additionalResources: [
      {
        title: "AWS IAM Best Practices",
        url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html",
      },
      {
        title: "IAM Policy Simulator",
        url: "https://policysim.aws.amazon.com/",
      },
      {
        title: "OWASP: Privilege Escalation",
        url: "https://owasp.org/www-community/attacks/Privilege_escalation",
      },
    ],
  },
  "lab-3-ec2": {
    labId: "lab-3-ec2",
    vulnerabilityTitle: "EC2 Instance Exposure and IMDS Exploitation",
    description:
      "EC2 instances with public SSH access or improper IMDS configuration allow attackers to gain shell access and steal temporary credentials.",
    impact:
      "Attackers can gain shell access to instances, steal AWS credentials from IMDS, pivot to other AWS resources, exfiltrate data, or use instances for lateral movement.",
    steps: [
      {
        title: "Audit Security Groups",
        description:
          "Review all security groups and remove SSH access from 0.0.0.0/0.",
        commands: [
          "aws ec2 describe-security-groups --filters Name=ip-permission.from-port,Values=22",
          "# Find groups with unrestricted SSH and note their GroupId",
        ],
        verification:
          "aws ec2 describe-security-groups --group-ids sg-12345678 --query 'SecurityGroups[*].IpPermissions[?FromPort==`22`]'",
        difficulty: "easy",
      },
      {
        title: "Restrict SSH to Specific IPs",
        description:
          "Replace 0.0.0.0/0 with specific IP ranges that actually need SSH access.",
        commands: [
          "aws ec2 revoke-security-group-ingress --group-id sg-12345678 --protocol tcp --port 22 --cidr 0.0.0.0/0",
          "aws ec2 authorize-security-group-ingress --group-id sg-12345678 --protocol tcp --port 22 --cidr 10.0.0.0/8",
        ],
        verification:
          "aws ec2 describe-security-groups --group-ids sg-12345678 | grep 10.0",
        difficulty: "medium",
      },
      {
        title: "Enable IMDSv2 on All Instances",
        description:
          "Force instances to use IMDSv2 instead of IMDSv1 to prevent SSRF/RCE exploitation of IMDS.",
        commands: [
          "aws ec2 modify-instance-metadata-options --instance-id i-1234567890abcdef0 --http-token required --http-put-response-hop-limit 1",
        ],
        verification:
          "aws ec2 describe-instances --instance-ids i-1234567890abcdef0 --query 'Reservations[*].Instances[*].MetadataOptions'",
        difficulty: "medium",
      },
      {
        title: "Disable IMDS if Not Needed",
        description:
          "If the instance doesn't need access to IMDS, disable it completely.",
        commands: [
          "aws ec2 modify-instance-metadata-options --instance-id i-1234567890abcdef0 --http-endpoint disabled",
        ],
        verification:
          "aws ec2 describe-instances --instance-ids i-1234567890abcdef0 | grep HttpEndpoint",
        difficulty: "medium",
      },
      {
        title: "Use IAM Instance Profiles",
        description:
          "Use IAM instance profiles instead of storing credentials on instances. Apply least privilege permissions.",
        commands: [
          "aws iam create-instance-profile --instance-profile-name EC2-Profile",
          "aws iam create-role --role-name EC2-Role --assume-role-policy-document file://trust-policy.json",
          "aws iam add-role-to-instance-profile --instance-profile-name EC2-Profile --role-name EC2-Role",
          "aws ec2 associate-iam-instance-profile --instance-id i-1234567890abcdef0 --iam-instance-profile Name=EC2-Profile",
        ],
        verification:
          "aws ec2 describe-instances --instance-ids i-1234567890abcdef0 | grep IamInstanceProfile",
        difficulty: "hard",
      },
      {
        title: "Use Systems Manager Session Manager Instead of SSH",
        description:
          "Enable Systems Manager Session Manager for secure shell access without requiring SSH or public IPs.",
        commands: [
          "aws iam attach-role-policy --role-name EC2-Role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
          "# Then use: aws ssm start-session --target i-1234567890abcdef0",
        ],
        verification:
          "aws ssm start-session --target i-1234567890abcdef0",
        difficulty: "hard",
      },
      {
        title: "Monitor EC2 Changes with CloudTrail",
        description:
          "Enable CloudTrail to log all EC2 API calls and detect unauthorized modifications.",
        commands: [
          "aws cloudtrail create-trail --name ec2-audit --s3-bucket-name audit-bucket",
          "aws cloudtrail start-logging --name ec2-audit",
        ],
        verification:
          "aws cloudtrail describe-trails | grep Name",
        difficulty: "medium",
      },
    ],
    additionalResources: [
      {
        title: "AWS EC2 Security Best Practices",
        url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security.html",
      },
      {
        title: "IMDSv2 Documentation",
        url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html",
      },
      {
        title: "Systems Manager Session Manager",
        url: "https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html",
      },
    ],
  },
};

export function getRemediationChecklist(
  labId: string
): RemediationChecklist | undefined {
  return remediationChecklists[labId];
}
