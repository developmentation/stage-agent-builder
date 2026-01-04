// Enhance Prompt Settings Modal - Edit the enhancement system prompt template
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Settings, RotateCcw, Save } from "lucide-react";
import { 
  DEFAULT_ENHANCEMENT_PROMPT, 
  getStoredEnhancementPrompt, 
  setStoredEnhancementPrompt 
} from "./EnhancePromptModal";
import { toast } from "sonner";

interface EnhancePromptSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnhancePromptSettingsModal({
  open,
  onOpenChange,
}: EnhancePromptSettingsModalProps) {
  const [promptTemplate, setPromptTemplate] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Load stored template when modal opens
  useEffect(() => {
    if (open) {
      setPromptTemplate(getStoredEnhancementPrompt());
      setHasChanges(false);
    }
  }, [open]);

  const handleChange = (value: string) => {
    setPromptTemplate(value);
    setHasChanges(value !== getStoredEnhancementPrompt());
  };

  const handleSave = () => {
    setStoredEnhancementPrompt(promptTemplate);
    setHasChanges(false);
    toast.success("Enhancement prompt template saved");
  };

  const handleReset = () => {
    setPromptTemplate(DEFAULT_ENHANCEMENT_PROMPT);
    setHasChanges(DEFAULT_ENHANCEMENT_PROMPT !== getStoredEnhancementPrompt());
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const isModified = promptTemplate !== DEFAULT_ENHANCEMENT_PROMPT;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[calc(100%-50px)] h-[calc(100%-50px)] max-w-[calc(100%-50px)] max-h-[calc(100%-50px)] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Settings className="w-4 h-4 text-amber-500 shrink-0" />
              <DialogTitle className="text-base truncate">Enhancement Prompt Settings</DialogTitle>
            </div>
            {isModified && (
              <span className="text-xs text-amber-500 shrink-0">Modified</span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 gap-3">
          <div className="shrink-0">
            <Label className="text-sm text-muted-foreground">
              Customize the system prompt used when enhancing your task descriptions.
              The tools list and files will be appended automatically.
            </Label>
          </div>

          <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
            <Textarea
              value={promptTemplate}
              onChange={(e) => handleChange(e.target.value)}
              className="h-full w-full border-0 rounded-none resize-none font-mono text-sm"
              placeholder="Enter your custom enhancement prompt template..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Default
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges}
                className="gap-1"
              >
                <Save className="w-3 h-3" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
