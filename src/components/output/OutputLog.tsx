import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Terminal, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const sampleLogs = [
  { time: "14:32:01", type: "info", message: "Workflow execution started" },
  { time: "14:32:02", type: "success", message: "Stage 1: Research Agent initialized" },
  { time: "14:32:03", type: "info", message: "Tool call: Google Search - 'Alberta AI policies'" },
  { time: "14:32:05", type: "success", message: "Google Search completed: 5 results found" },
  { time: "14:32:06", type: "running", message: "Agent processing with Gemini 2.5 Pro..." },
];

const logIcons = {
  info: Terminal,
  success: CheckCircle2,
  error: AlertCircle,
  running: Loader2,
};

const logColors = {
  info: "text-foreground",
  success: "text-success",
  error: "text-destructive",
  running: "text-warning",
};

export const OutputLog = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card className={cn(
      "border-t border-border rounded-none transition-all duration-300",
      isExpanded ? "h-64" : "h-12"
    )}>
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Output Log</h3>
          {!isExpanded && (
            <span className="text-xs text-muted-foreground">
              5 entries
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7"
        >
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            !isExpanded && "rotate-180"
          )} />
        </Button>
      </div>

      {isExpanded && (
        <ScrollArea className="h-[calc(100%-3rem)]">
          <div className="p-3 space-y-2 font-mono text-xs">
            {sampleLogs.map((log, index) => {
              const Icon = logIcons[log.type as keyof typeof logIcons];
              return (
                <div key={index} className="flex items-start gap-3 group">
                  <span className="text-muted-foreground flex-shrink-0">
                    {log.time}
                  </span>
                  <Icon className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 mt-0.5",
                    logColors[log.type as keyof typeof logColors],
                    log.type === "running" && "animate-spin"
                  )} />
                  <span className="text-foreground flex-1">{log.message}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};
