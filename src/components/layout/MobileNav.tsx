import { Button } from "@/components/ui/button";
import { Library, Workflow, Settings, Plus, Play, Save, Upload, Trash2, HelpCircle, LayoutGrid, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { HelpModal } from "@/components/help/HelpModal";

interface MobileNavProps {
  activeTab: "library" | "workflow" | "properties";
  onTabChange: (tab: "library" | "workflow" | "properties") => void;
  onAddStage: () => void;
  onRun: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onClear: () => void;
  hasSelectedAgent: boolean;
  viewMode?: "stacked" | "canvas";
  onToggleViewMode?: () => void;
}

export const MobileNav = ({ 
  activeTab, 
  onTabChange, 
  onAddStage, 
  onRun,
  onSave,
  onLoad,
  onClear,
  hasSelectedAgent,
  viewMode,
  onToggleViewMode
}: MobileNavProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
      e.target.value = "";
    }
  };

  return (
    <div className="lg:hidden">
      {/* Top Action Bar */}
      <div className="h-14 border-b border-border bg-card flex items-center gap-2 px-4">
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={onAddStage}
        >
          <Plus className="h-4 w-4" />
          Add Stage
        </Button>
        {onToggleViewMode && (
          <Button
            size="sm"
            variant={(viewMode || "stacked") === "canvas" ? "default" : "outline"}
            className="gap-2"
            onClick={onToggleViewMode}
          >
            {(viewMode || "stacked") === "canvas" ? (
              <LayoutGrid className="h-4 w-4" />
            ) : (
              <LayoutList className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={handleLoadClick}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={onSave}
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={onClear}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => setHelpOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          className="gap-2 bg-gradient-to-r from-primary to-primary-hover ml-auto"
          onClick={onRun}
        >
          <Play className="h-4 w-4" />
          Run
        </Button>
      </div>
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />

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
