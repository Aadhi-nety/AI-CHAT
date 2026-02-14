export interface LabCatalog {
  id: string;
  name: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  price: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  estimatedTime: number; // in minutes
  category: string;
  prerequisites: string[];
  learningObjectives: string[];
  whatYouWillLearn: string[];
  syllabus: {
    topic: string;
    description: string;
  }[];
  realWorldScenario: string;
  commonMistakes: string[];
  bestPractices: string[];
  color: string;
  icon: string;
  tags: string[];
  popularity: number;
  rating: number;
  reviews: number;
}

export const labsCatalog: LabCatalog[] = [
  {
    id: 'lab-1-s3',
    name: 'S3 Security',
    title: 'The Leaky S3 Bucket',
    shortDescription: 'Learn how misconfigured S3 buckets expose sensitive data and how to prevent it',
    fullDescription: `AWS S3 is one of the most frequently targeted services due to misconfigurations. In this hands-on lab, you'll discover how a publicly accessible S3 bucket can leak entire databases, financial records, and customer information without any authentication.

You'll learn to:
- Identify publicly accessible S3 buckets
- Exploit bucket policies and access controls
- Extract sensitive data like a real attacker
- Understand the tools and techniques used in real-world breaches

This lab mirrors actual security incidents where companies like Capital One and Facebook had exposed customer data through S3 buckets.`,
    price: 49,
    difficulty: 'Beginner',
    duration: '45 min',
    estimatedTime: 45,
    category: 'Storage Security',
    prerequisites: ['Basic AWS knowledge'],
    learningObjectives: [
      'Identify S3 security misconfigurations',
      'Exploit public bucket access',
      'Understand bucket policies and ACLs',
      'Implement security controls',
    ],
    whatYouWillLearn: [
      'How S3 bucket policies work and where they go wrong',
      'The difference between "Block Public Access" settings and bucket policies',
      'How to discover exposed buckets using public tools',
      'Real-world attack patterns from actual breaches',
      'Prevention and detection strategies',
    ],
    syllabus: [
      {
        topic: 'S3 Fundamentals',
        description: 'Understand how S3 buckets, objects, and access controls work',
      },
      {
        topic: 'Common Misconfigurations',
        description: 'Identify and exploit typical S3 security mistakes',
      },
      {
        topic: 'Exploitation Techniques',
        description: 'Practice real attacks on vulnerable buckets',
      },
      {
        topic: 'Defense & Mitigation',
        description: 'Learn how to secure S3 buckets properly',
      },
    ],
    realWorldScenario: `You're a security auditor hired by a company. Your task is to find exposed data before attackers do. 
You discover a misconfigured S3 bucket containing financial records, database backups, and source code. 
Your goal is to retrieve this data and present findings to the company's CISO.`,
    commonMistakes: [
      'Disabling "Block All Public Access" for troubleshooting and forgetting to re-enable it',
      'Using overly permissive bucket policies (Principal: "*")',
      'Not enabling versioning or logging',
      'Storing sensitive data without encryption',
      'Not using CloudFront for public content delivery',
    ],
    bestPractices: [
      'Always enable "Block All Public Access" by default',
      'Use least privilege principle for bucket policies',
      'Enable versioning and MFA delete',
      'Use AWS Config to monitor bucket configurations',
      'Implement CloudTrail logging for all S3 access',
      'Use IAM Access Analyzer to audit bucket access',
      'Encrypt all sensitive data with KMS',
    ],
    color: 'bg-gradient-to-br from-orange-600 to-orange-500',
    icon: 'Bucket',
    tags: ['storage', 'misconfiguration', 'beginner', 'data-exposure'],
    popularity: 95,
    rating: 4.8,
    reviews: 342,
  },

  {
    id: 'lab-2-iam',
    name: 'IAM Privilege Escalation',
    title: 'From Zero to Hero Admin',
    shortDescription: 'Exploit IAM misconfigurations to escalate from a limited user to full AWS admin',
    fullDescription: `Identity and Access Management (IAM) is often the weakest link in AWS security. This lab teaches you how attackers escalate privileges by exploiting common IAM misconfigurations.

Starting with a user who can barely list their own information, you'll:
- Discover dangerous IAM permissions
- Chain multiple IAM actions to gain admin access
- Understand privilege escalation paths
- Learn how to audit and fix IAM policies

Based on research from Tal Be'ery and AWS CIRT, this lab covers 18+ real privilege escalation vectors.`,
    price: 59,
    difficulty: 'Intermediate',
    duration: '60 min',
    estimatedTime: 60,
    category: 'Identity & Access',
    prerequisites: ['Lab 1: S3 Security recommended', 'Understanding of IAM basics'],
    learningObjectives: [
      'Identify dangerous IAM permissions',
      'Execute privilege escalation attacks',
      'Understand trust relationships and role assumption',
      'Detect and prevent privilege escalation attempts',
    ],
    whatYouWillLearn: [
      'The 18+ most common IAM privilege escalation paths',
      'How to enumerate IAM permissions and find weak policies',
      'Techniques to assume roles and temporary credentials',
      'How attackers chain multiple IAM actions',
      'Detection and prevention strategies',
    ],
    syllabus: [
      {
        topic: 'IAM Fundamentals',
        description: 'Users, roles, policies, and trust relationships',
      },
      {
        topic: 'Permission Enumeration',
        description: 'How to discover what permissions you have',
      },
      {
        topic: 'Escalation Vectors',
        description: 'Learn 18+ ways to escalate privileges',
      },
      {
        topic: 'Detection & Response',
        description: 'How to catch and prevent these attacks',
      },
    ],
    realWorldScenario: `You have compromised a developer's AWS credentials. The credentials have minimal permissions - 
they can only list users and read policies. Your task is to escalate these credentials to admin access 
without triggering security alerts. You have 60 minutes to gain full AWS account control.`,
    commonMistakes: [
      'Allowing iam:PassRole without resource restrictions',
      'Overly permissive policy documents with "*" actions',
      'Not restricting trust relationships on roles',
      'Using service roles with too many permissions',
      'Not auditing IAM policies regularly',
    ],
    bestPractices: [
      'Use least privilege for all IAM policies',
      'Implement resource-based restrictions',
      'Use IAM Access Analyzer to find public access',
      'Enable CloudTrail for all IAM API calls',
      'Use service control policies (SCPs) for additional guardrails',
      'Regularly audit and remove unused permissions',
      'Use temporary credentials instead of long-term access keys',
    ],
    color: 'bg-gradient-to-br from-blue-600 to-blue-500',
    icon: 'Users',
    tags: ['iam', 'privilege-escalation', 'intermediate', 'identity'],
    popularity: 88,
    rating: 4.7,
    reviews: 298,
  },

  {
    id: 'lab-3-ec2',
    name: 'EC2 Security Groups',
    title: 'Exploiting Overpermissive Security Groups',
    shortDescription: 'Find and exploit misconfigured EC2 security groups to gain SSH access',
    fullDescription: `Security Groups are the firewall for your EC2 instances. When misconfigured, they allow attackers to access databases, web servers, and internal services. 

In this lab, you'll:
- Find exposed EC2 instances with SSH access
- Connect to vulnerable instances
- Explore the internal network
- Understand lateral movement techniques
- Learn how to properly secure security groups

This lab demonstrates why "deny all by default, allow by exception" is critical.`,
    price: 55,
    difficulty: 'Intermediate',
    duration: '50 min',
    estimatedTime: 50,
    category: 'Network Security',
    prerequisites: ['Basic networking knowledge', 'SSH familiarity'],
    learningObjectives: [
      'Identify overpermissive security group rules',
      'Exploit public SSH access',
      'Understand security group rule chains',
      'Implement proper network segmentation',
    ],
    whatYouWillLearn: [
      'How security groups work as stateful firewalls',
      'Common misconfigurations that expose instances',
      'How to discover and connect to exposed instances',
      'Lateral movement within AWS networks',
      'VPC and security group best practices',
    ],
    syllabus: [
      {
        topic: 'Security Group Basics',
        description: 'Understand inbound/outbound rules and state',
      },
      {
        topic: 'Common Misconfigurations',
        description: '0.0.0.0/0 and when it is dangerous',
      },
      {
        topic: 'Exploitation',
        description: 'Connect to exposed instances and explore',
      },
      {
        topic: 'Defense',
        description: 'Proper segmentation and access control',
      },
    ],
    realWorldScenario: `Your company has deployed EC2 instances for a new application. DevOps accidentally left SSH open to the entire internet (0.0.0.0/0) for "easy debugging". 
You've discovered this vulnerability. Your mission: access the instance, explore what's running, and demonstrate the risk.`,
    commonMistakes: [
      'Opening SSH (port 22) to 0.0.0.0/0 for "convenience"',
      'Not removing default security group rules',
      'Exposing database ports to the internet',
      'Not implementing network segmentation',
      'Using SSH instead of Systems Manager Session Manager',
    ],
    bestPractices: [
      'Never open SSH/RDP to 0.0.0.0/0',
      'Use AWS Systems Manager Session Manager instead of SSH',
      'Implement security groups per tier (web, app, database)',
      'Use NACLs for additional network filtering',
      'Enable VPC Flow Logs to monitor traffic',
      'Use AWS Security Groups Best Practices tool',
      'Implement bastion hosts for instance access',
    ],
    color: 'bg-gradient-to-br from-purple-600 to-purple-500',
    icon: 'Network',
    tags: ['ec2', 'networking', 'intermediate', 'access-control'],
    popularity: 82,
    rating: 4.6,
    reviews: 215,
  },

  {
    id: 'lab-4-lambda',
    name: 'Lambda Security',
    title: 'Leaking Secrets from Lambda Functions',
    shortDescription: 'Extract sensitive data and environment variables from Lambda functions',
    fullDescription: `Lambda functions often contain hardcoded credentials, API keys, and database passwords in environment variables. In this lab, you'll discover how these secrets are exposed and exploited.

You will:
- Invoke Lambda functions with different permissions
- Extract environment variables and secrets
- Access sensitive data in function code
- Understand Lambda execution roles
- Learn proper secrets management

This lab shows why AWS Secrets Manager and parameter store are critical for serverless applications.`,
    price: 52,
    difficulty: 'Intermediate',
    duration: '45 min',
    estimatedTime: 45,
    category: 'Serverless Security',
    prerequisites: ['Understanding of Lambda basics'],
    learningObjectives: [
      'Identify Lambda security misconfigurations',
      'Extract secrets from functions',
      'Understand Lambda execution roles',
      'Implement proper secrets management',
    ],
    whatYouWillLearn: [
      'How Lambda environment variables work and their risks',
      'Why hardcoded credentials are dangerous',
      'How to properly manage secrets in Lambda',
      'AWS Secrets Manager vs Parameter Store',
      'Lambda execution role security',
    ],
    syllabus: [
      {
        topic: 'Lambda Fundamentals',
        description: 'Functions, environments, and execution context',
      },
      {
        topic: 'Common Misconfigurations',
        description: 'Hardcoded secrets and exposed variables',
      },
      {
        topic: 'Exploitation',
        description: 'Extract and use discovered credentials',
      },
      {
        topic: 'Secure Implementation',
        description: 'Proper secrets management patterns',
      },
    ],
    realWorldScenario: `Your company has deployed a Lambda function for processing payments. 
During a security audit, you discover the function has database credentials stored in environment variables. 
Your task is to access these credentials and demonstrate the breach path to the development team.`,
    commonMistakes: [
      'Storing secrets in environment variables as plain text',
      'Using overly permissive Lambda execution roles',
      'Not encrypting Lambda environment variables',
      'Logging sensitive data to CloudWatch',
      'Not rotating credentials regularly',
    ],
    bestPractices: [
      'Never store secrets in environment variables',
      'Use AWS Secrets Manager for credential rotation',
      'Use IAM roles with minimal permissions',
      'Enable VPC execution for database access',
      'Use encryption at rest and in transit',
      'Implement least privilege for Lambda roles',
      'Monitor and alert on credential access',
    ],
    color: 'bg-gradient-to-br from-amber-600 to-amber-500',
    icon: 'Zap',
    tags: ['lambda', 'secrets', 'intermediate', 'serverless'],
    popularity: 75,
    rating: 4.5,
    reviews: 182,
  },

  {
    id: 'lab-5-dynamodb',
    name: 'DynamoDB Security',
    title: 'Scanning DynamoDB for Data Exfiltration',
    shortDescription: 'Exploit misconfigured DynamoDB permissions to scan and extract sensitive data',
    fullDescription: `DynamoDB is AWS's managed NoSQL database. Misconfigured permissions allow attackers to scan entire tables and extract customer data, personal information, and business secrets.

In this lab, you'll:
- Discover vulnerable DynamoDB tables
- Scan and query tables without authorization
- Extract large datasets
- Understand table-level and item-level security
- Implement proper DynamoDB security

Based on real incidents where millions of records were exposed.`,
    price: 54,
    difficulty: 'Advanced',
    duration: '55 min',
    estimatedTime: 55,
    category: 'Database Security',
    prerequisites: ['DynamoDB knowledge recommended', 'Lab 2: IAM recommended'],
    learningObjectives: [
      'Identify DynamoDB permission misconfigurations',
      'Execute unauthorized scans and queries',
      'Understand item-level security limitations',
      'Implement proper DynamoDB access controls',
    ],
    whatYouWillLearn: [
      'DynamoDB access control model and limitations',
      'How to enumerate DynamoDB tables',
      'Scanning vs querying and their security implications',
      'Batch operations and data exfiltration techniques',
      'DynamoDB encryption and access patterns',
    ],
    syllabus: [
      {
        topic: 'DynamoDB Architecture',
        description: 'Tables, items, attributes, and indexes',
      },
      {
        topic: 'Access Control',
        description: 'IAM policies and DynamoDB Streams',
      },
      {
        topic: 'Data Exfiltration',
        description: 'Scanning and querying at scale',
      },
      {
        topic: 'Securing DynamoDB',
        description: 'Encryption, VPC, and monitoring',
      },
    ],
    realWorldScenario: `Your company stores user profiles in DynamoDB. An attacker gains credentials with "dynamodb:Scan" permission. 
Your mission is to scan the entire table and extract all customer data including emails, phone numbers, and personal information. 
Time limit: 10 minutes to exfiltrate the database.`,
    commonMistakes: [
      'Granting dynamodb:Scan without resource restrictions',
      'Using overly permissive wildcard permissions',
      'Not enabling encryption for sensitive tables',
      'Not using VPC endpoints for DynamoDB access',
      'Missing encryption keys rotation',
    ],
    bestPractices: [
      'Use least privilege for DynamoDB IAM policies',
      'Implement fine-grained access controls with condition keys',
      'Enable encryption at rest with customer-managed keys',
      'Use VPC endpoints to restrict access',
      'Enable Point-in-Time Recovery (PITR)',
      'Implement DynamoDB Streams for audit logging',
      'Use attribute-based access control (ABAC)',
    ],
    color: 'bg-gradient-to-br from-red-600 to-red-500',
    icon: 'Database',
    tags: ['dynamodb', 'database', 'advanced', 'data-exfiltration'],
    popularity: 68,
    rating: 4.4,
    reviews: 156,
  },

  {
    id: 'lab-6-cloudtrail',
    name: 'CloudTrail Forensics',
    title: 'Investigating AWS Activity Logs',
    shortDescription: 'Learn to investigate CloudTrail logs to detect and respond to security incidents',
    fullDescription: `CloudTrail is AWS's audit logging service. In this lab, you'll learn to investigate CloudTrail logs to identify suspicious activity, track attacker movements, and respond to incidents.

You will:
- Analyze CloudTrail events for suspicious activity
- Track user actions and API calls
- Identify lateral movement patterns
- Understand logging gaps and blind spots
- Implement proper log monitoring

This lab teaches incident response fundamentals in AWS.`,
    price: 49,
    difficulty: 'Advanced',
    duration: '60 min',
    estimatedTime: 60,
    category: 'Monitoring & Logging',
    prerequisites: ['Understanding of CloudTrail', 'Incident response basics'],
    learningObjectives: [
      'Read and interpret CloudTrail logs',
      'Identify suspicious activity patterns',
      'Track lateral movement and privilege escalation',
      'Implement effective monitoring and alerting',
    ],
    whatYouWillLearn: [
      'CloudTrail event structure and important fields',
      'How to search and filter CloudTrail events',
      'Patterns that indicate compromise',
      'Blind spots and log manipulation techniques',
      'Integration with SIEM and alert systems',
    ],
    syllabus: [
      {
        topic: 'CloudTrail Basics',
        description: 'Events, trails, and logging mechanisms',
      },
      {
        topic: 'Event Analysis',
        description: 'Reading and interpreting audit logs',
      },
      {
        topic: 'Incident Investigation',
        description: 'Tracking attacker movements',
      },
      {
        topic: 'Monitoring & Response',
        description: 'Alerting and automated response',
      },
    ],
    realWorldScenario: `An attacker has compromised a developer account. You have the CloudTrail logs from the past 24 hours. 
Your mission is to:
1. Identify the initial compromise
2. Track all the attacker's actions
3. Determine what data was accessed
4. Present findings in an incident report`,
    commonMistakes: [
      'Not enabling CloudTrail on all regions and accounts',
      'Disabling CloudTrail during troubleshooting and forgetting to re-enable',
      'Not protecting CloudTrail logs from modification',
      'Storing logs without S3 versioning and MFA delete',
      'Not alerting on critical API calls',
    ],
    bestPractices: [
      'Enable CloudTrail on all AWS accounts and regions',
      'Store logs in S3 with versioning and MFA delete',
      'Use S3 Object Lock for immutable logs',
      'Enable log integrity validation',
      'Integrate with CloudWatch and SIEM',
      'Alert on sensitive API calls (IAM changes, root usage)',
      'Implement automated response for suspicious events',
    ],
    color: 'bg-gradient-to-br from-green-600 to-green-500',
    icon: 'FileText',
    tags: ['cloudtrail', 'logging', 'advanced', 'forensics'],
    popularity: 72,
    rating: 4.5,
    reviews: 198,
  },

  {
    id: 'lab-7-ssm',
    name: 'Systems Manager Security',
    title: 'Lateral Movement via Session Manager',
    shortDescription: 'Use IAM permissions to access EC2 instances through AWS Systems Manager',
    fullDescription: `AWS Systems Manager Session Manager provides secure shell access to EC2 instances without SSH keys. In this lab, you'll learn how misconfigured IAM permissions allow lateral movement and unauthorized instance access.

You will:
- Discover EC2 instances and their details
- Use Systems Manager to gain shell access
- Execute commands on remote instances
- Understand session logging and monitoring
- Implement proper access controls

This lab shows how IAM permissions can be chained for lateral movement.`,
    price: 51,
    difficulty: 'Advanced',
    duration: '50 min',
    estimatedTime: 50,
    category: 'Access & Orchestration',
    prerequisites: ['Lab 2: IAM recommended', 'EC2 instance basics'],
    learningObjectives: [
      'Understand Systems Manager Session Manager',
      'Discover and access EC2 instances',
      'Execute commands on remote systems',
      'Detect and prevent unauthorized access',
    ],
    whatYouWillLearn: [
      'How Session Manager works and its security model',
      'IAM permissions required for Session Manager',
      'How to discover instances and their details',
      'Command execution and output handling',
      'Session logging and compliance implications',
    ],
    syllabus: [
      {
        topic: 'Session Manager Basics',
        description: 'Architecture and how it replaces SSH',
      },
      {
        topic: 'IAM Permissions',
        description: 'What permissions are needed and how to misconfig',
      },
      {
        topic: 'Lateral Movement',
        description: 'Using Session Manager for access',
      },
      {
        topic: 'Audit & Prevention',
        description: 'Monitoring and restricting Session Manager',
      },
    ],
    realWorldScenario: `You have compromised an IAM user with ec2:DescribeInstances and ssm:StartSession permissions. 
Your mission is to:
1. List all EC2 instances in the account
2. Connect to a target instance via Session Manager
3. Execute commands to extract sensitive information
4. Establish persistence for future access`,
    commonMistakes: [
      'Granting ssm:StartSession without resource restrictions',
      'Not implementing required IAM Instance Profile',
      'Not enabling Session Manager logging to CloudWatch',
      'Using overly permissive ssm:SendCommand permissions',
      'Not restricting which instances can be accessed',
    ],
    bestPractices: [
      'Use IAM to restrict which instances can be accessed',
      'Enable CloudWatch logging for all sessions',
      'Use KMS encryption for session data',
      'Implement session recording and audit trails',
      'Require MFA for sensitive commands',
      'Use service-linked roles with minimal permissions',
      'Regularly audit who has Session Manager access',
    ],
    color: 'bg-gradient-to-br from-pink-600 to-pink-500',
    icon: 'Terminal',
    tags: ['ssm', 'systems-manager', 'advanced', 'lateral-movement'],
    popularity: 65,
    rating: 4.3,
    reviews: 142,
  },
];

export function getLabById(id: string): LabCatalog | undefined {
  return labsCatalog.find((lab) => lab.id === id);
}

export function getLabsByCategory(category: string): LabCatalog[] {
  return labsCatalog.filter((lab) => lab.category === category);
}

export function getLabsByDifficulty(difficulty: string): LabCatalog[] {
  return labsCatalog.filter((lab) => lab.difficulty === difficulty);
}

export function searchLabs(query: string): LabCatalog[] {
  const q = query.toLowerCase();
  return labsCatalog.filter(
    (lab) =>
      lab.name.toLowerCase().includes(q) ||
      lab.title.toLowerCase().includes(q) ||
      lab.shortDescription.toLowerCase().includes(q) ||
      lab.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}
