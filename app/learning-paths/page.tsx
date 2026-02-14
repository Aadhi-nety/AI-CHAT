'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { learningPaths, getPathProgress } from '@/lib/learning-paths';
import { ArrowRight, CheckCircle2, Lock, Play } from 'lucide-react';

export default function LearningPathsPage() {
  const [sessionToken, setSessionToken] = useState('');
  const [completedLabs, setCompletedLabs] = useState<Set<string>>(new Set());
  const [pathProgress, setPathProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      window.location.href = '/';
      return;
    }
    setSessionToken(token);

    // Load completed labs from localStorage
    const completed = localStorage.getItem('completedLabs');
    if (completed) {
      setCompletedLabs(new Set(JSON.parse(completed)));
    }
  }, []);

  useEffect(() => {
    const progress = getPathProgress(completedLabs);
    setPathProgress(progress);
  }, [completedLabs]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Learning Paths</h1>
          <p className="text-muted-foreground mt-1">Structured progression through AWS security labs</p>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {learningPaths.map((path, index) => {
            const progress = pathProgress[path.id] || 0;
            const isLocked = index > 0 && pathProgress[learningPaths[index - 1].id] < 100;

            return (
              <Card
                key={path.id}
                className="border-border/50 bg-card/40 backdrop-blur overflow-hidden"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white ${
                          isLocked ? 'bg-muted' : 'bg-gradient-to-br from-blue-600 to-cyan-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <CardTitle className="text-xl">{path.name}</CardTitle>
                          {isLocked && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Lock className="h-3 w-3" />
                              Complete previous path to unlock
                            </div>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-muted-foreground mt-2">
                        {path.description}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-cyan-400">{Math.round(progress)}%</div>
                      <div className="text-xs text-muted-foreground">Complete</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Path Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Target Audience</p>
                      <p className="font-semibold text-sm">{path.targetAudience}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-semibold text-sm">{path.estimatedDuration}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Labs</p>
                      <p className="font-semibold text-sm">{path.labs.length} labs</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Completed</p>
                      <p className="font-semibold text-sm">
                        {path.labs.filter((lab) => completedLabs.has(lab)).length}/{path.labs.length}
                      </p>
                    </div>
                  </div>

                  {/* Outcomes */}
                  <div>
                    <h4 className="font-semibold mb-3 text-sm">What You'll Learn</h4>
                    <ul className="space-y-2">
                      {path.outcomes.map((outcome, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-cyan-400 mt-1">→</span>
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Labs in Path */}
                  <div>
                    <h4 className="font-semibold mb-3 text-sm">Labs in This Path</h4>
                    <div className="flex flex-wrap gap-2">
                      {path.labs.map((labId) => {
                        const isCompleted = completedLabs.has(labId);
                        return (
                          <Button
                            key={labId}
                            asChild
                            variant="outline"
                            size="sm"
                            disabled={isLocked}
                            className={`${
                              isCompleted
                                ? 'bg-green-600/20 border-green-500/30 text-green-300'
                                : 'bg-transparent border-border/50'
                            } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Link href={isLocked ? '#' : `/learn/${labId}`}>
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {labId.split('-')[2].toUpperCase()}
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 mr-1" />
                                  {labId.split('-')[2].toUpperCase()}
                                </>
                              )}
                            </Link>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Button */}
                  {!isLocked && (
                    <Button
                      asChild
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                    >
                      <Link href={`/learn/${path.labs[0]}`}>
                        {progress === 0
                          ? 'Start Path'
                          : progress === 100
                            ? 'Review Path'
                            : 'Continue Path'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
