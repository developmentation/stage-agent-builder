// Interject Modal - Allow user to add information during agent execution
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquarePlus, Send } from "lucide-react";

interface InterjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
}

export function InterjectModal({
  open,
  onClose,
  onSubmit,
}: InterjectModalProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit(message.trim());
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-primary" />
            Interject Information
          </DialogTitle>
          <DialogDescription>
            Add new information or guidance for the agent. This will be added to the blackboard and the current iteration will be re-executed with your input.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="interject-message">Your Message</Label>
            <Textarea
              id="interject-message"
              placeholder="Enter additional information, corrections, or guidance for the agent..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The agent will pause, receive your input as a user interjection on the blackboard, and then resume the current iteration with this new context.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!message.trim()}
          >
            <Send className="w-4 h-4 mr-2" />
            Submit & Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
