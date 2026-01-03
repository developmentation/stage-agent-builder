// Blackboard Viewer - Display agent's memory
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Lightbulb,
  HelpCircle,
  CheckSquare,
  ListTodo,
  Package,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import type { BlackboardEntry } from "@/types/freeAgent";

interface BlackboardViewerProps {
  entries: BlackboardEntry[];
}

const categoryConfig: Record<
  BlackboardEntry["category"],
  { icon: React.ReactNode; color: string; label: string }
> = {
  observation: {
    icon: <Eye className="w-3 h-3" />,
    color: "bg-blue-500/20 text-blue-500 border-blue-500/30",
    label: "Observation",
  },
  insight: {
    icon: <Lightbulb className="w-3 h-3" />,
    color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
    label: "Insight",
  },
  question: {
    icon: <HelpCircle className="w-3 h-3" />,
    color: "bg-purple-500/20 text-purple-500 border-purple-500/30",
    label: "Question",
  },
  decision: {
    icon: <CheckSquare className="w-3 h-3" />,
    color: "bg-green-500/20 text-green-500 border-green-500/30",
    label: "Decision",
  },
  plan: {
    icon: <ListTodo className="w-3 h-3" />,
    color: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
    label: "Plan",
  },
  artifact: {
    icon: <Package className="w-3 h-3" />,
    color: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
    label: "Artifact",
  },
  error: {
    icon: <AlertTriangle className="w-3 h-3" />,
    color: "bg-red-500/20 text-red-500 border-red-500/30",
    label: "Error",
  },
};

export function BlackboardViewer({ entries }: BlackboardViewerProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="w-4 h-4" />
          Blackboard
          <Badge variant="secondary" className="ml-auto">
            {entries.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No blackboard entries yet
          </div>
        ) : (
          <ScrollArea className="h-full px-4 pb-4">
            <div className="space-y-2">
              {entries.map((entry) => {
                const config = categoryConfig[entry.category];
                return (
                  <div
                    key={entry.id}
                    className={`p-2 rounded-md border ${config.color}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {config.icon}
                      <span className="text-xs font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        #{entry.iteration}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">{entry.content}</p>
                    {entry.data && (
                      <pre className="text-[10px] mt-1 p-1 bg-background/50 rounded overflow-x-auto">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
