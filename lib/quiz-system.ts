export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface Quiz {
  labId: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  passingScore: number;
}

export interface QuizResult {
  quizId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  answers: Array<{
    questionId: string;
    selectedAnswer: number;
    isCorrect: boolean;
  }>;
  completedAt: Date;
}

export const quizzes: Record<string, Quiz> = {
  "lab-1-s3": {
    labId: "lab-1-s3",
    title: "S3 Security Knowledge Assessment",
    description: "Test your understanding of S3 security vulnerabilities and best practices",
    passingScore: 70,
    questions: [
      {
        id: "s3-q1",
        question: "What does the 'AllUsers' principal mean in an S3 bucket ACL?",
        options: [
          "All users within your AWS organization",
          "All authenticated AWS users",
          "Anyone on the internet without requiring AWS credentials",
          "All users who have logged in to your AWS account",
        ],
        correctAnswer: 2,
        explanation:
          "AllUsers refers to unauthenticated internet users. This is extremely dangerous as it grants access to anyone in the world without any authentication.",
        difficulty: "easy",
      },
      {
        id: "s3-q2",
        question:
          "Which S3 bucket permission allows an attacker to list objects without authentication?",
        options: [
          "GetObject",
          "ListBucket",
          "PutObject",
          "DeleteObject",
        ],
        correctAnswer: 1,
        explanation:
          "ListBucket permission allows listing objects in a bucket. Combined with GetObject, an attacker can enumerate and download all files.",
        difficulty: "easy",
      },
      {
        id: "s3-q3",
        question: "What is the primary benefit of S3 Block Public Access?",
        options: [
          "It encrypts all data in transit",
          "It prevents accidental public bucket exposure by blocking public ACLs and policies",
          "It automatically backs up bucket contents",
          "It provides DDoS protection",
        ],
        correctAnswer: 1,
        explanation:
          "Block Public Access prevents buckets from becoming accidentally public by denying public ACLs and bucket policies, regardless of their content.",
        difficulty: "medium",
      },
      {
        id: "s3-q4",
        question:
          "An S3 bucket has a policy allowing GetObject for Principal '*'. What is the security risk?",
        options: [
          "The bucket can be deleted by anyone",
          "Anyone on the internet can read all objects in the bucket",
          "AWS will charge for bandwidth used by anonymous users",
          "The bucket will become corrupted",
        ],
        correctAnswer: 1,
        explanation:
          "A policy with Principal '*' (meaning anyone) and GetObject permission allows unrestricted read access to all bucket contents. This is a critical misconfiguration.",
        difficulty: "medium",
      },
      {
        id: "s3-q5",
        question: "Which AWS CLI flag allows unauthenticated access to public S3 buckets?",
        options: [
          "--unauthenticated",
          "--public-access",
          "--no-sign-request",
          "--anonymous",
        ],
        correctAnswer: 2,
        explanation:
          "The --no-sign-request flag tells AWS CLI not to sign the request, allowing access to publicly readable buckets without credentials.",
        difficulty: "easy",
      },
      {
        id: "s3-q6",
        question:
          "What is the difference between an inline policy and a managed policy on an S3 bucket?",
        options: [
          "Inline policies apply to S3, managed policies apply to other services",
          "Inline policies are embedded in bucket ACL, managed policies are separate",
          "Managed policies can be reused across resources, inline policies are resource-specific",
          "There is no difference in security",
        ],
        correctAnswer: 2,
        explanation:
          "Managed policies are stored separately and can be attached to multiple resources. Inline policies are embedded directly in one resource only.",
        difficulty: "hard",
      },
      {
        id: "s3-q7",
        question:
          "If an S3 bucket is not publicly listable but objects are publicly readable, can an attacker access the data?",
        options: [
          "No, they cannot guess the object names",
          "Yes, if they know or can guess the object key path",
          "Only if they have AWS credentials",
          "Never, it requires authentication",
        ],
        correctAnswer: 1,
        explanation:
          "If ListBucket is denied but GetObject is public, attackers can't enumerate files but can access them if they know the exact path. This is called 'hidden in plain sight' misconfiguration.",
        difficulty: "hard",
      },
    ],
  },
  "lab-2-iam": {
    labId: "lab-2-iam",
    title: "IAM Privilege Escalation Knowledge Assessment",
    description: "Assess your understanding of IAM privilege escalation techniques",
    passingScore: 70,
    questions: [
      {
        id: "iam-q1",
        question:
          "Which IAM permission would allow a user to elevate their own privileges to admin?",
        options: [
          "iam:GetUser",
          "iam:ListUsers",
          "iam:AttachUserPolicy",
          "iam:DescribePolicy",
        ],
        correctAnswer: 2,
        explanation:
          "The AttachUserPolicy permission allows attaching managed policies to users, including AdministratorAccess. This is a critical privilege escalation vector.",
        difficulty: "medium",
      },
      {
        id: "iam-q2",
        question: "What is an inline policy?",
        options: [
          "A policy that is embedded directly in a user or role",
          "A policy stored in AWS's central policy repository",
          "A policy that is applied temporarily",
          "A policy for inline code execution",
        ],
        correctAnswer: 0,
        explanation:
          "Inline policies are custom policies embedded directly in users or roles, not reusable across resources.",
        difficulty: "easy",
      },
      {
        id: "iam-q3",
        question:
          "How can a user with PutUserPolicy permission escalate privileges?",
        options: [
          "They cannot escalate with this permission alone",
          "They can create a new inline policy and attach it to themselves or another user",
          "They can delete other user policies",
          "They can only read policies",
        ],
        correctAnswer: 1,
        explanation:
          "PutUserPolicy allows creating or updating inline policies. An attacker can create an admin policy and attach it to themselves.",
        difficulty: "medium",
      },
      {
        id: "iam-q4",
        question: "What is the security risk of a user having CreateAccessKey permission?",
        options: [
          "They can only create keys for non-human users",
          "They can create persistent API credentials that survive password changes",
          "It has no security risk",
          "It only allows creating temporary credentials",
        ],
        correctAnswer: 1,
        explanation:
          "CreateAccessKey permission allows creating long-term API credentials. If an attacker gets this, they can create a backdoor access that persists even after password reset.",
        difficulty: "hard",
      },
      {
        id: "iam-q5",
        question: "What does the AssumeRole permission do?",
        options: [
          "It allows assuming a user is valid",
          "It allows switching to a different IAM role and gaining its permissions",
          "It prevents role assumption",
          "It is used for session management only",
        ],
        correctAnswer: 1,
        explanation:
          "AssumeRole allows a user to switch to a different role. If that role has higher privileges, this is a privilege escalation vector.",
        difficulty: "medium",
      },
      {
        id: "iam-q6",
        question:
          "Why is CreatePolicyVersion a dangerous permission?",
        options: [
          "It can delete policies",
          "It allows creating new versions of managed policies with escalated permissions",
          "It prevents policy updates",
          "It is not dangerous",
        ],
        correctAnswer: 1,
        explanation:
          "CreatePolicyVersion allows creating new versions of managed policies. An attacker can create a malicious version that grants admin access.",
        difficulty: "hard",
      },
      {
        id: "iam-q7",
        question: "What is a trust relationship in IAM?",
        options: [
          "A relationship between two AWS accounts",
          "A policy that defines who can assume a specific role",
          "An encryption key relationship",
          "A user authentication token",
        ],
        correctAnswer: 1,
        explanation:
          "Trust relationships (AssumeRolePolicyDocument) define which principals can assume a role. Overly permissive trust policies can allow unauthorized role assumption.",
        difficulty: "medium",
      },
    ],
  },
  "lab-3-ec2": {
    labId: "lab-3-ec2",
    title: "EC2 Security Knowledge Assessment",
    description: "Test your knowledge of EC2 security vulnerabilities and best practices",
    passingScore: 70,
    questions: [
      {
        id: "ec2-q1",
        question:
          "What is the primary security risk of having SSH (port 22) open to 0.0.0.0/0 in a security group?",
        options: [
          "It slows down the instance",
          "It allows brute force attacks from anywhere on the internet",
          "It enables DDoS attacks only",
          "It has no security risk if you use a strong password",
        ],
        correctAnswer: 1,
        explanation:
          "Opening SSH to 0.0.0.0/0 exposes your instance to brute force attacks from anywhere. Strong passwords alone are not sufficient protection.",
        difficulty: "easy",
      },
      {
        id: "ec2-q2",
        question: "What is IMDS (Instance Metadata Service)?",
        options: [
          "A service that manages instance deployments",
          "An API accessible from within EC2 instances that provides instance metadata including temporary credentials",
          "A backup service for EC2",
          "A load balancing service",
        ],
        correctAnswer: 1,
        explanation:
          "IMDS is an on-instance API (169.254.169.254) that provides metadata and temporary IAM credentials. It should be protected from external access.",
        difficulty: "easy",
      },
      {
        id: "ec2-q3",
        question: "How can an attacker exploit IMDS to steal credentials?",
        options: [
          "By querying it over the internet without access to the instance",
          "By gaining shell access to the instance and querying the IMDS endpoint",
          "By modifying security groups",
          "By changing IAM policies",
        ],
        correctAnswer: 1,
        explanation:
          "IMDS is only accessible from the instance itself. An attacker must first gain shell access (via SSH or RCE), then query IMDS to steal temporary credentials.",
        difficulty: "medium",
      },
      {
        id: "ec2-q4",
        question: "What is the main security benefit of IMDSv2 over IMDSv1?",
        options: [
          "It is faster",
          "It requires a token header (PUT request) making it harder to exploit via RCE vulnerabilities",
          "It encrypts all data",
          "It provides additional storage",
        ],
        correctAnswer: 1,
        explanation:
          "IMDSv2 requires a token acquired via HTTP PUT request with a TTL header. This makes IMDS exploitation via simple HTTP GET requests impossible, mitigating SSRF and RCE attacks.",
        difficulty: "medium",
      },
      {
        id: "ec2-q5",
        question: "What is a security group in AWS?",
        options: [
          "A group of users with similar security clearances",
          "A virtual firewall controlling inbound and outbound traffic to EC2 instances",
          "A backup configuration",
          "A monitoring tool",
        ],
        correctAnswer: 1,
        explanation:
          "Security groups are virtual firewalls that control inbound (ingress) and outbound (egress) traffic to EC2 instances. They work at the instance level.",
        difficulty: "easy",
      },
      {
        id: "ec2-q6",
        question:
          "If you have SSH access to an instance, what credential material could you potentially access?",
        options: [
          "Nothing, the instance has no credentials",
          "AWS temporary credentials via IMDS, SSH keys in user directories, application secrets",
          "Only SSH keys",
          "Only user passwords",
        ],
        correctAnswer: 1,
        explanation:
          "With shell access, an attacker can query IMDS for credentials, find SSH keys in ~/.ssh, and access application configuration files containing secrets.",
        difficulty: "hard",
      },
      {
        id: "ec2-q7",
        question: "What is the best practice for EC2 credential management?",
        options: [
          "Embed AWS credentials in instance user data scripts",
          "Use IAM instance profiles to provide temporary credentials without exposing permanent keys",
          "Store credentials in configuration files on the instance",
          "Use the same credentials for all instances",
        ],
        correctAnswer: 1,
        explanation:
          "IAM instance profiles are the recommended approach. They provide temporary credentials automatically without requiring key storage or management on the instance.",
        difficulty: "medium",
      },
    ],
  },
};

export function getQuiz(labId: string): Quiz | undefined {
  return quizzes[labId];
}

export function calculateQuizResult(
  quiz: Quiz,
  answers: number[]
): QuizResult {
  const result: QuizResult = {
    quizId: quiz.labId,
    score: 0,
    totalQuestions: quiz.questions.length,
    percentage: 0,
    passed: false,
    answers: [],
    completedAt: new Date(),
  };

  quiz.questions.forEach((question, index) => {
    const isCorrect = answers[index] === question.correctAnswer;
    if (isCorrect) {
      result.score++;
    }
    result.answers.push({
      questionId: question.id,
      selectedAnswer: answers[index],
      isCorrect,
    });
  });

  result.percentage = Math.round((result.score / result.totalQuestions) * 100);
  result.passed = result.percentage >= quiz.passingScore;

  return result;
}
