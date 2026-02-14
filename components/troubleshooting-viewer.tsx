'use client';

import { getTroubleshootingGuide } from '@/lib/troubleshooting-guide';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function TroubleshootingViewer({ labId }: { labId: string }) {
  const guide = getTroubleshootingGuide(labId);

  if (!guide) {
    return <div>Troubleshooting guide not available for this lab</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{guide.title}</h2>
        <p className="text-muted-foreground mt-2">Common errors and their solutions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {guide.faq.map((item, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`}>
                <AccordionTrigger className="text-sm font-semibold">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {guide.commonIssues.map((issue, idx) => (
              <AccordionItem key={idx} value={`issue-${idx}`}>
                <AccordionTrigger>
                  <span className="text-red-500 font-semibold mr-2">Error:</span>
                  {issue.error}
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Cause</h4>
                    <p className="text-sm text-muted-foreground">{issue.cause}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Solution</h4>
                    <p className="text-sm text-muted-foreground">{issue.solution}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Prevention Tip</h4>
                    <p className="text-sm text-muted-foreground">{issue.preventionTip}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
