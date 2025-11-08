import { memo, useState, useRef } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface NoteData {
  content: string;
  color: string;
  onUpdate: (content: string, color: string) => void;
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

export const NoteNode = memo(({ data, selected }: NodeProps<NoteData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content);
  const [color, setColor] = useState(data.color);
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

  // Handle click on card
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      // First click - just select the card
      return;
    }
  };

  // Handle double click to enter edit mode
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selected && !isEditing) {
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
      data.onUpdate(content, color);
    }
  };

  // Handle color change
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    data.onUpdate(content, newColor);
  };

  // Handle delete
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onDelete();
  };

  return (
    <>
      {/* Add NodeResizer for resizing functionality */}
      {selected && !isEditing && (
        <NodeResizer
          minWidth={200}
          minHeight={200}
          isVisible={selected}
          lineClassName="border-primary"
          handleClassName="h-3 w-3 bg-primary border-2 border-background rounded-full"
        />
      )}
      
      <Card
        ref={cardRef}
        className={cn(
          "relative p-4 min-w-[200px] min-h-[200px] shadow-lg cursor-move transition-shadow",
          selected && "ring-2 ring-primary shadow-xl",
          "hover:shadow-xl"
        )}
        style={{ 
          backgroundColor: color,
          width: "100%",
          height: "100%",
        }}
        onClick={handleCardClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Toolbar - only show when selected and not editing */}
        {selected && !isEditing && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
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
                        color === noteColor ? "border-primary scale-110" : "border-transparent"
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
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Content area */}
        <div className="h-full w-full flex items-center justify-center">
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
                "font-medium cursor-pointer px-2"
              )}
              style={{ color: "#000" }}
            >
              {content || "Double-click to edit"}
            </div>
          )}
        </div>

        {/* Resize hint when selected */}
        {selected && !isEditing && (
          <div className="absolute bottom-1 right-1 text-xs text-muted-foreground opacity-50">
            ⌟
          </div>
        )}
      </Card>
    </>
  );
});

NoteNode.displayName = "NoteNode";
