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

  // Calculate font size to fit all content within the card
  const calculateFontSize = (content: string, width: number, height: number) => {
    if (!content || content.length === 0) return 20;
    
    const availableWidth = width - 32; // padding
    const availableHeight = height - 32;
    
    // Split content into lines and handle word wrapping at 25 chars
    const processedLines: string[] = [];
    const contentLines = content.split('\n');
    
    contentLines.forEach(line => {
      if (line.length === 0) {
        processedLines.push('');
      } else {
        // Break long lines at 35 characters
        const words = line.split(' ');
        let currentLine = '';
        
        words.forEach(word => {
          if ((currentLine + ' ' + word).trim().length <= 35) {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          } else {
            if (currentLine) processedLines.push(currentLine);
            currentLine = word;
          }
        });
        
        if (currentLine) processedLines.push(currentLine);
      }
    });
    
    const lineCount = Math.max(1, processedLines.length);
    const longestLine = processedLines.reduce((max, line) => 
      line.length > max.length ? line : max, ''
    );
    
    // Estimate character width (roughly 0.6 of font size for most fonts)
    const charsPerLine = Math.max(1, longestLine.length);
    const fontSizeByWidth = (availableWidth / charsPerLine) / 0.6;
    
    // Consider height constraints with line height
    const fontSizeByHeight = (availableHeight / lineCount) / 1.3; // 1.3 is line-height
    
    // Use the smaller of the two to ensure all content fits
    const fontSize = Math.min(fontSizeByWidth, fontSizeByHeight);
    
    // Clamp between 6px and 24px (lowered minimum to accommodate more text)
    return Math.max(6, Math.min(24, fontSize));
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
        onResize={(e, params) => {
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
                className="w-full h-full bg-transparent border-none outline-none resize-none text-center nodrag note-textarea"
                style={{
                  fontSize: "16px",
                  lineHeight: "1.3",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowY: "auto",
                  overflowWrap: "break-word",
                  maxWidth: "100%",
                  wordWrap: "break-word",
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
