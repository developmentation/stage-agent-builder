import { memo, useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Trash2, Pencil } from "lucide-react";
import type { Note } from "@/types/workflow";

interface NoteNodeData {
  note: Note;
  onUpdate: (updates: Partial<Note>) => void;
  onDelete: () => void;
}

const NOTE_COLORS = [
  "#fef3c7", // yellow
  "#fecaca", // red
  "#bfdbfe", // blue
  "#bbf7d0", // green
  "#e9d5ff", // purple
  "#fed7aa", // orange
];

export const NoteNode = memo(({ data, selected }: NodeProps<NoteNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [localContent, setLocalContent] = useState(data.note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { note, onUpdate, onDelete } = data;

  // Sync local content when note content changes externally
  useEffect(() => {
    setLocalContent(note.content);
  }, [note.content]);

  // Calculate font size based on card dimensions and content
  const calculateFontSize = (content: string, width: number, height: number) => {
    if (!content || content.length === 0) {
      // Base size scales with card dimensions
      const baseSize = Math.min(width, height) / 10;
      return Math.max(12, Math.min(24, baseSize));
    }
    
    const availableWidth = width - 32; // padding
    const availableHeight = height - 32;
    
    // Count actual lines including word-wrapped lines
    const lines = content.split('\n');
    let totalLines = 0;
    
    lines.forEach(line => {
      if (line.length === 0) {
        totalLines += 1;
      } else {
        // Estimate wrapped lines based on available width
        // Average char width is ~0.6 of font size, so at 16px font, ~25 chars fit in 250px
        const estimatedCharsPerLine = Math.floor(availableWidth / 9.6); // Assume 16px font baseline
        totalLines += Math.max(1, Math.ceil(line.length / estimatedCharsPerLine));
      }
    });
    
    // Calculate font size based on height constraint
    const lineHeight = 1.3;
    const fontSizeByHeight = (availableHeight / Math.max(1, totalLines)) / lineHeight;
    
    // Scale with card width too, but prioritize fitting vertically
    const baseScale = width / 250; // 250px as baseline width
    const scaledSize = 16 * baseScale; // 16px as baseline font
    
    // Use the smaller of scaled size and height-constrained size
    const fontSize = Math.min(scaledSize, fontSizeByHeight);
    
    // Clamp between 8px and 28px
    return Math.max(8, Math.min(28, fontSize));
  };

  const fontSize = calculateFontSize(
    note.content,
    note.size.width,
    note.size.height
  );

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Handle keyboard shortcuts when selected but not editing
  useEffect(() => {
    if (selected && !isEditing) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onDelete();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [selected, isEditing, onDelete]);

  // Handle clicks outside to exit edit mode
  useEffect(() => {
    if (isEditing) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if click is outside the note container
        if (!target.closest('.note-container') && !target.closest('.nodrag')) {
          setIsEditing(false);
          setShowColorPicker(false);
          if (localContent !== note.content) {
            onUpdate({ content: localContent });
          }
        }
      };
      // Use capture phase to catch clicks before other handlers
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }
  }, [isEditing, localContent, note.content, onUpdate]);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Use local state for smooth typing
    setLocalContent(e.target.value);
  };

  const handleColorChange = (color: string) => {
    onUpdate({ color });
    setShowColorPicker(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  return (
    <div style={{ position: 'relative', width: note.size.width, height: note.size.height }}>
      <NodeResizer
        isVisible={!isEditing}
        minWidth={150}
        minHeight={100}
        maxWidth={600}
        maxHeight={600}
        handleStyle={{
          width: '12px',
          height: '12px',
        }}
        lineStyle={{
          borderWidth: '2px',
        }}
        keepAspectRatio={false}
        shouldResize={() => true}
        onResize={(e, params) => {
          onUpdate({
            size: { width: params.width, height: params.height },
          });
        }}
      />
      {/* Toolbar - positioned above the card */}
      {!isEditing && (
        <div 
          className="absolute flex gap-0.5 z-10 nodrag"
          style={{
            top: "-34px",
            right: "0px",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditClick}
            className="h-7 w-7 p-0 bg-background border border-border hover:bg-accent shadow-sm"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              className="h-7 w-7 p-0 bg-background border border-border hover:bg-accent shadow-sm"
            >
              <Palette className="h-3 w-3" />
            </Button>
            {showColorPicker && (
              <div className="absolute top-8 right-0 p-2 bg-background border rounded-md shadow-lg flex gap-1 nodrag z-50">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border-2 border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorChange(color);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 w-7 p-0 bg-background border border-border hover:bg-accent shadow-sm"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      <Card
        className="note-container relative shadow-lg border-2 transition-all duration-200"
        style={{
          backgroundColor: note.color,
          borderColor: selected ? "hsl(var(--primary))" : "transparent",
          width: note.size.width,
          height: note.size.height,
          overflow: "visible",
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Content area */}
        <div
          className="w-full h-full flex items-center justify-center p-4"
          style={{ overflow: "hidden", position: "relative" }}
        >
          {isEditing ? (
            <div className="w-full h-full flex items-center justify-center">
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={handleContentChange}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full h-full bg-transparent border-none outline-none resize-none text-center nodrag"
                style={{
                  fontSize: "16px",
                  lineHeight: "1.3",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowY: "auto",
                  overflowWrap: "break-word",
                }}
                placeholder="Type your note..."
              />
            </div>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-center"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: "1.3",
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {note.content || "Click pencil to edit..."}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
});

NoteNode.displayName = "NoteNode";
