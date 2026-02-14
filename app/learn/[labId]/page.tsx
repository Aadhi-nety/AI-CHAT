'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { educationalLabs } from '@/lib/labs-educational';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, Target, Lightbulb, AlertCircle, CheckCircle, Code, Copy, LifeBuoy, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CheatSheetViewer } from '@/components/cheat-sheet-viewer';
import { TroubleshootingViewer } from '@/components/troubleshooting-viewer';
import { QuizViewer } from '@/components/quiz-viewer';
import { RemediationViewer } from '@/components/remediation-viewer';

export default function LabDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const labId = params.labId as string;
  const lab = educationalLabs.find(l => l.id === labId);
  const [activeTab, setActiveTab] = useState<'overview' | 'cheatsheet' | 'troubleshoot' | 'quiz' | 'remediation'>(
    (searchParams?.get('tab') as any) || 'overview'
  );

  if (!lab) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Lab Not Found</h1>
          <Button asChild>
            <Link href="/labs">Back to Labs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const difficultyColor = {
    Beginner: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Intermediate: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Advanced: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/labs" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Labs
          </Link>
          <h1 className="text-xl font-bold">{lab.title}</h1>
          <div className="w-20"></div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12 space-y-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/50">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('overview')}
            className="gap-2 flex-shrink-0"
          >
            <BookOpen className="h-4 w-4" />
            Overview
          </Button>
          <Button
            variant={activeTab === 'cheatsheet' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('cheatsheet')}
            className="gap-2 flex-shrink-0"
          >
            <Copy className="h-4 w-4" />
            Cheat Sheet
          </Button>
          <Button
            variant={activeTab === 'troubleshoot' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('troubleshoot')}
            className="gap-2 flex-shrink-0"
          >
            <LifeBuoy className="h-4 w-4" />
            Troubleshooting
          </Button>
          <Button
            variant={activeTab === 'quiz' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('quiz')}
            className="gap-2 flex-shrink-0"
          >
            <HelpCircle className="h-4 w-4" />
            Quiz
          </Button>
          <Button
            variant={activeTab === 'remediation' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('remediation')}
            className="gap-2 flex-shrink-0"
          >
            <CheckCircle className="h-4 w-4" />
            Remediation
          </Button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className={`h-16 w-16 rounded-lg ${lab.color} flex items-center justify-center text-white font-bold text-2xl flex-shrink-0`}>
                  {lab.id.split('-')[1].toUpperCase()}
                </div>
                <div className="flex-1">
                  <h1 className="text-4xl font-bold mb-3">{lab.title}</h1>
                  <p className="text-lg text-muted-foreground">{lab.shortDescription}</p>
                  <div className="flex gap-3 mt-4 flex-wrap">
                    <Badge variant="outline" className={difficultyColor[lab.difficulty as keyof typeof difficultyColor]}>
                      {lab.difficulty}
                    </Badge>
                    <Badge variant="outline">~{lab.estimatedTime} minutes</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* About This Lab */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-400" />
                  About This Lab
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                {lab.aboutLab.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph.trim()}</p>
                ))}
              </CardContent>
            </Card>

            {/* Your Mission */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-400" />
                  Your Mission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                {lab.yourMission.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph.trim()}</p>
                ))}
              </CardContent>
            </Card>

            {/* Learning Objectives */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-cyan-400" />
                  Learning Objectives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {lab.learningObjectives.map((objective, i) => (
                    <li key={i} className="flex gap-3 text-muted-foreground">
                      <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* What You Will Learn */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-purple-400" />
                  What You Will Learn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {lab.whatYouWillLearn.map((item, i) => (
                    <li key={i} className="flex gap-3 text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-cyan-400 flex-shrink-0 mt-2"></div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Course Syllabus */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle>Course Syllabus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lab.syllabus.map((section, i) => (
                  <div key={i} className="pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <h3 className="font-semibold text-lg mb-2">{section.topic}</h3>
                    <p className="text-muted-foreground leading-relaxed">{section.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Common Mistakes */}
            <Card className="border-border/50 bg-card/40 backdrop-blur border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-300">
                  <AlertCircle className="h-5 w-5" />
                  Common Mistakes to Avoid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {lab.commonMistakes.map((mistake, i) => (
                    <li key={i} className="flex gap-3 text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-red-400 flex-shrink-0 mt-2"></div>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card className="border-border/50 bg-card/40 backdrop-blur border-green-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-300">
                  <CheckCircle className="h-5 w-5" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {lab.bestPractices.map((practice, i) => (
                    <li key={i} className="flex gap-3 text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0 mt-2"></div>
                      <span>{practice}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Real Commands */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-green-400" />
                  Real AWS CLI Commands You'll Execute
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lab.realCommands.map((cmd, i) => (
                  <div key={i} className="pb-4 border-b border-border/50 last:border-0 last:pb-0 space-y-2">
                    <p className="font-semibold text-cyan-300">{i + 1}. {cmd.description}</p>
                    <div className="bg-black/60 rounded border border-border/50 p-3">
                      <code className="font-mono text-sm text-green-400 break-all">{cmd.command}</code>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">Expected Output:</span>
                    </p>
                    <div className="bg-black/60 rounded border border-border/50 p-3">
                      <code className="font-mono text-sm text-muted-foreground/70 break-all">{cmd.expectedOutput}</code>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

        {/* CTA */}
        <div className="flex gap-4 justify-center pt-8">
          <Button asChild className="h-12 px-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">
            <Link href="/labs">Back to All Labs</Link>
          </Button>
        </div>
          </div>
        )}

        {activeTab === 'cheatsheet' && (
          <CheatSheetViewer labId={labId} />
        )}

        {activeTab === 'troubleshoot' && (
          <TroubleshootingViewer labId={labId} />
        )}

        {activeTab === 'quiz' && (
          <QuizViewer labId={labId} />
        )}

        {activeTab === 'remediation' && (
          <RemediationViewer labId={labId} />
        )}
      </main>
    </div>
  );
}
