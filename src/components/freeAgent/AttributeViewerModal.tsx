import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Code, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AttributeViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attributeName: string;
  attributeValue: string;
  attributeTool?: string;
}

export function AttributeViewerModal({
  open,
  onOpenChange,
  attributeName,
  attributeValue,
  attributeTool,
}: AttributeViewerModalProps) {
  const [activeTab, setActiveTab] = useState<"raw" | "markdown">("raw");

  // Try to format JSON if it looks like JSON
  const formatRawContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-100px)] max-w-none h-[calc(100vh-100px)] flex flex-col p-0 gap-0"
        style={{ maxHeight: "calc(100vh - 100px)" }}
      >
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-cyan-500" />
            <DialogTitle className="font-mono text-lg">
              {`{{${attributeName}}}`}
            </DialogTitle>
            {attributeTool && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                from {attributeTool}
              </span>
            )}
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "raw" | "markdown")}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 py-2 border-b bg-background shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="raw" className="text-xs gap-1.5">
                <Code className="w-3.5 h-3.5" />
                Raw
              </TabsTrigger>
              <TabsTrigger value="markdown" className="text-xs gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Markdown
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0">
            <TabsContent value="raw" className="h-full m-0 p-0">
              <ScrollArea className="h-full">
                <pre className="p-6 text-sm font-mono whitespace-pre-wrap break-words text-foreground/90">
                  {formatRawContent(attributeValue)}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="markdown" className="h-full m-0 p-0">
              <ScrollArea className="h-full">
                <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {attributeValue}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
