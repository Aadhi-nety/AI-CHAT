'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, LogOut } from 'lucide-react';

interface LabsPageProps {
  onLabSelect: (labId: string) => void;
  onLogout: () => void;
}

const labs = [
  {
    id: 'lab-1-s3',
    title: 'AWS S3-LAB',
    description: 'The Leaky S3 Bucket - Discover and exploit a publicly accessible S3 bucket',
    icon: '🔓',
    difficulty: 'Beginner',
    duration: '15 mins',
  },
  {
    id: 'lab-2-iam',
    title: 'AWS IAM-LAB',
    description: 'IAM Privilege Escalation - Start with low privileges and escalate to admin',
    icon: '🚀',
    difficulty: 'Intermediate',
    duration: '20 mins',
  },
  {
    id: 'lab-3-ec2',
    title: 'AWS EC2-LAB',
    description: 'Public EC2 Instance Exploitation - Exploit misconfigured security groups',
    icon: '🖥️',
    difficulty: 'Intermediate',
    duration: '20 mins',
  },
  {
    id: 'lab-4-lambda',
    title: 'AWS LAMBDA-LAB',
    description: 'Lambda Function Data Exposure - Discover sensitive data in function responses',
    icon: '⚡',
    difficulty: 'Advanced',
    duration: '25 mins',
  },
  {
    id: 'lab-5-dynamodb',
    title: 'AWS DYNAMODB-LAB',
    description: 'DynamoDB Security - Exploit misconfigured DynamoDB tables and permissions',
    icon: '🗄️',
    difficulty: 'Advanced',
    duration: '25 mins',
  },
  {
    id: 'lab-6-cloudtrail',
    title: 'AWS CLOUDTRAIL-LAB',
    description: 'CloudTrail Investigation - Detect and investigate AWS API activity',
    icon: '📊',
    difficulty: 'Advanced',
    duration: '30 mins',
  },
  {
    id: 'lab-7-ssm',
    title: 'AWS SSM-LAB',
    description: 'Systems Manager Exploitation - Leverage SSM for lateral movement',
    icon: '🔧',
    difficulty: 'Expert',
    duration: '30 mins',
  },
];

const difficultyColors: Record<string, string> = {
  Beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  Intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Advanced: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Expert: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function LabsPage({ onLabSelect, onLogout }: LabsPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">AWS Security Labs</h1>
            <p className="text-sm text-slate-400">dev@example.com</p>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
          >
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Available Labs</h2>
          <p className="text-slate-400">
            Choose a lab to start practicing AWS security concepts
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab) => (
            <Card
              key={lab.id}
              className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-all cursor-pointer group"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-4xl">{lab.icon}</span>
                  <Lock size={18} className="text-slate-500" />
                </div>
                <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                  {lab.title}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {lab.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${difficultyColors[lab.difficulty]}`}
                    >
                      {lab.difficulty}
                    </span>
                  </div>
                  <span className="text-slate-400">{lab.duration}</span>
                </div>

                <Button
                  onClick={() => onLabSelect(lab.id)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Start Lab
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
