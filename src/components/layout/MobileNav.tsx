import { Button } from "@/components/ui/button";
import { Library, Workflow, Settings, Plus, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeTab: "library" | "workflow" | "properties";
  onTabChange: (tab: "library" | "workflow" | "properties") => void;
  onAddStage: () => void;
  onRun: () => void;
  hasSelectedAgent: boolean;
}

export const MobileNav = ({ 
  activeTab, 
  onTabChange, 
  onAddStage, 
  onRun,
  hasSelectedAgent 
}: MobileNavProps) => {
  return (
    <div className="lg:hidden">
      {/* Top Action Bar */}
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={onAddStage}
        >
          <Plus className="h-4 w-4" />
          Add Stage
        </Button>
        <Button
          size="sm"
          className="gap-2"
          onClick={onRun}
        >
          <Play className="h-4 w-4" />
          Run
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="h-14 border-b border-border bg-card flex items-center">
        <button
          onClick={() => onTabChange("library")}
          className={cn(
            "flex-1 h-full flex flex-col items-center justify-center gap-1 transition-colors",
            activeTab === "library"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground"
          )}
        >
          <Library className="h-5 w-5" />
          <span className="text-xs font-medium">Library</span>
        </button>
        <button
          onClick={() => onTabChange("workflow")}
          className={cn(
            "flex-1 h-full flex flex-col items-center justify-center gap-1 transition-colors",
            activeTab === "workflow"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground"
          )}
        >
          <Workflow className="h-5 w-5" />
          <span className="text-xs font-medium">Workflow</span>
        </button>
        <button
          onClick={() => onTabChange("properties")}
          className={cn(
            "flex-1 h-full flex flex-col items-center justify-center gap-1 transition-colors relative",
            activeTab === "properties"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground",
            !hasSelectedAgent && "opacity-50"
          )}
          disabled={!hasSelectedAgent}
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs font-medium">Properties</span>
          {hasSelectedAgent && (
            <div className="absolute top-2 right-1/4 w-2 h-2 bg-primary rounded-full" />
          )}
        </button>
      </div>
    </div>
  );
};
