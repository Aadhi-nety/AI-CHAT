'use client';

import { getRemediationChecklist } from '@/lib/remediation-checklists';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export function RemediationViewer({ labId }: { labId: string }) {
  const checklist = getRemediationChecklist(labId);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  if (!checklist) {
    return <div>Remediation checklist not available for this lab</div>;
  }

  const toggleStep = (index: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(index)) {
      newCompleted.delete(index);
    } else {
      newCompleted.add(index);
    }
    setCompletedSteps(newCompleted);
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const progressPercentage = (completedSteps.size / checklist.steps.length) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{checklist.vulnerabilityTitle}</h2>
        <p className="text-muted-foreground mt-2">{checklist.description}</p>
      </div>

      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">Security Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{checklist.impact}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remediation Progress</CardTitle>
          <div className="w-full bg-slate-700 h-2 rounded-full mt-4">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {completedSteps.size} of {checklist.steps.length} steps completed
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remediation Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {checklist.steps.map((step, idx) => (
              <AccordionItem key={idx} value={`step-${idx}`}>
                <AccordionTrigger
                  className="text-left"
                  onClick={() => toggleStep(idx)}
                >
                  <div className="flex items-center gap-3 w-full">
                    {completedSteps.has(idx) && (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold">
                        Step {idx + 1}: {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Difficulty: {step.difficulty}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Commands</h4>
                    <div className="space-y-2">
                      {step.commands.map((command, cmdIdx) => (
                        <div
                          key={cmdIdx}
                          className="bg-card/50 p-3 rounded-lg font-mono text-xs overflow-x-auto flex justify-between items-start gap-2 group"
                        >
                          <code>{command}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyCommand(command)}
                            className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Verification</h4>
                    <div className="bg-card/50 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                      <code>{step.verification}</code>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {checklist.additionalResources.map((resource, idx) => (
              <li key={idx}>
                <Link
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm"
                >
                  {resource.title}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
