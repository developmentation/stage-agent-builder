import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText, Loader2, CheckCircle2, Clock, Pause, Folder, File, Play } from "lucide-react";
import { Workflow, WorkflowNode } from "@/types/workflow";
import JSZip from "jszip";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface SimpleViewProps {
  workflow: Workflow;
  userInput?: string;
  onUserInputChange?: (input: string) => void;
  onRunAgent?: (agentId: string) => void;
  onRunFunction?: (functionId: string) => void;
}

export const SimpleView = ({ workflow, userInput, onUserInputChange, onRunAgent, onRunFunction }: SimpleViewProps) => {
  const [viewingOutput, setViewingOutput] = useState<{ nodeName: string; output: string } | null>(null);
  const [outputTab, setOutputTab] = useState("view");
  
  // Get the first node from stage one with output as the default expanded node
  const getDefaultExpandedNode = () => {
    const stageOne = workflow.stages.find(s => s.id === '1');
    if (stageOne && stageOne.nodes.length > 0) {
      const firstNodeWithOutput = stageOne.nodes.find(node => node.output);
      return firstNodeWithOutput ? [firstNodeWithOutput.id] : [];
    }
    return [];
  };
  
  const [expandedNodes, setExpandedNodes] = useState<string[]>(getDefaultExpandedNode);
  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Auto-expand streaming nodes and scroll to bottom
  useEffect(() => {
    workflow.stages.forEach((stage) => {
      stage.nodes.forEach((node) => {
        if (node.status === "running" && node.output && !expandedNodes.includes(node.id)) {
          setExpandedNodes(prev => [...prev, node.id]);
        }
        
        // Auto-scroll to bottom when streaming
        if (node.status === "running" && expandedNodes.includes(node.id)) {
          const scrollElement = scrollRefs.current[node.id];
          if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }
        }
      });
    });
  }, [workflow, expandedNodes]);

  // Helper to get all nodes with outputs
  const getNodesWithOutputs = () => {
    const nodesWithOutputs: Array<{ stage: string; node: WorkflowNode }> = [];
    workflow.stages.forEach((stage) => {
      stage.nodes.forEach((node) => {
        if (node.output) {
          nodesWithOutputs.push({ stage: stage.name, node });
        }
      });
    });
    return nodesWithOutputs;
  };

  // Get character count for an output
  const getCharCount = (output: string) => {
    if (typeof output === "string") {
      return output.length;
    }
    return JSON.stringify(output, null, 2).length;
  };

  // Format output for display
  const formatOutput = (output: any): string => {
    if (typeof output === "string") {
      return output;
    }
    return JSON.stringify(output, null, 2);
  };

  // Download individual artifact
  const downloadArtifact = (nodeName: string, output: any) => {
    const content = formatOutput(output);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nodeName.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download stage outputs as zip
  const downloadStage = async (stageName: string) => {
    const stage = workflow.stages.find((s) => s.name === stageName);
    if (!stage) return;

    const zip = new JSZip();
    const stageFolder = zip.folder(stageName.replace(/[^a-z0-9]/gi, "_"));
    if (!stageFolder) return;

    let concatenated = "";

    stage.nodes.forEach((node) => {
      if (node.output) {
        const content = formatOutput(node.output);
        const filename = `${node.name.replace(/[^a-z0-9]/gi, "_")}.txt`;
        stageFolder.file(filename, content);
        concatenated += `\n\n=== ${node.name} ===\n\n${content}`;
      }
    });

    // Add concatenated file at stage level
    if (concatenated) {
      zip.file(`${stageName.replace(/[^a-z0-9]/gi, "_")}_all.txt`, concatenated.trim());
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stageName.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download all outputs as zip
  const downloadAll = async () => {
    const zip = new JSZip();
    let allOutputs = "";

    for (const stage of workflow.stages) {
      const stageFolder = zip.folder(stage.name.replace(/[^a-z0-9]/gi, "_"));
      if (!stageFolder) continue;

      let stageConcatenated = "";

      stage.nodes.forEach((node) => {
        if (node.output) {
          const content = formatOutput(node.output);
          const filename = `${node.name.replace(/[^a-z0-9]/gi, "_")}.txt`;
          stageFolder.file(filename, content);
          stageConcatenated += `\n\n=== ${node.name} ===\n\n${content}`;
          allOutputs += `\n\n=== ${stage.name} > ${node.name} ===\n\n${content}`;
        }
      });

      // Add stage concatenated file
      if (stageConcatenated) {
        stageFolder.file(`${stage.name.replace(/[^a-z0-9]/gi, "_")}_all.txt`, stageConcatenated.trim());
      }
    }

    // Add root concatenated file
    if (allOutputs) {
      zip.file(`all_outputs_${Date.now()}.txt`, allOutputs.trim());
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow_outputs_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get preview text (first 200 chars)
  const getPreview = (output: any): string => {
    const content = formatOutput(output);
    if (content.length <= 200) return content;
    return content.substring(0, 200) + "...";
  };

  // Get stage status based on nodes
  const getStageStatus = (stage: any): "idle" | "running" | "complete" | "error" => {
    if (stage.nodes.length === 0) return "idle";
    
    const hasError = stage.nodes.some((n: WorkflowNode) => n.status === "error");
    if (hasError) return "error";
    
    const hasRunning = stage.nodes.some((n: WorkflowNode) => n.status === "running");
    if (hasRunning) return "running";
    
    // Check if all nodes have completed
    const hasAnyComplete = stage.nodes.some((n: WorkflowNode) => n.status === "complete");
    const allCompleted = stage.nodes.every((n: WorkflowNode) => n.status === "complete" || n.status === "idle");
    
    if (hasAnyComplete && allCompleted) return "complete";
    
    return "idle";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-warning" />;
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "error":
        return <FileText className="h-4 w-4 text-destructive" />;
      case "paused":
        return <Pause className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "!border-l-warning bg-warning/5";
      case "complete":
        return "!border-l-success bg-success/5";
      case "error":
        return "!border-l-destructive bg-destructive/5";
      case "paused":
        return "!border-l-muted-foreground bg-muted/30";
      default:
        return "!border-l-border bg-muted/10";
    }
  };

  const nodesWithOutputs = getNodesWithOutputs();
  const hasOutputs = nodesWithOutputs.length > 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Outputs list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 max-w-5xl mx-auto">
          {/* Empty state */}
          {!hasOutputs && workflow.stages.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Run your workflow to see outputs here
              </p>
            </div>
          )}

          {/* Stages as folders */}
          {workflow.stages.map((stage) => {
            const stageNodes = stage.nodes.filter((n) => n.output);
            const stageStatus = getStageStatus(stage);
            
            // Show stage even if no outputs yet
            return (
              <Card key={stage.id} className={cn("border-l-4 transition-all duration-300", getStatusColor(stageStatus))}>
                {/* Stage folder header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Folder className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold text-foreground">{stage.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stage.nodes.length} node{stage.nodes.length === 1 ? "" : "s"}
                        {stageNodes.length > 0 && ` • ${stageNodes.length} output${stageNodes.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(stageStatus)}
                    {stageNodes.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadStage(stage.name)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>

                {/* Files/Outputs with Accordion for streaming content */}
                {stageNodes.length > 0 && (
                  <div className="p-2">
                    <Accordion type="multiple" value={expandedNodes} onValueChange={setExpandedNodes}>
                      {stageNodes.map((node) => (
                        <AccordionItem key={node.id} value={node.id} className="border-none">
                          <AccordionTrigger className="rounded-md hover:bg-muted/50 transition-colors p-3 hover:no-underline group [&>svg]:ml-auto">
                            <div className="flex items-center justify-between w-full pr-2">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0 text-left">
                                  <p className="font-medium text-sm text-foreground truncate">{node.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {getCharCount(node.output!).toLocaleString()} characters
                                    {node.status === "running" && (
                                      <span className="ml-2 text-warning animate-pulse">• Streaming...</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (node.nodeType === "agent" && onRunAgent) {
                                      onRunAgent(node.id);
                                    } else if (node.nodeType === "function" && onRunFunction) {
                                      onRunFunction(node.id);
                                    }
                                  }}
                                  disabled={node.status === "running"}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingOutput({
                                      nodeName: node.name,
                                      output: formatOutput(node.output),
                                    });
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadArtifact(node.name, node.output);
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3 pt-0">
                            <div className="p-3 bg-muted/30 rounded-md border border-border">
                              <div 
                                ref={(el) => scrollRefs.current[node.id] = el}
                                className="overflow-y-auto max-h-[400px] pr-2"
                              >
                                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
                                  {formatOutput(node.output)}
                                </pre>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}

                {/* Empty stage indicator */}
                {stageNodes.length === 0 && stage.nodes.length > 0 && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      {stageStatus === "running" ? "Processing..." : "Waiting for outputs..."}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Download all button at bottom */}
          {hasOutputs && (
            <div className="flex justify-center pt-4">
              <Button onClick={downloadAll} size="lg" className="gap-2">
                <Download className="h-4 w-4" />
                Download All Outputs
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* View output dialog - reusing Properties panel style */}
      <Dialog open={!!viewingOutput} onOpenChange={() => setViewingOutput(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="pb-4">
            <DialogTitle>{viewingOutput?.nodeName}</DialogTitle>
            <DialogDescription>View the output content</DialogDescription>
          </DialogHeader>
          <Tabs value={outputTab} onValueChange={setOutputTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start mb-4">
              <TabsTrigger value="view">View</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
            
            <TabsContent value="view" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {viewingOutput?.output || ""}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="raw" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono p-4 bg-muted/30 rounded-lg">
                  {viewingOutput?.output}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};
