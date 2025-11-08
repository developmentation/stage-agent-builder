import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "reactflow";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NoteData {
  content: string;
  color: string;
  onUpdate: (content: string) => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
}

const NOTE_COLORS = [
  "#fef3c7", // yellow
  "#fecaca", // red
  "#bfdbfe", // blue
  "#bbf7d0", // green
  "#e9d5ff", // purple
  "#fed7aa", // orange
  "#fbcfe8", // pink
  "#d1d5db", // gray
];

export const NoteNode = memo(({ data, selected }: NodeProps<NoteData>) => {
  const [content, setContent] = useState(data.content);
  const [fontSize, setFontSize] = useState(16);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate font size based on content length and container size
  useEffect(() => {
    if (!textareaRef.current || !containerRef.current) return;

    const contentLength = content.length;
    const containerHeight = containerRef.current.offsetHeight;
    const containerWidth = containerRef.current.offsetWidth;

    // Dynamic font sizing logic
    let newFontSize = 16;
    if (contentLength > 100) {
      newFontSize = Math.max(10, 16 - Math.floor((contentLength - 100) / 50));
    }

    // Also consider if content overflows
    const lineHeight = newFontSize * 1.5;
    const estimatedLines = content.split('\n').length + Math.floor(contentLength / 40);
    const neededHeight = estimatedLines * lineHeight;

    if (neededHeight > containerHeight && newFontSize > 10) {
      newFontSize = Math.max(10, Math.floor((containerHeight / estimatedLines) * 0.8));
    }

    setFontSize(newFontSize);
  }, [content]);

  const handleBlur = () => {
    if (content !== data.content) {
      data.onUpdate(content);
    }
  };

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-primary"
        handleClassName="h-3 w-3 bg-primary border-2 border-background"
      />
      <Card
        className="shadow-lg border-0 overflow-hidden relative group"
        style={{
          backgroundColor: data.color,
          minWidth: "200px",
          minHeight: "150px",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Delete and Color buttons - hidden until hover */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 bg-background/80 hover:bg-background">
                <Palette className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-4 gap-2">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => data.onColorChange(color)}
                    className="w-8 h-8 rounded border-2 border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="icon"
            variant="ghost"
            onClick={data.onDelete}
            className="h-6 w-6 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Note content */}
        <div ref={containerRef} className="p-3 h-full w-full">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            placeholder="Type your note..."
            className="w-full h-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: "1.5",
            }}
          />
        </div>

        {/* Resize handle visual indicator */}
        <div className="absolute bottom-0 right-0 w-4 h-4 opacity-30">
          <svg viewBox="0 0 16 16" className="w-full h-full">
            <path d="M16 16L16 10L10 16Z" fill="currentColor" />
          </svg>
        </div>
      </Card>
    </>
  );
});

NoteNode.displayName = "NoteNode";
