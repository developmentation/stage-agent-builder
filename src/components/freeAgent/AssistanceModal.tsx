// Assistance Modal - Handle user input requests
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HelpCircle, Upload, Send } from "lucide-react";
import type { AssistanceRequest } from "@/types/freeAgent";

interface AssistanceModalProps {
  request: AssistanceRequest | null;
  open: boolean;
  onClose: () => void;
  onRespond: (response: { response?: string; fileId?: string; selectedChoice?: string }) => void;
}

export function AssistanceModal({
  request,
  open,
  onClose,
  onRespond,
}: AssistanceModalProps) {
  const [textResponse, setTextResponse] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (request?.inputType === "text") {
      onRespond({ response: textResponse });
    } else if (request?.inputType === "choice") {
      onRespond({ selectedChoice });
    } else if (request?.inputType === "file" && file) {
      // Read file and create ID
      const reader = new FileReader();
      reader.onload = () => {
        const content = (reader.result as string).split(",")[1] || reader.result;
        const fileId = crypto.randomUUID();
        onRespond({ fileId, response: file.name });
      };
      reader.readAsDataURL(file);
    }

    // Reset state
    setTextResponse("");
    setSelectedChoice("");
    setFile(null);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Agent Needs Your Input
          </DialogTitle>
          <DialogDescription>{request.question}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {request.context && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              {request.context}
            </div>
          )}

          {(request.inputType === "text" || (!request.inputType) || (request.inputType !== "choice" && request.inputType !== "file")) && (
            <div className="space-y-2">
              <Label htmlFor="response">Your Response</Label>
              <Textarea
                id="response"
                placeholder="Type your response..."
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          )}

          {request.inputType === "choice" && request.choices && (
            <div className="space-y-2">
              <Label>Select an option</Label>
              <RadioGroup value={selectedChoice} onValueChange={setSelectedChoice}>
                {request.choices.map((choice, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={choice} id={`choice-${index}`} />
                    <Label htmlFor={`choice-${index}`} className="font-normal">
                      {choice}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {request.inputType === "file" && (
            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload a File</Label>
              <div className="flex gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {file && (
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                    ×
                  </Button>
                )}
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              (request.inputType === "text" && !textResponse.trim()) ||
              (request.inputType === "choice" && !selectedChoice) ||
              (request.inputType === "file" && !file)
            }
          >
            <Send className="w-4 h-4 mr-2" />
            Send Response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
