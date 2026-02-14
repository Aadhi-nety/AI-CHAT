export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  relatedLabs: string[];
}

export const resourcesLibrary: Resource[] = [
  // AWS Official Documentation
  {
    id: "aws-s3-security",
    title: "AWS S3 Security Best Practices",
    description: "Official AWS documentation on S3 bucket security, access control, and encryption.",
    url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/security.html",
    category: "AWS Documentation",
    difficulty: "Beginner",
    relatedLabs: ["lab-1-s3"],
  },
  {
    id: "aws-iam-best-practices",
    title: "AWS IAM Best Practices",
    description: "Comprehensive guide on IAM security, least privilege access, and user management.",
    url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html",
    category: "AWS Documentation",
    difficulty: "Intermediate",
    relatedLabs: ["lab-2-iam"],
  },
  {
    id: "aws-ec2-security",
    title: "EC2 Security Groups and Network ACLs",
    description: "Official guide on EC2 security groups, network segmentation, and access control.",
    url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security.html",
    category: "AWS Documentation",
    difficulty: "Intermediate",
    relatedLabs: ["lab-3-ec2"],
  },
  {
    id: "aws-lambda-security",
    title: "Lambda Security Best Practices",
    description: "AWS documentation on securing Lambda functions, environment variables, and execution roles.",
    url: "https://docs.aws.amazon.com/lambda/latest/dg/lambda-security.html",
    category: "AWS Documentation",
    difficulty: "Advanced",
    relatedLabs: ["lab-4-lambda"],
  },
  {
    id: "aws-dynamodb-security",
    title: "DynamoDB Security",
    description: "Guide on DynamoDB encryption, access control, and data protection.",
    url: "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/security.html",
    category: "AWS Documentation",
    difficulty: "Intermediate",
    relatedLabs: ["lab-5-dynamodb"],
  },
  {
    id: "aws-cloudtrail-logging",
    title: "AWS CloudTrail Logging and Monitoring",
    description: "Comprehensive guide on CloudTrail for audit logging and security monitoring.",
    url: "https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html",
    category: "AWS Documentation",
    difficulty: "Intermediate",
    relatedLabs: ["lab-6-cloudtrail"],
  },
  {
    id: "aws-ssm-parameters",
    title: "AWS Systems Manager Parameter Store",
    description: "Documentation on secure parameter storage and secrets management.",
    url: "https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html",
    category: "AWS Documentation",
    difficulty: "Beginner",
    relatedLabs: ["lab-7-ssm"],
  },

  // OWASP Resources
  {
    id: "owasp-cloud-security",
    title: "OWASP Cloud Security Top 10",
    description: "OWASP's guide to the top 10 cloud security risks and mitigation strategies.",
    url: "https://owasp.org/www-project-cloud-security/",
    category: "OWASP",
    difficulty: "Advanced",
    relatedLabs: ["lab-1-s3", "lab-2-iam", "lab-3-ec2"],
  },
  {
    id: "owasp-authentication",
    title: "OWASP Authentication Cheat Sheet",
    description: "Best practices for secure authentication and credential management.",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
    category: "OWASP",
    difficulty: "Intermediate",
    relatedLabs: ["lab-2-iam"],
  },
  {
    id: "owasp-iac",
    title: "OWASP Infrastructure as Code Security",
    description: "Security best practices for IaC, CloudFormation, and Terraform.",
    url: "https://owasp.org/www-community/attacks/Infrastructure_as_Code",
    category: "OWASP",
    difficulty: "Advanced",
    relatedLabs: ["lab-1-s3", "lab-2-iam", "lab-3-ec2"],
  },

  // Security Best Practices
  {
    id: "cis-aws-benchmark",
    title: "CIS AWS Foundations Benchmark",
    description: "Industry-standard security baseline and best practices for AWS.",
    url: "https://www.cisecurity.org/benchmark/amazon_web_services",
    category: "Security Benchmarks",
    difficulty: "Advanced",
    relatedLabs: ["lab-1-s3", "lab-2-iam", "lab-6-cloudtrail"],
  },
  {
    id: "aws-well-architected-security",
    title: "AWS Well-Architected Framework - Security Pillar",
    description: "AWS framework for designing secure cloud architectures.",
    url: "https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html",
    category: "Security Frameworks",
    difficulty: "Intermediate",
    relatedLabs: ["lab-1-s3", "lab-2-iam", "lab-3-ec2", "lab-5-dynamodb"],
  },
  {
    id: "aws-least-privilege",
    title: "IAM Least Privilege Access Model",
    description: "Complete guide on implementing least privilege access in AWS.",
    url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege",
    category: "Security Best Practices",
    difficulty: "Intermediate",
    relatedLabs: ["lab-2-iam"],
  },

  // Tools and Utilities
  {
    id: "aws-cli-documentation",
    title: "AWS CLI Official Documentation",
    description: "Complete reference for AWS CLI commands and usage.",
    url: "https://docs.aws.amazon.com/cli/latest/userguide/",
    category: "Tools",
    difficulty: "Beginner",
    relatedLabs: ["lab-1-s3", "lab-2-iam", "lab-3-ec2", "lab-4-lambda", "lab-5-dynamodb"],
  },
  {
    id: "aws-iam-policy-simulator",
    title: "AWS IAM Policy Simulator",
    description: "Tool to test and debug IAM policies.",
    url: "https://policysim.aws.amazon.com/",
    category: "Tools",
    difficulty: "Intermediate",
    relatedLabs: ["lab-2-iam"],
  },
  {
    id: "aws-vpc-flow-logs",
    title: "VPC Flow Logs for Security Monitoring",
    description: "Using VPC Flow Logs to detect suspicious network activity.",
    url: "https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html",
    category: "Monitoring",
    difficulty: "Advanced",
    relatedLabs: ["lab-3-ec2"],
  },
];

export const getResourcesByLab = (labId: string): Resource[] => {
  return resourcesLibrary.filter(resource => resource.relatedLabs.includes(labId));
};

export const getResourcesByCategory = (category: string): Resource[] => {
  return resourcesLibrary.filter(resource => resource.category === category);
};

export const getAllCategories = (): string[] => {
  return [...new Set(resourcesLibrary.map(r => r.category))];
};
