"use client";

import React from "react"

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, X, Copy, Check } from "lucide-react";
import { useTerminal } from "@/hooks/use-terminal";
import { apiClient } from "@/lib/api-client";

interface TerminalOutput {
  type: "system" | "output" | "error" | "input";
  text: string;
  timestamp: number;
}

const LAB_CONTENT: Record<string, { title: string; steps: string[] }> = {
  "lab-1-s3": {
    title: "AWS S3 Security Lab",
    steps: [
      "List S3 buckets: aws s3 ls",
      "Check bucket permissions: aws s3api get-bucket-acl --bucket <bucket-name>",
      "Explore bucket contents: aws s3 ls s3://<bucket-name>/",
      "Download file: aws s3 cp s3://<bucket-name>/file.txt .",
    ],
  },
  "lab-2-iam": {
    title: "IAM Privilege Escalation Lab",
    steps: [
      "Get current user: aws iam get-user",
      "List all users: aws iam list-users",
      "List policies: aws iam list-policies",
      "Get inline policies: aws iam list-user-policies --user-name <username>",
    ],
  },
  "lab-3-ec2": {
    title: "EC2 Security Group Lab",
    steps: [
      "Describe security groups: aws ec2 describe-security-groups",
      "Describe instances: aws ec2 describe-instances",
      "Get instance details: aws ec2 describe-instances --instance-ids <id>",
      "Check security group rules: aws ec2 describe-security-group-rules",
    ],
  },
  "lab-4-lambda": {
    title: "Lambda Data Exposure Lab",
    steps: [
      "List Lambda functions: aws lambda list-functions",
      "Get function config: aws lambda get-function-configuration --function-name <name>",
      "List layers: aws lambda list-layers",
      "Get layer version: aws lambda get-layer-version --layer-name <name> --version-number 1",
    ],
  },
  "lab-5-dynamodb": {
    title: "DynamoDB Scanning Lab",
    steps: [
      "List tables: aws dynamodb list-tables",
      "Describe table: aws dynamodb describe-table --table-name <name>",
      "Scan table: aws dynamodb scan --table-name <name>",
      "Query table: aws dynamodb query --table-name <name> --key-condition-expression 'id = :id' --expression-attribute-values '{\":id\":{\"S\":\"value\"}}'",
    ],
  },
  "lab-6-cloudtrail": {
    title: "CloudTrail Investigation Lab",
    steps: [
      "Lookup events: aws cloudtrail lookup-events",
      "Describe trails: aws cloudtrail describe-trails",
      "Get trail status: aws cloudtrail get-trail-status --name <trail-name>",
      "List events with filter: aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=PutObject",
    ],
  },
  "lab-7-ssm": {
    title: "SSM Session Manager Lab",
    steps: [
      "Describe instances: aws ssm describe-instance-information",
      "List sessions: aws ssm describe-sessions --filters 'key=target,value=<instance-id>'",
      "Get command invocation: aws ssm get-command-invocation --command-id <id> --instance-id <instance-id>",
      "Send command: aws ssm send-command --instance-ids <instance-id> --document-name 'AWS-RunShellScript' --parameters 'commands=whoami'",
    ],
  },
};

