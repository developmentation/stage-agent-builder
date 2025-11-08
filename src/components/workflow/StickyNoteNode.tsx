import { memo, useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { StickyNote } from "@/types/workflow";

interface StickyNoteNodeData {
  note: StickyNote;
  onUpdate: (id: string, updates: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
}

const colorMap = {
  yellow: "bg-yellow-200 dark:bg-yellow-300/90",
  blue: "bg-blue-200 dark:bg-blue-300/90",
  green: "bg-green-200 dark:bg-green-300/90",
  pink: "bg-pink-200 dark:bg-pink-300/90",
  orange: "bg-orange-200 dark:bg-orange-300/90",
};

export const StickyNoteNode = memo(({ data, selected }: NodeProps<StickyNoteNodeData>) => {
  const { note, onUpdate, onDelete } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic font size to fit all content without scrolling
  const calculateFontSize = () => {
    if (!containerRef.current) return 16;
    
    const availableWidth = note.size.width - 32; // accounting for padding
    const availableHeight = note.size.height - 32;
    const contentLength = content.length;
    
    if (contentLength === 0) return 16;
    
    // Estimate characters per line based on width
    const avgCharWidth = 0.6; // rough estimate
    const charsPerLine = Math.floor(availableWidth / avgCharWidth);
    const estimatedLines = Math.ceil(contentLength / charsPerLine);
    
    // Calculate font size that fits height
    let fontSize = Math.floor(availableHeight / (estimatedLines * 1.3)); // 1.3 is line height
    
    // Clamp between 8px and 24px
    fontSize = Math.max(8, Math.min(24, fontSize));
    
    return fontSize;
  };

  const fontSize = calculateFontSize();

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (content !== note.content) {
      onUpdate(note.id, { content });
    }
  };

  const handleColorChange = () => {
    const colors: Array<keyof typeof colorMap> = ["yellow", "blue", "green", "pink", "orange"];
    const currentIndex = colors.indexOf(note.color as keyof typeof colorMap);
    const nextColor = colors[(currentIndex + 1) % colors.length];
    onUpdate(note.id, { color: nextColor });
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={150}
        onResize={(_, params) => {
          onUpdate(note.id, {
            size: { width: params.width, height: params.height },
          });
        }}
      />
      <div
        ref={containerRef}
        className={`
          ${colorMap[note.color as keyof typeof colorMap] || colorMap.yellow}
          ${selected ? "ring-2 ring-primary" : ""}
          rounded-sm shadow-lg p-4 cursor-pointer transition-all
          relative group
        `}
        style={{
          width: note.size.width,
          height: note.size.height,
        }}
        onClick={() => !isEditing && setIsEditing(true)}
        onDoubleClick={handleColorChange}
      >
        {/* Toolbar */}
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Content */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-foreground font-handwriting overflow-hidden"
            style={{ fontSize: `${fontSize}px`, lineHeight: "1.3" }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="w-full h-full overflow-hidden text-foreground font-handwriting whitespace-pre-wrap break-words"
            style={{ fontSize: `${fontSize}px`, lineHeight: "1.3" }}
          >
            {content || "Double-click to change color"}
          </div>
        )}
      </div>
    </>
  );
});

StickyNoteNode.displayName = "StickyNoteNode";
