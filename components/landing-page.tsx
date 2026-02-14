'use client';

import React from "react"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth-context';
import { Eye, EyeOff } from 'lucide-react';

interface LandingPageProps {
  onAuthSuccess: () => void;
}

export default function LandingPage({ onAuthSuccess }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { setToken } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Simulate JWT token generation
      const token = btoa(JSON.stringify({ email, exp: Date.now() + 3600000 }));
      setToken(token);
      onAuthSuccess();
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-6xl px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">AWS Security Labs</h1>
          <p className="text-xl text-slate-300">
            Master AWS Security Through Hands-On Practice
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Login Form */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Sign In</CardTitle>
              <CardDescription className="text-slate-400">
                Access your AWS labs training platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>

                <p className="text-xs text-slate-400 text-center">
                  Demo: Use any email/password to login
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="space-y-6">
            <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-2">🔒 Real-World Scenarios</h3>
              <p className="text-slate-300 text-sm">
                Learn from actual AWS security vulnerabilities and best practices
              </p>
            </div>

            <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-2">💻 Interactive Terminal</h3>
              <p className="text-slate-300 text-sm">
                Practice AWS CLI commands in a safe, guided environment
              </p>
            </div>

            <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-2">📚 Guided Learning</h3>
              <p className="text-slate-300 text-sm">
                Step-by-step instructions with expected outputs
              </p>
            </div>

            <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-2">🎯 7 Labs Available</h3>
              <p className="text-slate-300 text-sm">
                S3, IAM, EC2, Lambda, DynamoDB, CloudTrail, and SSM
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
