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
  const [isResizing, setIsResizing] = useState(false);
  const [localSize, setLocalSize] = useState(data.note.size);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { note, onUpdate, onDelete } = data;

  // Sync local content when note content changes externally
  useEffect(() => {
    setLocalContent(note.content);
  }, [note.content]);

  // Sync local size when note size changes externally (but not during resize)
  useEffect(() => {
    if (!isResizing) {
      setLocalSize(note.size);
    }
  }, [note.size, isResizing]);

  // Calculate font size to fit all content within the card
  const calculateFontSize = (content: string, width: number, height: number) => {
    if (!content || content.length === 0) return 32;
    
    const availableWidth = width - 40; // padding
    const availableHeight = height - 40;
    const totalArea = availableWidth * availableHeight;
    
    // Use a binary search approach to find the optimal font size
    let minSize = 12;
    let maxSize = 72;
    let optimalSize = minSize;
    
    for (let i = 0; i < 10; i++) { // 10 iterations is enough for convergence
      const testSize = (minSize + maxSize) / 2;
      const charWidth = testSize * 0.6; // approximate character width
      const lineHeight = testSize * 1.4;
      
      // Calculate how many characters fit per line
      const charsPerLine = Math.floor(availableWidth / charWidth);
      
      // Estimate total lines needed (accounting for manual line breaks)
      const contentLines = content.split('\n');
      let totalLines = 0;
      contentLines.forEach(line => {
        const wrappedLines = Math.ceil(Math.max(1, line.length) / charsPerLine) || 1;
        totalLines += wrappedLines;
      });
      
      const requiredHeight = totalLines * lineHeight;
      
      if (requiredHeight <= availableHeight) {
        optimalSize = testSize;
        minSize = testSize; // Try larger
      } else {
        maxSize = testSize; // Try smaller
      }
    }
    
    // Clamp between 12px and 72px
    return Math.max(12, Math.min(72, optimalSize));
  };

  // Use local size during resize for immediate visual feedback
  const currentSize = isResizing ? localSize : note.size;
  
  const fontSize = calculateFontSize(
    note.content,
    currentSize.width,
    currentSize.height
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
    <>
      <NodeResizer
        isVisible={!isEditing}
        minWidth={150}
        minHeight={100}
        maxWidth={600}
        maxHeight={600}
        handleStyle={{
          width: '12px',
          height: '12px',
          borderRadius: '2px',
        }}
        onResizeStart={() => {
          setIsResizing(true);
        }}
        onResize={(e, params) => {
          // Update local state only during resize for smooth performance
          setLocalSize({ width: params.width, height: params.height });
        }}
        onResizeEnd={(e, params) => {
          // Commit to parent state only when resize is complete
          setIsResizing(false);
          onUpdate({
            size: { width: params.width, height: params.height },
            position: { x: params.x, y: params.y },
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
            className="h-8 w-8 p-0 bg-background border border-border hover:bg-accent shadow-sm"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              className="h-8 w-8 p-0 bg-background border border-border hover:bg-accent shadow-sm"
            >
              <Palette className="h-4 w-4" />
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
            className="h-8 w-8 p-0 bg-background border border-border hover:bg-accent shadow-sm"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <Card
        className="note-container relative shadow-lg border-2 rounded-none"
        style={{
          backgroundColor: note.color,
          borderColor: selected ? "hsl(var(--primary))" : "transparent",
          width: currentSize.width,
          height: currentSize.height,
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
                className="w-full bg-transparent border-none outline-none resize-none text-center nodrag note-textarea"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: "1.4",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowY: "auto",
                  overflowWrap: "break-word",
                  padding: "0",
                  maxHeight: "100%",
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
    </>
  );
});

NoteNode.displayName = "NoteNode";
