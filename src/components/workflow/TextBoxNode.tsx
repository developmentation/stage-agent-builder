import { memo, useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { TextBox } from "@/types/workflow";

interface TextBoxNodeData {
  textBox: TextBox;
  selected: boolean;
  onUpdate: (id: string, updates: Partial<TextBox>) => void;
  onDelete: (id: string) => void;
  onEditStart: (id: string) => void;
}

export const TextBoxNode = memo(({ data, selected }: NodeProps<TextBoxNodeData>) => {
  const { textBox, onUpdate, onDelete, onEditStart, selected: isSelected } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(textBox.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected && !isEditing) {
      setIsEditing(true);
      onEditStart(textBox.id);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (content !== textBox.content) {
      onUpdate(textBox.id, { content });
    }
  };

  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(10, Math.min(72, textBox.fontSize + delta));
    onUpdate(textBox.id, { fontSize: newSize });
  };

  return (
    <>
      <NodeResizer
        isVisible={selected && !isEditing}
        minWidth={150}
        minHeight={50}
        handleStyle={{ width: 8, height: 8 }}
        lineStyle={{ borderWidth: 1 }}
        onResize={(_, params) => {
          onUpdate(textBox.id, { width: params.width });
        }}
      />
      <div
        ref={contentRef}
        className={`
          bg-background border-2 border-border rounded-md p-4 cursor-pointer
          ${selected ? "ring-2 ring-primary" : ""}
          relative group overflow-hidden
        `}
        style={{
          width: textBox.width,
          minHeight: 50,
        }}
        onClick={handleClick}
      >
        {/* Toolbar */}
        {selected && !isEditing && (
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                adjustFontSize(2);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                adjustFontSize(-2);
              }}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(textBox.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            className="w-full min-h-[100px] bg-transparent border-none outline-none resize-none text-foreground"
            style={{ fontSize: `${textBox.fontSize}px` }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Enter markdown text..."
          />
        ) : (
          <div
            className="w-full prose prose-sm dark:prose-invert max-w-none"
            style={{ fontSize: `${textBox.fontSize}px` }}
          >
            <ReactMarkdown>{content || "Click to edit"}</ReactMarkdown>
          </div>
        )}
      </div>
    </>
  );
});

TextBoxNode.displayName = "TextBoxNode";
