'use client';

import React from "react"

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Copy, Trash2 } from 'lucide-react';
import { labData } from '@/lib/lab-data';

interface LabTerminalProps {
  labId: string;
  onBack: () => void;
}

interface TerminalOutput {
  type: 'command' | 'output' | 'info' | 'success' | 'error';
  content: string;
}

export default function LabTerminal({ labId, onBack }: LabTerminalProps) {
  const [output, setOutput] = useState<TerminalOutput[]>([]);
  const [command, setCommand] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lab = labData[labId as keyof typeof labData];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeCommand = (cmd: string) => {
    if (!cmd.trim()) return;

    // Add command to output
    setOutput((prev) => [...prev, { type: 'command', content: `$ ${cmd}` }]);

    // Check if command matches expected commands for current step
    const step = lab?.steps[currentStep];
    if (step && step.commands.some((c) => cmd.includes(c.split(' ')[0]))) {
      // Simulate command execution
      setTimeout(() => {
        setOutput((prev) => [
          ...prev,
          { type: 'success', content: step.expectedOutput },
        ]);
        
        // Mark step as completed and move to next
        const newCompleted = new Set(completedSteps);
        newCompleted.add(currentStep);
        setCompletedSteps(newCompleted);
        
        if (currentStep < lab.steps.length - 1) {
          setCurrentStep(currentStep + 1);
          setTimeout(() => {
            setOutput((prev) => [
              ...prev,
              { type: 'info', content: `Step ${currentStep + 2}: ${lab.steps[currentStep + 1].description}` },
            ]);
          }, 500);
        } else {
          setOutput((prev) => [
            ...prev,
            { type: 'success', content: '🎉 Lab completed! Great job!' },
          ]);
        }
      }, 300);
    } else {
      // Incorrect command
      setTimeout(() => {
        setOutput((prev) => [
          ...prev,
          {
            type: 'error',
            content: `Command not recognized for this step. Try: ${step?.commands.join(' or ')}`,
          },
        ]);
      }, 200);
    }

    setCommand('');
  };

  const clearTerminal = () => {
    setOutput([]);
    setCurrentStep(0);
    setCompletedSteps(new Set());
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(command);
    }
  };

  if (!lab) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">Lab not found</p>
      </div>
    );
  }

  const step = lab.steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <ChevronLeft size={20} className="mr-2" />
            Back to Labs
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Lab Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h1 className="text-3xl font-bold text-white mb-2">{lab.title}</h1>
                <p className="text-slate-300 mb-6">{lab.description}</p>

                <Tabs defaultValue="steps" className="w-full">
                  <TabsList className="bg-slate-700 border-slate-600">
                    <TabsTrigger value="steps">Steps</TabsTrigger>
                    <TabsTrigger value="theory">Learning</TabsTrigger>
                  </TabsList>

                  <TabsContent value="steps" className="space-y-4 mt-6">
                    {lab.steps.map((s, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border transition-all ${
                          idx === currentStep
                            ? 'bg-blue-500/20 border-blue-500 ring-1 ring-blue-500'
                            : completedSteps.has(idx)
                              ? 'bg-green-500/20 border-green-500'
                              : 'bg-slate-700 border-slate-600'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                              idx === currentStep
                                ? 'bg-blue-600 text-white'
                                : completedSteps.has(idx)
                                  ? 'bg-green-600 text-white'
                                  : 'bg-slate-600 text-slate-300'
                            }`}
                          >
                            {completedSteps.has(idx) ? '✓' : idx + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                            <p className="text-slate-300 text-sm mb-3">{s.description}</p>
                            <div className="space-y-2">
                              {s.commands.map((cmd, cmdIdx) => (
                                <div
                                  key={cmdIdx}
                                  className="bg-slate-900 p-3 rounded text-slate-300 text-xs font-mono flex items-center justify-between group"
                                >
                                  <code>{cmd}</code>
                                  <button
                                    onClick={() => copyCommand(cmd)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Copy size={14} className="cursor-pointer hover:text-white" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="theory" className="mt-6">
                    <div className="bg-slate-700 p-6 rounded-lg space-y-4 max-h-96 overflow-y-auto">
                      <div className="text-slate-300 whitespace-pre-line text-sm leading-relaxed">
                        {lab.theory}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Terminal */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-900 border-slate-700 flex flex-col h-[600px]">
              <CardContent className="p-0 flex flex-col h-full">
                {/* Terminal Output */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-slate-950 rounded-t-lg border-b border-slate-700"
                >
                  {output.length === 0 ? (
                    <div className="text-slate-500 text-xs">
                      <div>AWS Labs Terminal v1.0</div>
                      <div>Type commands to practice AWS CLI</div>
                      <div className="mt-4">{`$ `}</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {output.map((line, idx) => (
                        <div
                          key={idx}
                          className={`${
                            line.type === 'command'
                              ? 'text-slate-300'
                              : line.type === 'error'
                                ? 'text-red-400'
                                : line.type === 'success'
                                  ? 'text-green-400'
                                  : 'text-blue-400'
                          }`}
                        >
                          {line.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-3 bg-slate-900 space-y-3 rounded-b-lg">
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded border border-slate-700">
                    <span className="text-slate-500">$</span>
                    <Input
                      ref={inputRef}
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter command..."
                      className="bg-transparent border-0 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                    />
                  </div>

                  <Button
                    onClick={() => clearTerminal()}
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
