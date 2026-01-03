// Prompt File Node - Displays user-provided files
import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { FileText, FileImage, FileCode, FileArchive, File } from 'lucide-react';

export interface PromptFileNodeData {
  type: 'promptFile';
  label: string;
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  status?: 'idle' | 'reading';
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('archive')) return FileArchive;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('text/')) return FileCode;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const PromptFileNode = memo(({ data }: NodeProps<PromptFileNodeData>) => {
  const FileIcon = getFileIcon(data.mimeType);

  return (
    <>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-emerald-500" />
      
      <div className={`w-48 rounded-lg border-2 bg-emerald-50/90 dark:bg-emerald-950/40 shadow-md overflow-hidden transition-colors ${
        data.status === 'reading'
          ? 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-400/50'
          : 'border-emerald-300 dark:border-emerald-700'
      }`}>
        {/* Header */}
        <div className="px-2 py-1.5 bg-emerald-200/80 dark:bg-emerald-900/60 border-b border-emerald-300 dark:border-emerald-700 flex items-center gap-2">
          <FileIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
          <span className="font-medium text-xs text-emerald-800 dark:text-emerald-200 truncate">
            {data.filename}
          </span>
        </div>
        
        {/* Metadata */}
        <div className="px-2 py-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <span className="truncate">{data.mimeType.split('/')[1] || data.mimeType}</span>
          <span>{formatFileSize(data.size)}</span>
        </div>
        
        {data.status === 'reading' && (
          <div className="px-2 pb-1.5">
            <span className="px-2 py-0.5 text-[10px] bg-emerald-500 text-white rounded-full animate-pulse">
              Reading...
            </span>
          </div>
        )}
      </div>
    </>
  );
});

PromptFileNode.displayName = 'PromptFileNode';
