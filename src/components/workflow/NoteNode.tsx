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

  // Calculate font size based on longest line width
  const calculateFontSize = (content: string, width: number, height: number) => {
    if (!content || content.length === 0) return 20;
    
    const lines = content.split('\n');
    const longestLine = lines.reduce((max, line) => 
      line.length > max.length ? line : max, ''
    );
    
    const availableWidth = width - 32; // padding
    const availableHeight = height - 32;
    
    // Estimate character width (roughly 0.6 of font size for most fonts)
    const charsPerLine = longestLine.length || 1;
    const fontSizeByWidth = (availableWidth / charsPerLine) / 0.6;
    
    // Also consider height constraints
    const lineCount = Math.max(1, lines.length);
    const fontSizeByHeight = (availableHeight / lineCount) / 1.3; // 1.3 is line-height
    
    // Use the smaller of the two to ensure fit
    const fontSize = Math.min(fontSizeByWidth, fontSizeByHeight);
    
    // Clamp between 8px and 24px
    return Math.max(8, Math.min(24, fontSize));
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
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing, localContent, note.content, onUpdate]);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isEditing) {
      e.stopPropagation();
      setIsEditing(true);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Use local state for smooth typing
    setLocalContent(e.target.value);
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
        className="note-container relative shadow-lg transition-all duration-200 cursor-move"
        style={{
          backgroundColor: note.color,
          width: note.size.width,
          height: note.size.height,
          overflow: "hidden",
          pointerEvents: "all",
          border: selected ? "2px solid hsl(var(--primary))" : "2px solid transparent",
          boxShadow: selected ? "0 0 0 1px hsl(var(--primary))" : undefined,
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Toolbar - show when selected and not editing */}
        {selected && !isEditing && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEditClick}
              className="h-6 w-6 p-0 nodrag"
              style={{ backgroundColor: note.color }}
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
            <div className="w-full h-full flex items-center justify-center">
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={handleContentChange}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full h-full bg-transparent border-none outline-none resize-none text-center nodrag"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: "1.3",
                  overflow: "hidden",
                  whiteSpace: "pre-wrap",
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
