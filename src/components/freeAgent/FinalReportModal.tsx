// Final Report Modal - Display completion summary
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Clock,
  Wrench,
  Package,
  Lightbulb,
  FileText,
} from "lucide-react";
import type { FinalReport } from "@/types/freeAgent";

interface FinalReportModalProps {
  report: FinalReport | null;
  open: boolean;
  onClose: () => void;
  onReset: () => void;
}

export function FinalReportModal({
  report,
  open,
  onClose,
  onReset,
}: FinalReportModalProps) {
  if (!report) return null;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Task Completed
          </DialogTitle>
          <DialogDescription>
            Free Agent has finished executing your task.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Summary
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {report.summary}
              </p>
            </div>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-md">
                <div className="text-2xl font-bold">{report.totalIterations}</div>
                <div className="text-xs text-muted-foreground">Iterations</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-md">
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(report.totalTime)}
                </div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            </div>

            <Separator />

            {/* Tools used */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Tools Used ({report.toolsUsed.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {report.toolsUsed.length > 0 ? (
                  report.toolsUsed.map((tool, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tool}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No tools used</span>
                )}
              </div>
            </div>

            <Separator />

            {/* Artifacts created */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4" />
                Artifacts Created ({report.artifactsCreated.length})
              </h4>
              {report.artifactsCreated.length > 0 ? (
                <div className="space-y-1">
                  {report.artifactsCreated.map((artifact, index) => (
                    <div
                      key={index}
                      className="text-sm p-2 bg-green-500/10 border border-green-500/30 rounded"
                    >
                      <div className="font-medium">{artifact.title}</div>
                      {artifact.description && (
                        <div className="text-xs text-muted-foreground">
                          {artifact.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No artifacts created
                </span>
              )}
            </div>

            {/* Key findings */}
            {report.keyFindings.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Key Findings
                  </h4>
                  <ul className="space-y-1">
                    {report.keyFindings.map((finding, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-primary mt-0.5">•</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recommendations</h4>
                  <ul className="space-y-1">
                    {report.recommendations.map((rec, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-yellow-500 mt-0.5">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onReset}>Start New Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
