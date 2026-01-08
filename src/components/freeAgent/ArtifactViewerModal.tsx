// Artifact Viewer Modal - Full-screen viewer for artifacts (images, audio, text, files)
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Download, Copy, FileText, Image, Volume2, Database, File } from "lucide-react";
import { toast } from "sonner";
import type { FreeAgentArtifact } from "@/types/freeAgent";

interface ArtifactViewerModalProps {
  artifact: FreeAgentArtifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtifactViewerModal({
  artifact,
  open,
  onOpenChange,
}: ArtifactViewerModalProps) {
  if (!artifact) return null;

  const getIcon = () => {
    switch (artifact.type) {
      case "image":
        return <Image className="w-5 h-5" />;
      case "audio":
        return <Volume2 className="w-5 h-5" />;
      case "data":
        return <Database className="w-5 h-5" />;
      case "file":
        return <File className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const handleDownload = () => {
    try {
      let blob: Blob;
      let filename = artifact.title;

      // Handle data URLs (images, audio)
      if (artifact.content.startsWith("data:")) {
        const [header, base64Data] = artifact.content.split(",");
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : artifact.mimeType || "application/octet-stream";
        
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
        
        // Add extension if missing
        if (!filename.includes(".")) {
          const ext = mimeType.split("/")[1] || "bin";
          filename = `${filename}.${ext}`;
        }
      } else if (artifact.type === "file" && artifact.mimeType) {
        // Base64 encoded file without data: prefix
        const byteCharacters = atob(artifact.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: artifact.mimeType });
      } else {
        // Text content
        blob = new Blob([artifact.content], { type: "text/plain" });
        if (!filename.includes(".")) {
          filename = `${filename}.txt`;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download artifact");
    }
  };

  const handleCopy = async () => {
    try {
      // For text artifacts, copy the content directly
      if (artifact.type === "text" || artifact.type === "data") {
        await navigator.clipboard.writeText(artifact.content);
        toast.success("Copied to clipboard");
      } else {
        toast.error("Cannot copy binary content");
      }
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Extract image source from various formats
  const getImageSrc = (content: string, mimeType?: string): string => {
    // Already a data URL
    if (content.startsWith("data:")) {
      return content;
    }
    
    // Try to parse as JSON (might be wrapped result)
    try {
      const parsed = JSON.parse(content);
      if (parsed.imageUrl) {
        return parsed.imageUrl;
      }
      if (parsed.url) {
        return parsed.url;
      }
    } catch {
      // Not JSON, treat as base64
    }
    
    // Raw base64
    return `data:${mimeType || 'image/png'};base64,${content}`;
  };

  const renderContent = () => {
    // Image artifact
    if (artifact.type === "image") {
      const src = getImageSrc(artifact.content, artifact.mimeType);
      return (
        <div className="flex items-center justify-center p-4">
          <img
            src={src}
            alt={artifact.title}
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
            onError={(e) => {
              console.error('Modal image failed to load:', artifact.title, artifact.content?.substring(0, 100));
            }}
          />
        </div>
      );
    }

    // Audio artifact
    if (artifact.type === "audio" || artifact.mimeType?.startsWith("audio/")) {
      const src = artifact.content.startsWith("data:") 
        ? artifact.content 
        : `data:${artifact.mimeType || "audio/mpeg"};base64,${artifact.content}`;
      return (
        <div className="flex flex-col items-center justify-center p-8 gap-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Volume2 className="w-12 h-12 text-primary" />
          </div>
          <audio
            src={src}
            controls
            autoPlay={false}
            className="w-full max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            {artifact.description || "Audio file"}
          </p>
        </div>
      );
    }

    // Text/Data artifact - render as markdown
    if (artifact.type === "text" || artifact.type === "data") {
      return (
        <ScrollArea className="h-full flex-1">
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {typeof artifact.content === "string" 
                ? artifact.content 
                : JSON.stringify(artifact.content, null, 2)}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      );
    }

    // File artifact - show download prompt
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-6">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
          <File className="w-12 h-12 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium">{artifact.title}</p>
        <p className="text-sm text-muted-foreground">
          {artifact.description || `${artifact.mimeType || "Binary file"}`}
        </p>
        {artifact.size && (
          <p className="text-xs text-muted-foreground">
            Size: {(artifact.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="flex flex-col p-4"
        style={{ 
          width: 'calc(100vw - 32px)', 
          height: 'calc(100vh - 32px)',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex items-center gap-2 text-primary">
              {getIcon()}
              <DialogTitle className="text-base sm:text-lg break-words">
                {artifact.title}
              </DialogTitle>
            </div>
            <Badge variant="secondary" className="shrink-0">{artifact.type}</Badge>
          </div>
          {artifact.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {artifact.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {(artifact.type === "text" || artifact.type === "data") && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden border rounded-lg bg-muted/20">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
