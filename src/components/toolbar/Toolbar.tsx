import { Button } from "@/components/ui/button";
import { Play, Plus, Save, Upload, Trash2, HelpCircle, LayoutGrid, LayoutList } from "lucide-react";
import { useRef, useState } from "react";
import { HelpModal } from "@/components/help/HelpModal";
interface ToolbarProps {
  onAddStage: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onClear: () => void;
  onRun: () => void;
  viewMode: "stacked" | "canvas";
  onToggleViewMode: () => void;
}
export const Toolbar = ({
  onAddStage,
  onSave,
  onLoad,
  onClear,
  onRun,
  viewMode,
  onToggleViewMode
}: ToolbarProps) => {
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
  return <header className="h-16 border-b border-border bg-card items-center justify-between px-6 shadow-sm hidden lg:flex">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="font-bold text-primary-foreground text-lg">ABC</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Agent Builder Console</h1>
            <p className="text-xs text-muted-foreground">From the Alberta AI Academy</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2" onClick={onAddStage}>
          <Plus className="h-4 w-4" />
          Add Stage
        </Button>
        <Button 
          onClick={onToggleViewMode} 
          variant={(viewMode || "stacked") === "canvas" ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          {(viewMode || "stacked") === "canvas" ? (
            <>
              <LayoutGrid className="h-4 w-4" />
              Canvas
            </>
          ) : (
            <>
              <LayoutList className="h-4 w-4" />
              Stacked
            </>
          )}
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button variant="outline" size="sm" className="gap-2" onClick={handleLoadClick}>
          <Upload className="h-4 w-4" />
          Load
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" size="sm" className="gap-2" onClick={onSave}>
          <Save className="h-4 w-4" />
          Save
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={onClear}>
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setHelpOpen(true)}>
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary-hover hover:opacity-90" onClick={onRun}>
          <Play className="h-4 w-4" />
          Run Workflow
        </Button>
      </div>
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </header>;
};