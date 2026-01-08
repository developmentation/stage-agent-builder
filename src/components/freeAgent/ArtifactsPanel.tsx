// Artifacts Panel - Display created artifacts
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Image,
  Database,
  File,
  Download,
  Copy,
  Package,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import type { FreeAgentArtifact } from "@/types/freeAgent";

interface ArtifactsPanelProps {
  artifacts: FreeAgentArtifact[];
  onArtifactClick?: (artifact: FreeAgentArtifact) => void;
}

export function ArtifactsPanel({ artifacts, onArtifactClick }: ArtifactsPanelProps) {
  const getIcon = (type: FreeAgentArtifact["type"], mimeType?: string) => {
    // Check mimeType first for more accurate detection
    if (mimeType?.startsWith("audio/")) {
      return <Volume2 className="w-4 h-4" />;
    }
    switch (type) {
      case "image":
        return <Image className="w-4 h-4" />;
      case "audio":
        return <Volume2 className="w-4 h-4" />;
      case "data":
        return <Database className="w-4 h-4" />;
      case "file":
        return <File className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Extract image source from various formats
  const getImageSrc = (artifact: FreeAgentArtifact): string => {
    const content = artifact.content;
    
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
    return `data:${artifact.mimeType || 'image/png'};base64,${content}`;
  };

  const handleDownload = (artifact: FreeAgentArtifact) => {
    try {
      // Create blob from content
      let blob: Blob;
      let filename = artifact.title;
      
      // Helper to get extension from mimeType
      const getExtension = (mimeType: string): string => {
        const map: Record<string, string> = {
          'image/png': '.png',
          'image/jpeg': '.jpg',
          'image/gif': '.gif',
          'image/webp': '.webp',
          'audio/mpeg': '.mp3',
          'audio/mp3': '.mp3',
          'audio/wav': '.wav',
          'audio/ogg': '.ogg',
          'application/pdf': '.pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        };
        return map[mimeType] || '';
      };
      
      // Helper to detect if content is audio (check for audioContent in JSON or audio data URL)
      const isAudioContent = (content: string): boolean => {
        if (content.startsWith("data:audio/")) return true;
        try {
          const parsed = JSON.parse(content);
          return !!parsed.audioContent;
        } catch {
          return false;
        }
      };
      
      // Helper to detect if content is image
      const isImageContent = (content: string): boolean => {
        if (content.startsWith("data:image/")) return true;
        try {
          const parsed = JSON.parse(content);
          return !!parsed.imageUrl;
        } catch {
          return false;
        }
      };
      
      // Determine actual type - check content if type isn't explicit
      const isAudio = artifact.type === "audio" || artifact.mimeType?.startsWith("audio/") || isAudioContent(artifact.content);
      const isImage = artifact.type === "image" || artifact.mimeType?.startsWith("image/") || isImageContent(artifact.content);
      
      if (isImage) {
        // Handle image content
        const src = getImageSrc(artifact);
        if (src.startsWith("data:")) {
          const [header, base64Data] = src.split(",");
          const mimeMatch = header.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : artifact.mimeType || "image/png";
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: mimeType });
          // Add extension if not present
          if (!filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
            filename += getExtension(mimeType) || '.png';
          }
        } else {
          blob = new Blob([artifact.content], { type: "text/plain" });
        }
      } else if (isAudio) {
        // Handle audio content
        const mimeType = artifact.mimeType || "audio/mpeg";
        let base64Data = artifact.content;
        
        // Extract base64 if it's a data URL
        if (base64Data.startsWith("data:")) {
          base64Data = base64Data.split(",")[1];
        }
        
        // Try to parse JSON if content is wrapped
        try {
          const parsed = JSON.parse(artifact.content);
          if (parsed.audioContent) {
            base64Data = parsed.audioContent.startsWith("data:") 
              ? parsed.audioContent.split(",")[1] 
              : parsed.audioContent;
          }
        } catch {
          // Not JSON, use as-is
        }
        
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
        // Add extension if not present
        if (!filename.match(/\.(mp3|wav|ogg|m4a)$/i)) {
          filename += getExtension(mimeType) || '.mp3';
        }
      } else if (artifact.type === "file" && artifact.mimeType) {
        // Base64 encoded file
        const byteCharacters = atob(artifact.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: artifact.mimeType });
        // Add extension if not present
        const ext = getExtension(artifact.mimeType);
        if (ext && !filename.includes('.')) {
          filename += ext;
        }
      } else {
        // Text content
        blob = new Blob([artifact.content], { type: "text/plain" });
        if (!filename.includes('.')) {
          filename += '.txt';
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
      toast.error("Failed to download artifact");
    }
  };

  const handleCopy = async (artifact: FreeAgentArtifact) => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="w-4 h-4" />
          Artifacts
          <Badge variant="secondary" className="ml-auto">
            {artifacts.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {artifacts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No artifacts created yet
          </div>
        ) : (
          <ScrollArea className="h-full px-4 pb-4">
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onArtifactClick?.(artifact)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-primary">{getIcon(artifact.type, artifact.mimeType)}</div>
                    <span className="text-sm font-medium flex-1 truncate">
                      {artifact.title}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {artifact.type}
                    </Badge>
                  </div>

                  {artifact.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {artifact.description}
                    </p>
                  )}

                  {/* Preview for text - render as markdown, full content */}
                  {artifact.type === "text" && (
                    <div className="text-xs bg-muted/50 p-2 rounded overflow-y-auto prose prose-sm prose-invert dark:prose-invert max-w-none break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {typeof artifact.content === 'string' ? artifact.content : JSON.stringify(artifact.content, null, 2)}
                      </ReactMarkdown>
                    </div>
                  )}

                  {artifact.type === "image" && (
                    <img
                      src={getImageSrc(artifact)}
                      alt={artifact.title}
                      className="max-h-[80px] rounded object-cover"
                      onError={(e) => {
                        console.error('Image failed to load:', artifact.title, artifact.content?.substring(0, 100));
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}

                  {/* Audio preview with player */}
                  {(artifact.type === "audio" || artifact.mimeType?.startsWith("audio/")) && (
                    <audio
                      src={artifact.content.startsWith("data:") ? artifact.content : `data:${artifact.mimeType || "audio/mpeg"};base64,${artifact.content}`}
                      controls
                      className="w-full h-8"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}

                  {/* Actions */}
                  <div className="flex gap-1 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(artifact);
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    {artifact.type === "text" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(artifact);
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
