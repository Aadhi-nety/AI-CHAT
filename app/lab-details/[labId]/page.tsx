'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getLabById } from '@/lib/labs-catalog';
import {
  BookOpen,
  Target,
  Clock,
  BarChart3,
  Star,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Shield,
  ArrowLeft,
  ShoppingCart,
} from 'lucide-react';

export default function LabDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const labId = params.labId as string;
  const lab = getLabById(labId);
  const [isPurchasing, setIsPurchasing] = useState(false);

  if (!lab) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="mb-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Card className="border-border/50 bg-card/40">
            <CardContent className="pt-12 text-center">
              <p className="text-muted-foreground text-lg">Lab not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      // Redirect to Cyberange for purchase
      const cyberangeUrl = `https://cyberange.com/purchase?lab=${lab.id}&price=${lab.price}`;
      window.location.href = cyberangeUrl;
    } catch (error) {
      console.error('Purchase error:', error);
      setIsPurchasing(false);
    }
  };

  const difficultyColors = {
    Beginner: 'bg-emerald-500/20 text-emerald-300',
    Intermediate: 'bg-amber-500/20 text-amber-300',
    Advanced: 'bg-red-500/20 text-red-300',
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mb-8 bg-transparent"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Labs
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Section */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold">{lab.title}</h1>
                  <p className="text-lg text-muted-foreground mt-2">{lab.shortDescription}</p>
                </div>
                <div className={`w-16 h-16 rounded-lg ${lab.color} flex-shrink-0`}></div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-card/40 backdrop-blur border border-border/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Difficulty</div>
                  <Badge className={difficultyColors[lab.difficulty as keyof typeof difficultyColors]}>
                    {lab.difficulty}
                  </Badge>
                </div>
                <div className="bg-card/40 backdrop-blur border border-border/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Duration</div>
                  <div className="font-semibold text-sm">{lab.estimatedTime} min</div>
                </div>
                <div className="bg-card/40 backdrop-blur border border-border/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Price</div>
                  <div className="font-semibold text-sm text-cyan-400">${lab.price}</div>
                </div>
                <div className="bg-card/40 backdrop-blur border border-border/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Rating</div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-semibold">{lab.rating}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Full Description */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  About This Lab
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>{lab.fullDescription}</p>
              </CardContent>
            </Card>

            {/* Real World Scenario */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Your Mission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground whitespace-pre-line">{lab.realWorldScenario}</p>
              </CardContent>
            </Card>

            {/* Learning Objectives */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Learning Objectives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lab.learningObjectives.map((objective, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">{objective}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* What You Will Learn */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  What You Will Learn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lab.whatYouWillLearn.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Syllabus */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle>Course Syllabus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lab.syllabus.map((section, idx) => (
                  <div key={idx} className="pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{section.topic}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Common Mistakes */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  Common Mistakes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lab.commonMistakes.map((mistake, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                    <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{mistake}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Shield className="h-5 w-5" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lab.bestPractices.map((practice, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                    <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{practice}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Prerequisites */}
            {lab.prerequisites.length > 0 && (
              <Card className="border-border/50 bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle>Prerequisites</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lab.prerequisites.map((prereq, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-400"></div>
                      <p className="text-muted-foreground">{prereq}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Purchase Card */}
          <div className="lg:col-span-1">
            <Card className="border-border/50 bg-card/40 backdrop-blur sticky top-8 h-fit">
              <CardHeader>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Price</div>
                    <div className="text-3xl font-bold">${lab.price}</div>
                  </div>

                  <Button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded-lg"
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {isPurchasing ? 'Redirecting...' : 'Purchase Lab'}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Redirects to Cyberange for secure payment
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 border-t border-border/50 pt-4">
                {/* Key Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm">~{lab.estimatedTime} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm">{lab.difficulty} Level</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm">{lab.rating}/5 ({lab.reviews} reviews)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm">{Math.round(lab.popularity)}% students liked this</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="border-t border-border/50 pt-4">
                  <div className="text-xs text-muted-foreground mb-2">Topics</div>
                  <div className="flex flex-wrap gap-2">
                    {lab.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="border-t border-border/50 pt-4">
                  <div className="text-xs text-muted-foreground mb-2">Category</div>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                    {lab.category}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Social Proof */}
            <Card className="border-border/50 bg-card/40 backdrop-blur mt-6">
              <CardHeader>
                <CardTitle className="text-sm">Student Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((_, idx) => (
                  <div key={idx} className="pb-3 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-semibold">Great Learning</div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Very hands-on and educational</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
