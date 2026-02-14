'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LogOut, BookOpen, TrendingUp, Zap, Clock } from 'lucide-react';
import Link from 'next/link';
import { calculateUserAnalytics, getAllUserProgress } from '@/lib/analytics';
import { educationalLabs } from '@/lib/labs-educational';

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string>('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [labProgress, setLabProgress] = useState<any[]>([]);

  useEffect(() => {
    const email = localStorage.getItem('userId');
    if (!email) {
      window.location.href = '/';
      return;
    }
    
    setUserEmail(email);
    const userAnalytics = calculateUserAnalytics(email);
    const progress = getAllUserProgress(email);
    
    setAnalytics(userAnalytics);
    setLabProgress(progress);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const completionRate = analytics.totalLabsStarted > 0 
    ? Math.round((analytics.totalLabsCompleted / analytics.totalLabsStarted) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Learning Dashboard</h1>
            <p className="text-sm text-muted-foreground">Track your security learning progress</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{userEmail}</p>
              <p className="text-xs text-muted-foreground">Learner</p>
            </div>
            <Button
              onClick={handleLogout}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30"
              variant="outline"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Labs Started</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{analytics.totalLabsStarted}</div>
              <p className="text-xs text-muted-foreground mt-2">out of {educationalLabs.length} available</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{analytics.totalLabsCompleted}</div>
              <p className="text-xs text-muted-foreground mt-2">{completionRate}% completion rate</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyan-400">{Math.round(analytics.averageSuccessRate)}%</div>
              <p className="text-xs text-muted-foreground mt-2">command success rate</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Commands</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">{analytics.totalCommandsAttempted}</div>
              <p className="text-xs text-muted-foreground mt-2">commands attempted</p>
            </CardContent>
          </Card>
        </div>

        {/* Lab Progress */}
        <Card className="border-border/50 bg-card/40 backdrop-blur mb-12">
          <CardHeader>
            <CardTitle>Lab Progress</CardTitle>
            <CardDescription>Track your completion status for each lab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {educationalLabs.map((lab) => {
              const progress = labProgress.find(p => p.labId === lab.id);
              const isCompleted = progress?.isCompleted || false;
              const completionPct = progress?.completionPercentage || 0;
              
              return (
                <div key={lab.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg ${lab.color} flex items-center justify-center text-white font-bold text-sm`}>
                        {lab.id.split('-')[1].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{lab.title}</p>
                        <p className="text-xs text-muted-foreground">{lab.estimatedTime} min • {lab.difficulty}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isCompleted ? (
                        <div className="text-green-400 font-semibold">✓ Complete</div>
                      ) : completionPct > 0 ? (
                        <div className="text-blue-400 font-semibold">{completionPct}%</div>
                      ) : (
                        <div className="text-muted-foreground">Not started</div>
                      )}
                    </div>
                  </div>
                  <Progress value={completionPct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Resources and Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Continue Learning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">
                <Link href="/labs">Back to Labs</Link>
              </Button>
              <Button asChild variant="outline" className="w-full bg-transparent border-border/50 hover:bg-card/60">
                <Link href="/resources">View Resources Library</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Learning Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Avg. time per lab:</span>
                <span className="font-semibold">{analytics.averageTimePerLab} mins</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Hints used:</span>
                <span className="font-semibold">{analytics.totalHintsUsed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Commands per lab:</span>
                <span className="font-semibold">
                  {analytics.totalLabsStarted > 0 
                    ? Math.round(analytics.totalCommandsAttempted / analytics.totalLabsStarted)
                    : 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
