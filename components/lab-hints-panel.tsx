'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { getHint, recordHintUsed } from '@/lib/lab-hints';

interface LabHintsPanelProps {
  labId: string;
  stepNumber: number;
  userId: string;
}

export default function LabHintsPanel({ labId, stepNumber, userId }: LabHintsPanelProps) {
  const [expandedHint, setExpandedHint] = useState<1 | 2 | 3 | null>(null);
  const [revealedHints, setRevealedHints] = useState<Set<1 | 2 | 3>>(new Set());

  const handleRevealHint = (hintLevel: 1 | 2 | 3) => {
    if (!revealedHints.has(hintLevel)) {
      recordHintUsed(userId, labId);
      setRevealedHints(new Set([...revealedHints, hintLevel]));
    }
    setExpandedHint(expandedHint === hintLevel ? null : hintLevel);
  };

  const hints = [
    { level: 1 as const, title: 'Subtle Hint', icon: '💭' },
    { level: 2 as const, title: 'Moderate Hint', icon: '🔍' },
    { level: 3 as const, title: 'Solution', icon: '✨' },
  ];

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          Need Help?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          Progressive hints to guide you through this step
        </p>
        {hints.map(({ level, title, icon }) => {
          const hint = getHint(labId, stepNumber, level);
          const isRevealed = revealedHints.has(level);

          return (
            <Button
              key={level}
              onClick={() => handleRevealHint(level)}
              variant="outline"
              className="w-full justify-between text-left bg-transparent border-border/50 hover:bg-card/60 group"
            >
              <div className="flex items-center gap-2">
                <span>{icon}</span>
                <span className="text-sm">{title}</span>
                {isRevealed && <span className="text-xs text-green-400">✓</span>}
              </div>
              {expandedHint === level ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          );
        })}

        {expandedHint && (
          <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm leading-relaxed">
            <p className="text-foreground">{getHint(labId, stepNumber, expandedHint)}</p>
          </div>
        )}

        {revealedHints.size > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Hints revealed: {revealedHints.size}/3
          </p>
        )}
      </CardContent>
    </Card>
  );
}
