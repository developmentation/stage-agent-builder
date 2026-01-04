// Prompt Node - Displays user's original prompt/instructions with resize capability
import { memo, useState, useRef, useEffect } from 'react';
import { NodeProps, Handle, Position, NodeResizer } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquareText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface PromptNodeData {
  type: 'prompt';
  label: string;
  content: string;
  status?: 'idle' | 'active';
}

export const PromptNode = memo(({ data, selected }: NodeProps<PromptNodeData>) => {
  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="bg-blue-500 border-2 border-background rounded"
        handleStyle={{ width: 12, height: 12 }}
      />
      
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500" />
      
      <div className="h-full w-full rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50/90 dark:bg-blue-950/40 shadow-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 bg-blue-200/80 dark:bg-blue-900/60 border-b border-blue-300 dark:border-blue-700 flex items-center gap-2 shrink-0">
          <MessageSquareText className="w-4 h-4 text-blue-700 dark:text-blue-300" />
          <span className="font-semibold text-sm text-blue-800 dark:text-blue-200">
            {data.label || 'User Prompt'}
          </span>
        </div>
        
        {/* Content */}
        <div 
          className="flex-1 overflow-hidden min-h-0 nodrag"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <ScrollArea className="h-full">
            <div className="p-3 prose prose-sm dark:prose-invert max-w-none text-xs">
              {data.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {data.content}
                </ReactMarkdown>
              ) : (
                <p className="text-blue-600/60 dark:text-blue-400/60 italic">
                  No prompt provided
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
});

PromptNode.displayName = 'PromptNode';
