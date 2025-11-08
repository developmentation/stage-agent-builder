import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Palette, GripVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/workflow";

interface NoteNodeProps {
  note: Note;
  onUpdate: (updates: Partial<Note>) => void;
  onDelete: () => void;
}

const NOTE_COLORS = [
  "#fef08a", // yellow
  "#bfdbfe", // blue
  "#fbcfe8", // pink
  "#bbf7d0", // green
  "#fed7aa", // orange
  "#e9d5ff", // purple
  "#fecaca", // red
  "#d1d5db", // gray
];

export function NoteNode({ note, onUpdate, onDelete }: NoteNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate font size based on content length
  const getFontSize = () => {
    const length = content.length;
    if (length < 50) return "text-2xl";
    if (length < 100) return "text-xl";
    if (length < 200) return "text-lg";
    if (length < 400) return "text-base";
    return "text-sm";
  };

  // Handle double click to enter edit mode
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  // Handle blur - save and exit edit mode
  const handleBlur = () => {
    if (isEditing) {
      setIsEditing(false);
      onUpdate({ content });
    }
  };

  // Handle color change
  const handleColorChange = (newColor: string) => {
    onUpdate({ color: newColor });
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    if (isEditing) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - note.position.x,
      y: e.clientY - note.position.y,
    });
  };

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      onUpdate({
        position: {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        },
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, onUpdate]);

  return (
    <Card
      ref={cardRef}
      className={cn(
        "absolute p-4 shadow-lg transition-shadow cursor-move select-none",
        "hover:shadow-xl"
      )}
      style={{
        backgroundColor: note.color,
        left: note.position.x,
        top: note.position.y,
        width: note.size.width,
        height: note.size.height,
        zIndex: 1000,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Drag handle */}
      {!isEditing && (
        <div
          className="absolute top-2 left-2 cursor-move"
          onMouseDown={handleDragStart}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Toolbar */}
      {!isEditing && (
        <div className="absolute top-2 right-2 flex gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 bg-background/80 hover:bg-background"
                onClick={(e) => e.stopPropagation()}
              >
                <Palette className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-4 gap-2">
                {NOTE_COLORS.map((noteColor) => (
                  <button
                    key={noteColor}
                    className={cn(
                      "w-8 h-8 rounded border-2 transition-all",
                      note.color === noteColor ? "border-primary scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: noteColor }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorChange(noteColor);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Content area */}
      <div className="h-full w-full flex items-center justify-center pt-6">
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            className={cn(
              "w-full h-full resize-none text-center border-none shadow-none focus-visible:ring-0 p-0",
              getFontSize(),
              "font-medium bg-transparent"
            )}
            style={{ color: "#000" }}
            placeholder="Type your note..."
          />
        ) : (
          <div
            className={cn(
              "w-full h-full flex items-center justify-center text-center break-words whitespace-pre-wrap",
              getFontSize(),
              "font-medium px-2"
            )}
            style={{ color: "#000" }}
          >
            {content || "Double-click to edit"}
          </div>
        )}
      </div>
    </Card>
  );
}
