import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { Workflow, WorkflowNode } from "@/types/workflow";
import JSZip from "jszip";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SimpleViewProps {
  workflow: Workflow;
}

export const SimpleView = ({ workflow }: SimpleViewProps) => {
  const [viewingOutput, setViewingOutput] = useState<{ nodeName: string; output: string } | null>(null);

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

  const nodesWithOutputs = getNodesWithOutputs();
  const hasOutputs = nodesWithOutputs.length > 0;

  return (
    <>
      <div className="h-full flex flex-col bg-background">
        {/* Header with actions */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Workflow Outputs</h2>
            <p className="text-sm text-muted-foreground">
              {hasOutputs
                ? `${nodesWithOutputs.length} output${nodesWithOutputs.length === 1 ? "" : "s"} generated`
                : "Run your workflow to see outputs"}
            </p>
          </div>
          {hasOutputs && (
            <Button onClick={downloadAll} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download All
            </Button>
          )}
        </div>

        {/* Outputs list */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {!hasOutputs && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No outputs yet. Run your workflow to see results here.
                </p>
              </div>
            )}

            {workflow.stages.map((stage) => {
              const stageNodes = stage.nodes.filter((n) => n.output);
              if (stageNodes.length === 0) return null;

              return (
                <div key={stage.id} className="space-y-3">
                  {/* Stage header */}
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-base font-semibold text-foreground">{stage.name}</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadStage(stage.name)}
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      Download Stage
                    </Button>
                  </div>

                  {/* Stage outputs */}
                  <div className="space-y-3">
                    {stageNodes.map((node) => (
                      <Card key={node.id} className="p-4 space-y-3">
                        {/* Node header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-foreground">{node.name}</h4>
                              {node.status === "running" && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {getCharCount(node.output!)} characters
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setViewingOutput({
                                  nodeName: node.name,
                                  output: formatOutput(node.output),
                                })
                              }
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadArtifact(node.name, node.output)}
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>

                        {/* Output preview */}
                        <div className="bg-muted/50 rounded-md p-3">
                          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
                            {getPreview(node.output!)}
                          </pre>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* View output dialog */}
      <Dialog open={!!viewingOutput} onOpenChange={() => setViewingOutput(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewingOutput?.nodeName}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-mono p-4">
              {viewingOutput?.output}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
