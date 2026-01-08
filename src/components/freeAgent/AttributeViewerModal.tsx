import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Database, Code, FileText, Image, Volume2, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AttributeViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attributeName: string;
  attributeValue: string;
  attributeTool?: string;
  isBinary?: boolean;
  mimeType?: string;
}

export function AttributeViewerModal({
  open,
  onOpenChange,
  attributeName,
  attributeValue,
  attributeTool,
  isBinary,
  mimeType,
}: AttributeViewerModalProps) {
  const [activeTab, setActiveTab] = useState<"raw" | "markdown" | "preview">(isBinary ? "preview" : "raw");

  // Try to format JSON if it looks like JSON
  const formatRawContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  // Extract base64 data for binary content
  const getBinaryDataUrl = (): string | null => {
    if (!isBinary || !attributeValue) return null;
    
    // Check if it's already a data URL
    if (attributeValue.startsWith('data:')) {
      return attributeValue;
    }
    
    // Try to parse as JSON and extract the imageUrl or audioContent
    try {
      const parsed = JSON.parse(attributeValue);
      if (parsed.imageUrl) return parsed.imageUrl;
      if (parsed.audioContent) {
        return parsed.audioContent.startsWith('data:') 
          ? parsed.audioContent 
          : `data:${mimeType || 'audio/mpeg'};base64,${parsed.audioContent}`;
      }
    } catch {
      // Not JSON, assume it's raw base64
      if (mimeType) {
        return `data:${mimeType};base64,${attributeValue}`;
      }
    }
    return null;
  };

  const handleDownload = () => {
    const dataUrl = getBinaryDataUrl();
    if (!dataUrl) return;
    
    const link = document.createElement('a');
    link.href = dataUrl;
    const ext = mimeType?.split('/')[1] || 'bin';
    link.download = `${attributeName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImage = mimeType?.startsWith('image/');
  const isAudio = mimeType?.startsWith('audio/');
  const dataUrl = getBinaryDataUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0"
        style={{ 
          width: 'calc(100vw - 32px)', 
          height: 'calc(100vh - 32px)',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {isBinary ? (
              isImage ? <Image className="w-5 h-5 text-purple-500 shrink-0" /> : 
              isAudio ? <Volume2 className="w-5 h-5 text-purple-500 shrink-0" /> :
              <Database className="w-5 h-5 text-purple-500 shrink-0" />
            ) : (
              <Database className="w-5 h-5 text-cyan-500 shrink-0" />
            )}
            <DialogTitle className="font-mono text-base sm:text-lg break-all">
              {`{{${attributeName}}}`}
            </DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {attributeTool && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                from {attributeTool}
              </span>
            )}
            {isBinary && (
              <span className="text-xs bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                BINARY
              </span>
            )}
            {isBinary && dataUrl && (
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                <Download className="w-4 h-4" />
                Download
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "raw" | "markdown" | "preview")}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 py-2 border-b bg-background shrink-0">
            <TabsList className="h-8">
              {isBinary && (
                <TabsTrigger value="preview" className="text-xs gap-1.5">
                  {isImage ? <Image className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  Preview
                </TabsTrigger>
              )}
              <TabsTrigger value="raw" className="text-xs gap-1.5">
                <Code className="w-3.5 h-3.5" />
                Raw
              </TabsTrigger>
              {!isBinary && (
                <TabsTrigger value="markdown" className="text-xs gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Markdown
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 min-h-0">
            {isBinary && (
              <TabsContent value="preview" className="h-full m-0 p-0">
                <div className="h-full flex items-center justify-center p-6 bg-muted/20">
                  {isImage && dataUrl && (
                    <img 
                      src={dataUrl} 
                      alt={attributeName} 
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  )}
                  {isAudio && dataUrl && (
                    <div className="flex flex-col items-center gap-4">
                      <Volume2 className="w-16 h-16 text-purple-500" />
                      <audio 
                        src={dataUrl} 
                        controls 
                        className="w-full max-w-96"
                      />
                    </div>
                  )}
                  {!isImage && !isAudio && (
                    <div className="text-muted-foreground text-center">
                      <p>Binary content ({mimeType || 'unknown type'})</p>
                      <p className="text-sm">Use the Download button to save this file</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            <TabsContent value="raw" className="h-full m-0 p-0">
              <ScrollArea className="h-full">
                <pre className="p-6 text-sm font-mono whitespace-pre-wrap break-words text-foreground/90">
                  {isBinary ? `[Binary content - ${mimeType || 'unknown'} - ${Math.round(attributeValue.length / 1024)}KB]` : formatRawContent(attributeValue)}
                </pre>
              </ScrollArea>
            </TabsContent>

            {!isBinary && (
              <TabsContent value="markdown" className="h-full m-0 p-0">
                <ScrollArea className="h-full">
                  <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {attributeValue}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
