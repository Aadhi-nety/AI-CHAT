'use client';

import { CheatSheet, getCheatSheet, exportCheatSheetAsMarkdown } from '@/lib/command-cheat-sheets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Copy } from 'lucide-react';
import { useState } from 'react';

export function CheatSheetViewer({ labId }: { labId: string }) {
  const cheatSheet = getCheatSheet(labId);
  const [copied, setCopied] = useState(false);

  if (!cheatSheet) {
    return <div>Cheat sheet not available for this lab</div>;
  }

  const handleDownload = () => {
    const markdown = exportCheatSheetAsMarkdown(cheatSheet);
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`);
    element.setAttribute('download', `${cheatSheet.title.replace(/\s+/g, '-').toLowerCase()}.md`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{cheatSheet.title}</h2>
          <p className="text-muted-foreground mt-2">{cheatSheet.description}</p>
        </div>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {cheatSheet.commands.map((section, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="text-lg">{section.category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.items.map((item, itemIdx) => (
              <div key={itemIdx} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                <h4 className="font-semibold text-sm">{item.description}</h4>
                <div className="bg-card/50 p-3 rounded-lg font-mono text-sm overflow-x-auto flex justify-between items-start gap-2">
                  <code>{item.command}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyCommand(item.command)}
                    className="ml-auto flex-shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> {item.example}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {cheatSheet.tips.map((tip, idx) => (
              <li key={idx} className="text-sm flex gap-2">
                <span className="text-blue-500">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Common Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {cheatSheet.commonErrors.map((error, idx) => (
              <li key={idx} className="text-sm flex gap-2">
                <span className="text-red-500">!</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
