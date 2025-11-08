import { memo, useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Trash2 } from "lucide-react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { note, onUpdate, onDelete } = data;

  // Calculate font size based on content length to fit within the note
  const calculateFontSize = (content: string, width: number, height: number) => {
    if (!content || content.length === 0) return 20;
    
    const area = width * height;
    const contentLength = content.length;
    
    // More aggressive scaling - starts at 20px and scales down more dramatically
    const scaleFactor = Math.sqrt(area / (contentLength * 15));
    const fontSize = Math.max(8, Math.min(20, scaleFactor));
    
    return fontSize;
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

  const handleCardClick = (e: React.MouseEvent) => {
    // Clicking on the card when not selected = select it (first click)
    // When selected but not editing, clicking on text area = enter edit mode (second click)
    if (selected && !isEditing) {
      // Already selected, this is the second click - enter edit mode
      setIsEditing(true);
    }
    // If not selected, ReactFlow will handle selecting it (first click)
  };

  const handleBlur = () => {
    setIsEditing(false);
    setShowColorPicker(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ content: e.target.value });
  };

  const handleColorChange = (color: string) => {
    onUpdate({ color });
    setShowColorPicker(false);
  };

  return (
    <>
      <NodeResizer
        isVisible={selected && !isEditing}
        minWidth={150}
        minHeight={100}
        maxWidth={600}
        maxHeight={600}
        onResize={(e, params) => {
          onUpdate({
            size: { width: params.width, height: params.height },
          });
        }}
      />
      <Card
        className="relative shadow-lg border-2 transition-all duration-200"
        style={{
          backgroundColor: note.color,
          borderColor: selected ? "hsl(var(--primary))" : "transparent",
          width: note.size.width,
          height: note.size.height,
          overflow: "hidden",
        }}
        onClick={handleCardClick}
      >
        {/* Toolbar - only show when selected and not editing */}
        {selected && !isEditing && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPicker(!showColorPicker);
                }}
                className="h-6 w-6 p-0 nodrag"
              >
                <Palette className="h-3 w-3" />
              </Button>
              {showColorPicker && (
                <div className="absolute top-8 right-0 p-2 bg-background border rounded-md shadow-lg flex gap-1 nodrag">
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
              className="h-6 w-6 p-0 nodrag"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Content area */}
        <div
          className="w-full h-full flex items-center justify-center p-4"
          style={{ overflow: "hidden" }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={note.content}
              onChange={handleContentChange}
              onBlur={handleBlur}
              className="w-full h-full bg-transparent border-none outline-none resize-none text-center nodrag"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: "1.3",
                overflow: "hidden",
              }}
              placeholder="Type your note..."
            />
          ) : (
            <div
              ref={contentRef}
              className="w-full h-full flex items-center justify-center text-center break-words"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: "1.3",
                overflow: "hidden",
                wordWrap: "break-word",
                overflowWrap: "break-word",
                hyphens: "auto",
              }}
            >
              {note.content || "Click to edit..."}
            </div>
          )}
        </div>
      </Card>
    </>
  );
});

NoteNode.displayName = "NoteNode";
