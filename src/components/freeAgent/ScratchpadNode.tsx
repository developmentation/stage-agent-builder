// Scratchpad Node - Agent's working output area
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { NodeProps, NodeResizer, Handle, Position } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardEdit, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ScratchpadNodeData {
  type: 'scratchpad';
  label: string;
  content: string;
  isWriting?: boolean;
  onContentChange?: (content: string) => void;
}

export const ScratchpadNode = memo(({ data, selected }: NodeProps<ScratchpadNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(data.content || '');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync with external content updates
  useEffect(() => {
    setLocalContent(data.content || '');
    // Auto-scroll to bottom when content updates
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data.content]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (data.onContentChange) {
      data.onContentChange(localContent);
    }
  }, [localContent, data]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      if (data.onContentChange) {
        data.onContentChange(localContent);
      }
    }
  }, [localContent, data]);

  return (
    <>
      <NodeResizer
        minWidth={280}
        minHeight={200}
        isVisible={selected}
        lineClassName="border-amber-500"
        handleClassName="bg-amber-500 border-2 border-background rounded"
        handleStyle={{ width: 12, height: 12 }}
      />
      
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-amber-500" />
      <Handle type="source" position={Position.Right} id="attributes" className="!w-3 !h-3 !bg-cyan-500" />
      
      <div 
        className={`h-full w-full rounded-lg border-2 bg-amber-50/90 dark:bg-amber-950/40 shadow-lg overflow-hidden flex flex-col transition-colors ${
          data.isWriting 
            ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/50' 
            : 'border-amber-300 dark:border-amber-700'
        }`}
        onDoubleClick={handleDoubleClick}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-amber-200/80 dark:bg-amber-900/60 border-b border-amber-300 dark:border-amber-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardEdit className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">
              {data.label || 'Scratchpad'}
            </span>
            {data.isWriting && (
              <span className="px-2 py-0.5 text-[10px] bg-amber-500 text-white rounded-full animate-pulse">
                Writing...
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-700 dark:text-amber-300 hover:bg-amber-300/50">
            <Maximize2 className="w-3 h-3" />
          </Button>
        </div>
        
        {/* Content - nodrag class and event handlers prevent scroll from triggering node drag */}
        <div 
          className="flex-1 overflow-hidden min-h-0 nodrag"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {isEditing ? (
            <Textarea
              autoFocus
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-full w-full resize-none border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-mono p-3"
              placeholder="Agent will write results here..."
            />
          ) : (
            <ScrollArea className="h-full" ref={scrollRef}>
              <div className="p-3 prose prose-sm dark:prose-invert max-w-none text-xs">
                {localContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {localContent}
                  </ReactMarkdown>
                ) : (
                  <p className="text-amber-600/60 dark:text-amber-400/60 italic text-center py-8">
                    Agent's working output will appear here...
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </>
  );
});

ScratchpadNode.displayName = 'ScratchpadNode';
