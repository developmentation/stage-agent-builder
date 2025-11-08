import React, { useState, useEffect, useRef } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Note } from '@/types/workflow';

const NOTE_COLORS = [
  { name: 'Yellow', value: '45 95% 85%' },
  { name: 'Pink', value: '330 85% 85%' },
  { name: 'Blue', value: '210 85% 85%' },
  { name: 'Green', value: '155 65% 85%' },
  { name: 'Purple', value: '270 70% 85%' },
  { name: 'Orange', value: '25 85% 85%' },
];

export function NoteNode({ data, selected }: NodeProps) {
  const note = data.note as Note;
  const [content, setContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);

  // Calculate dynamic font size based on content length and container size
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth - 32; // padding
    const containerHeight = container.offsetHeight - 80; // padding + controls
    const contentLength = content.length;

    // Calculate font size: starts at 24px, decreases as content grows
    // Formula ensures text always fits
    const area = containerWidth * containerHeight;
    const charArea = area / Math.max(contentLength, 10);
    const calculatedSize = Math.sqrt(charArea) * 0.8;
    
    // Clamp between 10px and 24px
    const newFontSize = Math.max(10, Math.min(24, calculatedSize));
    setFontSize(newFontSize);
  }, [content, note.size]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    data.onUpdate?.(note.id, { content: newContent });
  };

  const handleColorChange = (color: string) => {
    data.onUpdate?.(note.id, { color });
  };

  const handleDelete = () => {
    data.onDelete?.(note.id);
  };

  return (
    <div 
      ref={containerRef}
      className="relative h-full w-full rounded-lg shadow-lg border-2 transition-all"
      style={{ 
        backgroundColor: `hsl(${note.color})`,
        borderColor: selected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
      }}
    >
      <NodeResizer
        color="hsl(var(--primary))"
        isVisible={selected}
        minWidth={150}
        minHeight={150}
        handleClassName="!w-3 !h-3 !rounded-full !border-2"
      />

      <div className="h-full w-full p-4 flex flex-col">
        {/* Color picker and delete button */}
        <div className="flex items-center justify-between mb-2 gap-1">
          <div className="flex gap-1">
            {NOTE_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => handleColorChange(color.value)}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ 
                  backgroundColor: `hsl(${color.value})`,
                  borderColor: note.color === color.value ? 'hsl(var(--primary))' : 'transparent',
                }}
                title={color.name}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-60 hover:opacity-100"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center">
          {isEditing ? (
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              className="w-full h-full resize-none border-none bg-transparent text-center focus-visible:ring-0 focus-visible:ring-offset-0 p-2"
              style={{ 
                fontSize: `${fontSize}px`,
                lineHeight: '1.4',
              }}
              placeholder="Type note..."
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="w-full h-full flex items-center justify-center cursor-text p-2 text-center break-words"
              style={{ 
                fontSize: `${fontSize}px`,
                lineHeight: '1.4',
                color: 'hsl(var(--foreground))',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {content || <span className="opacity-50">Click to add note...</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
