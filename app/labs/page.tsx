"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, LogOut, BookOpen, BarChart3, Library, Map } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { educationalLabs } from "@/lib/labs-educational";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LabsPage() {
  const router = useRouter();
  const [startingLab, setStartingLab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  // base URL configured via Vercel environment variable
  // read and trim; environment values sometimes include stray spaces
  let API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
  if (API_BASE && API_BASE.trim() !== API_BASE) {
    console.warn("LabsPage: NEXT_PUBLIC_API_URL contains whitespace, trimming");
    API_BASE = API_BASE.trim();
  }

  useEffect(() => {
    const token = localStorage.getItem("sessionToken");
    const email = localStorage.getItem("userId");
    if (!token) {
      window.location.href = "/";
      return;
    }
    setUserEmail(email || "");
  }, []);

  const handleStartLab = async (labId: string) => {
    setStartingLab(labId);
    setError(null);

    try {
      const userId = localStorage.getItem("userId") || "demo-user";
      const purchaseId = localStorage.getItem("purchaseId") || `purchase-${Date.now()}`;
      // ensure we have a base url from environment
      if (!API_BASE) {
        throw new Error(
          "NEXT_PUBLIC_API_URL is not set. Please configure it in Vercel."
        );
      }
      const backendUrl = API_BASE;

      console.log("[v0] Starting lab:", { labId, userId, backendUrl });

      const response = await fetch(
        `${backendUrl}/api/labs/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            labId,
            purchaseId,
          }),
        }
      );

      console.log("[v0] Response status:", response.status);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      localStorage.setItem("sessionId", data.session.sessionId);
      localStorage.setItem("currentLabId", labId);

      console.log("[v0] Lab started successfully:", data.session.sessionId);
      window.location.href = `/labs/${labId}`;
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : "Failed to start lab";
      console.error("[v0] Error starting lab:", errorMsg);

      // if the backend indicates credential misconfiguration, show a clearer notice
      if (errorMsg.toLowerCase().includes("aws credentials")) {
        setError(
          "Backend AWS credentials are not configured. Please check the server environment or contact the administrator."
        );
      } else {
        setError(
          `${errorMsg}. Make sure NEXT_PUBLIC_API_URL is configured correctly.`
        );
      }
      setStartingLab(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const difficultyConfig = {
    Beginner: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    Intermediate: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    Advanced: "bg-red-500/20 text-red-300 border-red-500/30",
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-sm bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">AWS Security Labs</h1>
              <p className="text-sm text-muted-foreground">Choose your lab and start practicing</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{userEmail}</p>
                <p className="text-xs text-muted-foreground">Active Session</p>
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
          
          {/* Navigation Links */}
          <div className="flex gap-2">
            <Button asChild size="sm" className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30">
              <Link href="/labs">
                <BookOpen className="h-4 w-4 mr-2" />
                Labs
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="bg-transparent border-border/50 hover:bg-card/60">
              <Link href="/learning-paths">
                <Map className="h-4 w-4 mr-2" />
                Paths
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="bg-transparent border-border/50 hover:bg-card/60">
              <Link href="/dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="bg-transparent border-border/50 hover:bg-card/60">
              <Link href="/resources">
                <Library className="h-4 w-4 mr-2" />
                Resources
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-8 bg-red-950/50 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Section Header */}
        <div className="mb-12 space-y-2">
          <h2 className="text-3xl font-bold">Available Labs</h2>
          <p className="text-muted-foreground">7 hands-on security challenges with real AWS sandboxes</p>
        </div>

        {/* Labs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {educationalLabs.map((lab) => (
            <Card
              key={lab.id}
              className="border-border/50 bg-card/40 backdrop-blur hover:border-blue-500/50 hover:bg-card/80 transition-all duration-300 group overflow-hidden relative"
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-cyan-600/0 group-hover:from-blue-600/5 group-hover:to-cyan-600/5 transition-all duration-300"></div>

              <CardHeader className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-lg ${lab.color} flex items-center justify-center text-white font-bold text-lg`}>
                    {lab.id.split("-")[1].toUpperCase()}
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border ${difficultyConfig[lab.difficulty as keyof typeof difficultyConfig]}`}>
                    {lab.difficulty}
                  </span>
                </div>
                <CardTitle className="text-xl">{lab.title}</CardTitle>
                <CardDescription className="text-muted-foreground mt-2">
                  {lab.shortDescription}
                </CardDescription>
              </CardHeader>

              <CardContent className="relative space-y-4">
                {/* Metadata */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <span>~{lab.estimatedTime} minutes</span>
                </div>

                {/* Buttons */}
                <div className="space-y-2 pt-2">
                  <Button
                    asChild
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded-lg"
                  >
                    <Link href={`/learn/${lab.id}`}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      View Curriculum
                    </Link>
                  </Button>
                  <Button
                    onClick={() => handleStartLab(lab.id)}
                    disabled={startingLab === lab.id}
                    className="w-full h-11 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold rounded-lg"
                  >
                    {startingLab === lab.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Launching...
                      </>
                    ) : (
                      <>
                        Start Lab
                        <span className="ml-2">→</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* How It Works */}
          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { num: '1', title: 'Select Lab', desc: 'Choose from 7 AWS security challenges' },
                { num: '2', title: 'Sandbox Created', desc: 'Real AWS account spawned in seconds' },
                { num: '3', title: 'CLI Access', desc: 'Practice real AWS commands safely' },
                { num: '4', title: 'Auto Cleanup', desc: 'Account destroyed after session' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 items-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardHeader>
              <CardTitle>Why AWS Labs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { title: 'Real AWS Accounts', desc: 'Not simulations - actual AWS sandboxes' },
                { title: 'Hands-On Learning', desc: 'Execute real CLI commands safely' },
                { title: 'Zero Risk', desc: 'Isolated accounts destroyed after use' },
                { title: 'Expert Guidance', desc: 'Step-by-step instructions included' },
              ].map((feature, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="font-semibold text-sm">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
