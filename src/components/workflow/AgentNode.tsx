import { Card } from "@/components/ui/card";
import { Bot, Search, FileText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentNodeProps {
  id: string;
  name: string;
  type: "researcher" | "summarizer" | "analyst";
  status: "idle" | "running" | "complete" | "error";
  isSelected: boolean;
  onSelect: () => void;
}

const iconMap = {
  researcher: Search,
  summarizer: FileText,
  analyst: Bot,
};

const statusConfig = {
  idle: {
    bg: "bg-node-idle",
    border: "border-border",
    glow: "",
  },
  running: {
    bg: "bg-node-running",
    border: "border-warning",
    glow: "shadow-lg shadow-warning/20",
  },
  complete: {
    bg: "bg-node-complete",
    border: "border-success",
    glow: "shadow-md shadow-success/20",
  },
  error: {
    bg: "bg-node-error",
    border: "border-destructive",
    glow: "shadow-md shadow-destructive/20",
  },
};

export const AgentNode = ({ id, name, type, status, isSelected, onSelect }: AgentNodeProps) => {
  const Icon = iconMap[type];
  const config = statusConfig[status];

  return (
    <Card
      onClick={onSelect}
      className={cn(
        "p-3 cursor-pointer transition-all duration-200",
        config.bg,
        config.border,
        config.glow,
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        "hover:shadow-md"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Input Port */}
        <div className="w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm -ml-5" />

        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          status === "running" ? "bg-warning/20 animate-pulse" : "bg-primary/10"
        )}>
          <Icon className={cn(
            "h-5 w-5",
            status === "running" ? "text-warning" : "text-primary"
          )} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">{name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
            {status === "running" && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-warning animate-pulse" />
                <span className="text-xs text-warning font-medium">Processing</span>
              </div>
            )}
          </div>
        </div>

        {/* Output Port */}
        <div className="w-3 h-3 rounded-full bg-secondary border-2 border-background shadow-sm -mr-5" />
      </div>

      {/* Tools Indicator */}
      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/40">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">
          Google Search
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">
          Web Scrape
        </span>
      </div>
    </Card>
  );
};