export default function LabPage() {
  const params = useParams();
  const labId = params.labId as string;

  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<TerminalOutput[]>([]);
  const [credentials, setCredentials] = useState<{
    accessKeyId: string;
    region: string;
  } | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const { isConnected, executeCommand } = useTerminal(
    sessionId ? `${process.env.NEXT_PUBLIC_BACKEND_URL?.replace("http", "ws") || "ws://localhost:3001"}/terminal/${sessionId}` : "",
    {
      onMessage: (msg) => {
        if (msg.type === "connected") {
          addOutput("system", msg.message || "Connected to terminal");
        } else if (msg.type === "output") {
          addOutput("output", msg.data || "");
        } else if (msg.type === "error") {
          addOutput("error", msg.message || "Error occurred");
        }
      },
      onError: (err) => {
        addOutput("error", `Connection error: ${err.message}`);
      },
    }
  );

  const addOutput = (type: TerminalOutput["type"], text: string) => {
    setOutput((prev) => [...prev, { type, text, timestamp: Date.now() }]);
    setTimeout(() => {
      outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
    }, 0);
  };

  // Load session
  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = localStorage.getItem("sessionId");
        if (!stored) {
          setError("No active session. Please start a lab first.");
          return;
        }

        setSessionId(stored);

        const session = await apiClient.getSession(stored);
        setCredentials(session.credentials);
        setExpiresAt(session.expiresAt);

        addOutput("system", "Connected to AWS sandbox account");
        addOutput("system", `Region: ${session.credentials.region}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Update timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (expiresAt) {
        const remaining = Math.max(0, expiresAt - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);

        if (remaining <= 0) {
          setError("Session expired");
          clearInterval(timer);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleExecuteCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    addOutput("input", `$ ${command}`);
    executeCommand(command);
    setCommand("");
  };

  const handleCopyStep = (step: string) => {
    navigator.clipboard.writeText(step.split(": ")[1] || step);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const labContent = LAB_CONTENT[labId] || LAB_CONTENT["lab-1-s3"];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-muted-foreground">Initializing AWS sandbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{labContent.title}</h1>
            <p className="text-sm text-muted-foreground">Real AWS sandbox environment</p>
          </div>
          <div className="flex items-center gap-6">
            {credentials && (
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Region</div>
                  <div className="font-mono text-cyan-400">{credentials.region}</div>
                </div>
                <div className="h-8 w-px bg-border"></div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Time Remaining</div>
                  <div className={`font-mono font-bold ${expiresAt - Date.now() < 600000 ? "text-red-400" : "text-green-400"}`}>
                    {timeRemaining}
                  </div>
                </div>
              </div>
            )}
            <Button
              onClick={() => {
                apiClient.endSession(sessionId);
                localStorage.clear();
                window.location.href = "/labs";
              }}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30"
              variant="outline"
            >
              <X className="h-4 w-4 mr-2" />
              End Lab
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-950/50 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)]">
          {/* Guide Panel - Left Sidebar */}
          <div className="lg:col-span-1 overflow-hidden flex flex-col">
            <Card className="border-border/50 bg-card/40 backdrop-blur flex flex-col h-full">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-lg">Lab Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 flex-1 overflow-y-auto py-4">
                {labContent.steps.map((step, idx) => {
                  const command = step.split(": ")[1] || step;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-gradient-to-r from-blue-600/10 to-cyan-600/10 hover:from-blue-600/20 hover:to-cyan-600/20 transition-all duration-200 group cursor-pointer border border-border/50 hover:border-blue-500/50"
                      onClick={() => handleCopyStep(step)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground font-semibold mb-1">STEP {idx + 1}</div>
                          <div className="text-xs font-mono text-cyan-300 break-all leading-relaxed">{command}</div>
                        </div>
                        <div className="flex-shrink-0 text-muted-foreground group-hover:text-cyan-400 transition-colors">
                          {copiedStep === step ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Terminal Panel - Main Area */}
          <div className="lg:col-span-3 overflow-hidden flex flex-col">
            <Card className="border-border/50 bg-card/40 backdrop-blur flex flex-col h-full">
              <CardHeader className="border-b border-border/50 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`}></div>
                  <CardTitle className="text-lg">AWS CLI Terminal</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">{isConnected ? "Connected" : "Connecting..."}</span>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 overflow-hidden flex flex-col py-4">
                {/* Terminal Output */}
                <div className="flex-1 overflow-hidden">
                  <div
                    ref={outputRef}
                    className="bg-black/60 rounded-lg border border-border/50 h-full overflow-y-auto p-4 font-mono text-sm"
                  >
                    {output.length === 0 ? (
                      <div className="text-muted-foreground/50 text-center py-8">
                        <div className="text-base mb-2">Terminal Ready</div>
                        <p className="text-xs">Select a step or enter your AWS CLI command below</p>
                      </div>
                    ) : (
                      output.map((line, idx) => (
                        <div
                          key={idx}
                          className={`mb-1 leading-relaxed ${
                            line.type === "error"
                              ? "text-red-400"
                              : line.type === "input"
                                ? "text-green-400"
                                : line.type === "system"
                                  ? "text-blue-400"
                                  : "text-foreground/80"
                          }`}
                        >
                          {line.type === "input" ? `$ ${line.text}` : line.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Command Input */}
                <form onSubmit={handleExecuteCommand} className="flex gap-2">
                  <span className="text-muted-foreground flex-shrink-0">$</span>
                  <Input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="aws --help or enter your command..."
                    className="flex-1 bg-background/50 border-border/50 h-10 font-mono text-sm"
                    disabled={!isConnected}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={!isConnected || !command.trim()}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200"
                  >
                    Execute
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
