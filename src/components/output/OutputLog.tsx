import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Terminal, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface LogEntry {
  time: string;
  type: "info" | "success" | "error" | "running" | "warning";
  message: string;
}

interface OutputLogProps {
  logs: LogEntry[];
}

const logIcons = {
  info: Terminal,
  success: CheckCircle2,
  error: AlertCircle,
  running: Loader2,
  warning: AlertCircle,
};

const logColors = {
  info: "text-foreground",
  success: "text-success",
  error: "text-destructive",
  running: "text-warning",
  warning: "text-warning",
};

export const OutputLog = ({ logs }: OutputLogProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={cn(
      "border-t border-border rounded-none transition-all duration-300 flex-shrink-0",
      isExpanded ? "h-64" : "h-12"
    )}>
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Output Log</h3>
          {!isExpanded && logs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
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
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">
                No logs yet. Run the workflow to see execution logs.
              </div>
            ) : (
              logs.map((log, index) => {
                const Icon = logIcons[log.type];
                return (
                  <div key={index} className="flex items-start gap-3 group">
                    <span className="text-muted-foreground flex-shrink-0">
                      {log.time}
                    </span>
                    <Icon className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 mt-0.5",
                      logColors[log.type],
                      log.type === "running" && "animate-spin"
                    )} />
                    <span className="text-foreground flex-1">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};
