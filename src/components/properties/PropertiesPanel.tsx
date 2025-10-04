import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Settings } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import type { Agent, Workflow } from "@/pages/Index";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PropertiesPanelProps {
  selectedAgent: Agent | undefined;
  workflow: Workflow;
  onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
  onUpdateToolConfig: (toolId: string, config: any) => void;
  onDeselectAgent: () => void;
}

const availableTools = [
  { id: "google_search", name: "Google Search", requiresApiKey: true },
  { id: "weather", name: "Weather", requiresApiKey: true },
  { id: "time", name: "Time", requiresApiKey: false },
  { id: "api_call", name: "API Call", requiresApiKey: true },
  { id: "web_scrape", name: "Web Scrape", requiresApiKey: false },
];

export const PropertiesPanel = ({
  selectedAgent,
  workflow,
  onUpdateAgent,
  onUpdateToolConfig,
  onDeselectAgent,
}: PropertiesPanelProps) => {
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [configDialogTool, setConfigDialogTool] = useState<string | null>(null);

  if (!selectedAgent) {
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

  const handleToolToggle = (toolId: string, checked: boolean) => {
    const newTools = checked
      ? [...selectedAgent.tools, toolId]
      : selectedAgent.tools.filter((t) => t !== toolId);
    onUpdateAgent(selectedAgent.id, { tools: newTools });
  };

  const handleRemoveTool = (toolId: string) => {
    onUpdateAgent(selectedAgent.id, {
      tools: selectedAgent.tools.filter((t) => t !== toolId),
    });
  };

  return (
    <aside className="w-80 border-l border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Agent Properties</h3>
        <Button variant="ghost" size="sm" onClick={onDeselectAgent}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="system-prompt" className="text-sm font-medium">
              System Prompt
            </Label>
            <Textarea
              id="system-prompt"
              placeholder="You are a helpful assistant..."
              className="min-h-[100px] resize-none"
              value={selectedAgent.systemPrompt}
              onChange={(e) =>
                onUpdateAgent(selectedAgent.id, { systemPrompt: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Define the agent's role and behavior
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-prompt" className="text-sm font-medium">
              User Prompt Template
            </Label>
            <Textarea
              id="user-prompt"
              placeholder="Analyze the following: {input}"
              className="min-h-[80px] resize-none"
              value={selectedAgent.userPrompt}
              onChange={(e) =>
                onUpdateAgent(selectedAgent.id, { userPrompt: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Use {"{input}"} for stage inputs
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Attached Tools</Label>
            <Card className="p-3 bg-muted/30 space-y-2">
              {selectedAgent.tools.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No tools attached
                </p>
              ) : (
                selectedAgent.tools.map((toolId) => {
                  const tool = availableTools.find((t) => t.id === toolId);
                  return (
                    <div key={toolId} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{tool?.name}</span>
                      <div className="flex gap-1">
                        {tool?.requiresApiKey && (
                          <Dialog
                            open={configDialogTool === toolId}
                            onOpenChange={(open) =>
                              setConfigDialogTool(open ? toolId : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Settings className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{tool.name} Configuration</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="api-key">API Key</Label>
                                  <Input
                                    id="api-key"
                                    type="password"
                                    placeholder="Enter API key"
                                    value={workflow.toolConfigs[toolId]?.apiKey || ""}
                                    onChange={(e) =>
                                      onUpdateToolConfig(toolId, {
                                        ...workflow.toolConfigs[toolId],
                                        apiKey: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <Button
                                  onClick={() => setConfigDialogTool(null)}
                                  className="w-full"
                                >
                                  Save
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleRemoveTool(toolId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>

            <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Add Tool
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Tool</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {availableTools.map((tool) => (
                    <div key={tool.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={tool.id}
                        checked={selectedAgent.tools.includes(tool.id)}
                        onCheckedChange={(checked) =>
                          handleToolToggle(tool.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={tool.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {tool.name}
                        {tool.requiresApiKey && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (requires API key)
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};
