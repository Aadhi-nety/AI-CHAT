export interface LearningPath {
  id: string;
  name: string;
  description: string;
  order: number;
  labs: string[];
  targetAudience: string;
  estimatedDuration: string;
  prerequisites: string[];
  outcomes: string[];
}

export const learningPaths: LearningPath[] = [
  {
    id: "beginner-path",
    name: "AWS Security Fundamentals",
    description: "Start your AWS security journey with foundational cloud security concepts",
    order: 1,
    labs: ["lab-1-s3", "lab-5-dynamodb"],
    targetAudience: "Cloud beginners, developers new to AWS",
    estimatedDuration: "2-3 hours",
    prerequisites: [],
    outcomes: [
      "Understand cloud storage security basics",
      "Learn common misconfigurations",
      "Practice unauthenticated access exploitation",
    ],
  },
  {
    id: "intermediate-path",
    name: "AWS Identity and Access Exploitation",
    description: "Master IAM and identity-based security attacks",
    order: 2,
    labs: ["lab-2-iam", "lab-3-ec2", "lab-6-cloudtrail"],
    targetAudience: "Developers with AWS experience, security enthusiasts",
    estimatedDuration: "3-4 hours",
    prerequisites: ["beginner-path"],
    outcomes: [
      "Understand IAM privilege escalation",
      "Learn lateral movement techniques",
      "Master security event investigation",
      "Exploit EC2 and SSH vulnerabilities",
    ],
  },
  {
    id: "advanced-path",
    name: "Advanced AWS Attack Scenarios",
    description: "Learn sophisticated attacks and persistence techniques",
    order: 3,
    labs: ["lab-4-lambda", "lab-7-ssm"],
    targetAudience: "Security professionals, advanced practitioners",
    estimatedDuration: "4-5 hours",
    prerequisites: ["intermediate-path"],
    outcomes: [
      "Exploit serverless function vulnerabilities",
      "Master parameter store exploitation",
      "Learn persistence and lateral movement",
      "Understand advanced privilege escalation",
    ],
  },
];

export function getLabPath(labId: string): LearningPath | undefined {
  return learningPaths.find((path) => path.labs.includes(labId));
}

export function getPathProgress(completedLabs: Set<string>): Record<string, number> {
  const progress: Record<string, number> = {};

  learningPaths.forEach((path) => {
    const completedInPath = path.labs.filter((lab) => completedLabs.has(lab)).length;
    progress[path.id] = (completedInPath / path.labs.length) * 100;
  });

  return progress;
}
