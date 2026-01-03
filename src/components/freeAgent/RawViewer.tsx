import React, { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, ArrowRight, ArrowLeft, Copy, Check, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RawIterationData } from "@/types/freeAgent";

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

  // Update selected iteration when new data comes in
  useEffect(() => {
    if (rawData.length > 0) {
      setSelectedIteration(rawData.length);
    }
  }, [rawData.length]);

  const currentData = rawData[selectedIteration - 1];

  const handleCopy = async (text: string, type: "input" | "output" | "tools") => {
    await navigator.clipboard.writeText(text);
    if (type === "input") {
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 2000);
    } else if (type === "output") {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    } else {
      setCopiedTools(true);
      setTimeout(() => setCopiedTools(false), 2000);
    }
  };

  return (
    <Card className="h-full flex flex-col border-0 rounded-none">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Code className="w-4 h-4" />
          Raw LLM Data
          <Badge variant="secondary" className="ml-auto">
            {rawData.length} iterations
          </Badge>
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
                    onClick={() => handleCopy(currentData.input.systemPrompt || "", "input")}
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
                  <pre className="text-xs p-3 whitespace-pre-wrap font-mono leading-relaxed">
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
                      Response length: {currentData.output.rawLLMResponse?.length || 0} chars
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(currentData.output.rawLLMResponse || "", "output")}
                    className="h-6 px-2"
                  >
                    {copiedOutput ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="text-xs p-3 whitespace-pre-wrap font-mono leading-relaxed">
                    {currentData.output.rawLLMResponse || "(not captured)"}
                  </pre>
                </ScrollArea>
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
                          <pre className="text-xs p-3 whitespace-pre-wrap font-mono leading-relaxed bg-background/50 max-h-[300px] overflow-auto">
                            {tr.error 
                              ? `Error: ${tr.error}` 
                              : JSON.stringify(tr.result, null, 2) || "(no result)"}
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
