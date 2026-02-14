'use client';

import React from "react"

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowRight, Shield, Zap, Terminal } from 'lucide-react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCyberange, setIsFromCyberange] = useState(false);

  useEffect(() => {
    // Check if coming from Cyberange via token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const cyberangeUserId = params.get('userId');
    const purchaseId = params.get('purchaseId');

    if (token && cyberangeUserId) {
      setIsFromCyberange(true);
      localStorage.setItem('sessionToken', token);
      localStorage.setItem('userId', cyberangeUserId);
      localStorage.setItem('purchaseId', purchaseId || '');
      window.location.href = '/labs';
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // For demo: accept any credentials
      // In production, validate with Cyberange
      if (!email || !password) {
        throw new Error('Please enter email and password');
      }

      // Store demo session
      const demoToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ email, iat: Date.now() }))}.demo`;
      localStorage.setItem('sessionToken', demoToken);
      localStorage.setItem('userId', email.split('@')[0]);
      localStorage.setItem('purchaseId', `purchase-${Date.now()}`);

      window.location.href = '/labs';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background gradient effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">AWS Labs</span>
          </div>
          <div className="text-sm text-muted-foreground">Powered by Cyberange</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="space-y-8">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
                Master AWS Security
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  {" "}with Real Sandboxes
                </span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Practice real AWS CLI commands in isolated sandbox environments. Learn security best practices through hands-on exercises without affecting production systems.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-950/50 border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-card border-border/50 h-12 text-base"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-card border-border/50 h-12 text-base"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold text-base rounded-lg transition-all duration-200"
              >
                {loading ? 'Signing in...' : 'Start Learning'} 
                {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
              </Button>

              <p className="text-xs text-muted-foreground text-center pt-2">
                Demo mode: Use any email/password to explore
              </p>
            </form>

            {/* Stats */}
            <div className="flex gap-8 pt-4">
              <div>
                <div className="text-2xl font-bold text-blue-400">7</div>
                <div className="text-sm text-muted-foreground">Active Labs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-cyan-400">100%</div>
                <div className="text-sm text-muted-foreground">Hands-On</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">Real</div>
                <div className="text-sm text-muted-foreground">AWS Accounts</div>
              </div>
            </div>
          </div>

          {/* Right side visual */}
          <div className="relative h-96 hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl border border-border/50 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center space-y-4">
                <Terminal className="w-24 h-24 text-cyan-400 mx-auto opacity-50" />
                <p className="text-muted-foreground">Live Terminal Environment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <Card className="border-border/50 bg-card/50 backdrop-blur hover:border-blue-500/50 hover:bg-card/80 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Real Sandbox Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Each lab creates actual AWS accounts with temporary credentials and minimal permissions
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur hover:border-cyan-500/50 hover:bg-card/80 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-500 flex items-center justify-center mb-4">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Live CLI Terminal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Execute real AWS CLI commands and get immediate feedback from your sandbox environment
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur hover:border-purple-500/50 hover:bg-card/80 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-purple-500 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Auto Cleanup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sandbox accounts are automatically destroyed when your session expires for zero waste
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="space-y-8">
          <div className="text-center space-y-2 mb-12">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="text-muted-foreground">Four simple steps to start your AWS security journey</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { num: '1', title: 'Login', desc: 'Authenticate with your Cyberange account' },
              { num: '2', title: 'Choose Lab', desc: 'Select from 7 AWS security labs' },
              { num: '3', title: 'Sandbox Ready', desc: 'Real AWS account created in seconds' },
              { num: '4', title: 'Learn & Practice', desc: 'Execute real AWS CLI commands' },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center font-bold text-white">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>AWS Security Labs Platform</p>
          <p>Powered by Cyberange</p>
        </div>
      </footer>
    </div>
  );
}
