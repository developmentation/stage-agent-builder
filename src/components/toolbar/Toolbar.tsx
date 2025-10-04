import { Button } from "@/components/ui/button";
import { Play, Plus, Save, Upload, Undo2, Redo2, Trash2 } from "lucide-react";

export const Toolbar = () => {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-xl font-bold text-primary-foreground">A</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Agent AI Academy</h1>
            <p className="text-xs text-muted-foreground">Workflow Builder</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2">
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="ghost" size="sm" className="gap-2">
          <Redo2 className="h-4 w-4" />
          Redo
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button variant="ghost" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Stage
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Load
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          Save
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary-hover hover:opacity-90">
          <Play className="h-4 w-4" />
          Run Workflow
        </Button>
      </div>
    </header>
  );
};
