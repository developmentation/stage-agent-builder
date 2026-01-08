import React, { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, ArrowRight, ArrowLeft, Copy, Check, Wrench, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RawIterationData } from "@/types/freeAgent";
import { safeStringify } from "@/lib/safeRender";
import { toast } from "sonner";

interface RawViewerProps {
  rawData: RawIterationData[];
}

export function RawViewer({ rawData }: RawViewerProps) {
  const [selectedIteration, setSelectedIteration] = useState<number>(
    rawData.length > 0 ? rawData.length : 1
  );
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedTools, setCopiedTools] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Update selected iteration when new data comes in
  useEffect(() => {
    if (rawData.length > 0) {
      setSelectedIteration(rawData.length);
    }
  }, [rawData.length]);

  const currentData = rawData[selectedIteration - 1];

  const handleCopy = async (text: string, type: "input" | "output" | "tools" | "all") => {
    await navigator.clipboard.writeText(text);
    if (type === "input") {
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 2000);
    } else if (type === "output") {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    } else if (type === "all") {
      setCopiedAll(true);
      toast.success("Copied full iteration data");
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      setCopiedTools(true);
      setTimeout(() => setCopiedTools(false), 2000);
    }
  };

  const copyFullIteration = () => {
    if (!currentData) return;
    const fullData = {
      iteration: selectedIteration,
      input: {
        model: currentData.input.model,
        userPrompt: currentData.input.userPrompt,
        systemPrompt: currentData.input.systemPrompt,
        scratchpadLength: currentData.input.scratchpadLength,
        blackboardEntries: currentData.input.blackboardEntries,
        previousResultsCount: currentData.input.previousResultsCount,
      },
      output: {
        rawResponse: currentData.output.rawLLMResponse || currentData.output.parseError?.rawResponse,
        errorMessage: currentData.output.errorMessage,
      },
      toolResults: currentData.toolResults,
    };
    handleCopy(JSON.stringify(fullData, null, 2), "all");
  };

  return (
    <Card className="h-full flex flex-col border-0 rounded-none">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Code className="w-4 h-4" />
          Raw Data
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyFullIteration}
                  disabled={!currentData}
                  className="ml-auto h-7 px-2"
                >
                  {copiedAll ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Copy full iteration (input, output, tools)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>

        {/* Iteration selector */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIteration <= 1}
            onClick={() => setSelectedIteration((prev) => Math.max(1, prev - 1))}
          >
            <ArrowLeft className="w-3 h-3" />
          </Button>
          <span className="text-sm min-w-[100px] text-center">
            Iteration {selectedIteration} / {rawData.length || 0}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIteration >= rawData.length}
            onClick={() => setSelectedIteration((prev) => Math.min(rawData.length, prev + 1))}
          >
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {!currentData ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No raw data yet. Start a session to capture LLM input/output.
          </div>
        ) : (
          <Tabs defaultValue="input" className="h-full flex flex-col">
            <TabsList className="mx-4 mb-2">
              <TabsTrigger value="input" className="flex-1 text-xs">
                Input
              </TabsTrigger>
              <TabsTrigger value="output" className="flex-1 text-xs">
                Output
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex-1 text-xs">
                Tools ({currentData.toolResults?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="flex-1 overflow-hidden m-0 px-4 pb-4">
              <div className="h-full flex flex-col bg-muted/50 rounded-md">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                  <div className="text-xs text-muted-foreground space-x-3">
                    <span>Model: {currentData.input.model}</span>
                    <span>Scratchpad: {currentData.input.scratchpadLength} chars</span>
                    <span>Blackboard: {currentData.input.blackboardEntries} entries</span>
                    <span>Prev Results: {currentData.input.previousResultsCount}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(currentData.input.fullPromptSent || currentData.input.systemPrompt || "", "input")}
                    className="h-6 px-2"
                  >
                    {copiedInput ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  {/* Show user prompt prominently at the top */}
                  {currentData.input.userPrompt && (
                    <div className="mx-3 mt-3 mb-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                      <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">User Task:</div>
                      <div className="text-sm font-mono">{currentData.input.userPrompt}</div>
                    </div>
                  )}
                  <pre className="text-xs p-3 whitespace-pre-wrap break-all font-mono leading-relaxed">
                    {currentData.input.systemPrompt || "(not captured)"}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="output" className="flex-1 overflow-hidden m-0 px-4 pb-4">
              <div className="h-full flex flex-col bg-muted/50 rounded-md">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                  <div className="text-xs text-muted-foreground">
                    <span>
                      Response length: {currentData.output.parseError?.responseLength || currentData.output.rawLLMResponse?.length || 0} chars
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(currentData.output.rawLLMResponse || currentData.output.parseError?.rawResponse || "", "output")}
                    className="h-6 px-2"
                  >
                    {copiedOutput ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                {currentData.output.parseError ? (
                  // Show error state with full raw response
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 mx-3 mt-3">
                      <div className="text-sm font-medium text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Parse Error: {currentData.output.errorMessage || "Failed to parse LLM response"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Response length: {currentData.output.parseError.responseLength} chars
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      <pre className="text-xs p-3 whitespace-pre-wrap break-all font-mono leading-relaxed">
                        {currentData.output.rawLLMResponse || currentData.output.parseError.rawResponse || "(no response captured)"}
                      </pre>
                    </ScrollArea>
                  </div>
                ) : (
                  // Normal output display
                  <ScrollArea className="flex-1">
                    <pre className="text-xs p-3 whitespace-pre-wrap break-all font-mono leading-relaxed">
                      {currentData.output.rawLLMResponse || "(not captured)"}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tools" className="flex-1 overflow-hidden m-0 px-4 pb-4">
              <div className="h-full flex flex-col bg-muted/50 rounded-md">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wrench className="w-3 h-3" />
                    <span>{currentData.toolResults?.length || 0} tool calls this iteration</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(JSON.stringify(currentData.toolResults, null, 2), "tools")}
                    className="h-6 px-2"
                  >
                    {copiedTools ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  {currentData.toolResults && currentData.toolResults.length > 0 ? (
                    <div className="p-3 space-y-3">
                      {currentData.toolResults.map((tr, idx) => (
                        <div key={idx} className="border border-border/50 rounded-md overflow-hidden">
                          <div className={`px-3 py-1.5 text-xs font-medium flex items-center justify-between ${
                            tr.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
                          }`}>
                            <span className="font-mono">{tr.tool}</span>
                            <Badge variant={tr.success ? "default" : "destructive"} className="text-[10px] h-4">
                              {tr.success ? "SUCCESS" : "ERROR"}
                            </Badge>
                          </div>
                          <pre className="text-xs p-3 whitespace-pre-wrap break-all font-mono leading-relaxed bg-background/50 max-h-[300px] overflow-auto">
                            {tr.error 
                              ? `Error: ${safeStringify(tr.error)}` 
                              : safeStringify(tr.result) || "(no result)"}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-4">
                      No tool calls this iteration
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
