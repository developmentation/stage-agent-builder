import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface PropertiesPanelProps {
  selectedNode: string | null;
}

export const PropertiesPanel = ({ selectedNode }: PropertiesPanelProps) => {
  if (!selectedNode) {
    return (
      <aside className="w-80 border-l border-border bg-card flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            Select an agent to view and edit its properties
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Agent Properties</h3>
        <Button variant="ghost" size="sm">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* System Prompt */}
          <div className="space-y-2">
            <Label htmlFor="system-prompt" className="text-sm font-medium">
              System Prompt
            </Label>
            <Textarea
              id="system-prompt"
              placeholder="You are a helpful research assistant..."
              className="min-h-[100px] resize-none"
              defaultValue="You are a research assistant specializing in policy analysis. Your role is to gather, analyze, and synthesize information to support decision-making."
            />
            <p className="text-xs text-muted-foreground">
              Define the agent's role and behavior
            </p>
          </div>

          {/* User Prompt */}
          <div className="space-y-2">
            <Label htmlFor="user-prompt" className="text-sm font-medium">
              User Prompt Template
            </Label>
            <Textarea
              id="user-prompt"
              placeholder="Analyze the following: {input}"
              className="min-h-[80px] resize-none"
              defaultValue="Research the following topic and provide a comprehensive summary: {input}"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{input}'} for stage inputs, {'{file_content}'} for files
            </p>
          </div>

          {/* Attached Tools */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Attached Tools</Label>
            <Card className="p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id="tool-1" defaultChecked />
                  <label htmlFor="tool-1" className="text-sm text-foreground">
                    Google Search
                  </label>
                </div>
                <Button variant="ghost" size="sm">
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id="tool-2" defaultChecked />
                  <label htmlFor="tool-2" className="text-sm text-foreground">
                    Web Scrape
                  </label>
                </div>
                <Button variant="ghost" size="sm">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </Card>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add Tool
            </Button>
          </div>

          {/* File Attachments */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Attachments</Label>
            <Card className="p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground text-center py-2">
                No files attached
              </p>
            </Card>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-3.5 w-3.5 mr-2" />
              Attach File
            </Button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};
