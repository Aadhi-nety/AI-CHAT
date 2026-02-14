export interface Hint {
  stepNumber: number;
  hintLevel: 1 | 2 | 3; // 1: Subtle, 2: Moderate, 3: Direct solution
  content: string;
}

export interface LabHints {
  labId: string;
  steps: Array<{
    stepNumber: number;
    description: string;
    hints: Hint[];
  }>;
}

export const labHintsDatabase: Record<string, LabHints> = {
  "lab-1-s3": {
    labId: "lab-1-s3",
    steps: [
      {
        stepNumber: 1,
        description: "List available S3 buckets without authentication",
        hints: [
          {
            stepNumber: 1,
            hintLevel: 1,
            content: "Hint 1: You need to use AWS CLI to list S3 buckets. Think about what flag allows you to bypass authentication.",
          },
          {
            stepNumber: 1,
            hintLevel: 2,
            content: "Hint 2: AWS CLI has a flag called --no-sign-request that skips authentication. Try combining it with the s3 list command.",
          },
          {
            stepNumber: 1,
            hintLevel: 3,
            content: "Solution: aws s3 ls --no-sign-request",
          },
        ],
      },
      {
        stepNumber: 2,
        description: "Access the my-company-secrets-2025 bucket",
        hints: [
          {
            stepNumber: 2,
            hintLevel: 1,
            content: "Hint 1: Now that you found the bucket name, you need to list its contents. Use a similar approach with the --no-sign-request flag.",
          },
          {
            stepNumber: 2,
            hintLevel: 2,
            content: "Hint 2: The command format is: aws s3 ls s3://[bucket-name] --no-sign-request",
          },
          {
            stepNumber: 2,
            hintLevel: 3,
            content: "Solution: aws s3 ls s3://my-company-secrets-2025 --no-sign-request",
          },
        ],
      },
      {
        stepNumber: 3,
        description: "Download the financial-records.txt file",
        hints: [
          {
            stepNumber: 3,
            hintLevel: 1,
            content: "Hint 1: You've found the file. Now you need to copy it to your local machine. Think about cp command for S3.",
          },
          {
            stepNumber: 3,
            hintLevel: 2,
            content: "Hint 2: Use aws s3 cp command to download the file without authentication.",
          },
          {
            stepNumber: 3,
            hintLevel: 3,
            content: "Solution: aws s3 cp s3://my-company-secrets-2025/financial-records.txt . --no-sign-request",
          },
        ],
      },
    ],
  },
  "lab-2-iam": {
    labId: "lab-2-iam",
    steps: [
      {
        stepNumber: 1,
        description: "Enumerate IAM users in the account",
        hints: [
          {
            stepNumber: 1,
            hintLevel: 1,
            content: "Hint 1: Start by exploring what IAM operations you can perform. Try listing users.",
          },
          {
            stepNumber: 1,
            hintLevel: 2,
            content: "Hint 2: Use the IAM list-users command to see all users in the account.",
          },
          {
            stepNumber: 1,
            hintLevel: 3,
            content: "Solution: aws iam list-users",
          },
        ],
      },
      {
        stepNumber: 2,
        description: "Check attached policies for privilege escalation",
        hints: [
          {
            stepNumber: 2,
            hintLevel: 1,
            content: "Hint 1: You need to see what permissions are attached to users. Look for user policies.",
          },
          {
            stepNumber: 2,
            hintLevel: 2,
            content: "Hint 2: Use list-attached-user-policies to see which managed policies are attached.",
          },
          {
            stepNumber: 2,
            hintLevel: 3,
            content: "Solution: aws iam list-attached-user-policies --user-name [vulnerable-user]",
          },
        ],
      },
      {
        stepNumber: 3,
        description: "Attach AdministratorAccess policy",
        hints: [
          {
            stepNumber: 3,
            hintLevel: 1,
            content: "Hint 1: Now that you understand the permissions, try attaching a more powerful policy.",
          },
          {
            stepNumber: 3,
            hintLevel: 2,
            content: "Hint 2: The AdministratorAccess policy has the ARN: arn:aws:iam::aws:policy/AdministratorAccess",
          },
          {
            stepNumber: 3,
            hintLevel: 3,
            content: "Solution: aws iam attach-user-policy --user-name vulnerable-user --policy-arn arn:aws:iam::aws:policy/AdministratorAccess",
          },
        ],
      },
    ],
  },
  "lab-3-ec2": {
    labId: "lab-3-ec2",
    steps: [
      {
        stepNumber: 1,
        description: "Find EC2 instances with open SSH access",
        hints: [
          {
            stepNumber: 1,
            hintLevel: 1,
            content: "Hint 1: You need to find EC2 instances that are accessible. Start by describing instances.",
          },
          {
            stepNumber: 1,
            hintLevel: 2,
            content: "Hint 2: Use describe-instances to list all EC2 instances and their security groups.",
          },
          {
            stepNumber: 1,
            hintLevel: 3,
            content: "Solution: aws ec2 describe-instances",
          },
        ],
      },
      {
        stepNumber: 2,
        description: "Check security group rules for port 22 (SSH)",
        hints: [
          {
            stepNumber: 2,
            hintLevel: 1,
            content: "Hint 1: Look at the security group details to find port 22 open to 0.0.0.0/0.",
          },
          {
            stepNumber: 2,
            hintLevel: 2,
            content: "Hint 2: Use describe-security-groups and filter for inbound rules on port 22.",
          },
          {
            stepNumber: 2,
            hintLevel: 3,
            content: "Solution: aws ec2 describe-security-groups --group-ids [security-group-id]",
          },
        ],
      },
      {
        stepNumber: 3,
        description: "SSH into the instance using the key pair",
        hints: [
          {
            stepNumber: 3,
            hintLevel: 1,
            content: "Hint 1: You have the instance IP and SSH is open. Now use SSH to connect.",
          },
          {
            stepNumber: 3,
            hintLevel: 2,
            content: "Hint 2: The command format is: ssh -i [key-file] ec2-user@[instance-ip]",
          },
          {
            stepNumber: 3,
            hintLevel: 3,
            content: "Solution: ssh -i lab-key-pair.pem ec2-user@54.210.132.101",
          },
        ],
      },
    ],
  },
};

export const getLabHints = (labId: string): LabHints | undefined => {
  return labHintsDatabase[labId];
};

export const getHint = (labId: string, stepNumber: number, hintLevel: 1 | 2 | 3): string | undefined => {
  const labHints = labHintsDatabase[labId];
  if (!labHints) return undefined;
  
  const step = labHints.steps.find(s => s.stepNumber === stepNumber);
  if (!step) return undefined;
  
  const hint = step.hints.find(h => h.hintLevel === hintLevel);
  return hint?.content;
};

export const getUserHintsUsed = (userId: string, labId: string): number => {
  const key = `hints-used-${userId}-${labId}`;
  const count = localStorage.getItem(key);
  return count ? parseInt(count) : 0;
};

export const recordHintUsed = (userId: string, labId: string) => {
  const key = `hints-used-${userId}-${labId}`;
  const current = getUserHintsUsed(userId, labId);
  localStorage.setItem(key, String(current + 1));
};
