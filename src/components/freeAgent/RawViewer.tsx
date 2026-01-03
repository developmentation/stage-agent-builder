import React, { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, ArrowRight, ArrowLeft, Copy, Check } from "lucide-react";
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

  // Update selected iteration when new data comes in
  useEffect(() => {
    if (rawData.length > 0) {
      setSelectedIteration(rawData.length);
    }
  }, [rawData.length]);

  const currentData = rawData[selectedIteration - 1];

  const handleCopy = async (text: string, type: "input" | "output") => {
    await navigator.clipboard.writeText(text);
    if (type === "input") {
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 2000);
    } else {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
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
                Input (System Prompt)
              </TabsTrigger>
              <TabsTrigger value="output" className="flex-1 text-xs">
                Output (LLM Response)
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
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
