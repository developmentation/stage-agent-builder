// Tool Node - Individual tool visualization with category coloring
import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import {
  Clock,
  Search,
  Globe,
  Github,
  FileCode,
  ClipboardList,
  Edit3,
  FileText,
  Archive,
  FileArchive,
  FolderOutput,
  FileImage,
  ScanText,
  Mail,
  HelpCircle,
  Image,
  Download,
  Upload,
  Database,
  Table,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolNodeData {
  type: "tool";
  label: string;
  status: "idle" | "thinking" | "active" | "success" | "error";
  icon?: string;
  category?: string;
  categoryColor?: string;
  toolId?: string;
  isInstance?: boolean;
  instanceLabel?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  Clock: <Clock className="w-4 h-4" />,
  Search: <Search className="w-4 h-4" />,
  Globe: <Globe className="w-4 h-4" />,
  Github: <Github className="w-4 h-4" />,
  FileCode: <FileCode className="w-4 h-4" />,
  ClipboardList: <ClipboardList className="w-4 h-4" />,
  Edit3: <Edit3 className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Archive: <Archive className="w-4 h-4" />,
  FileArchive: <FileArchive className="w-4 h-4" />,
  FolderOutput: <FolderOutput className="w-4 h-4" />,
  FileImage: <FileImage className="w-4 h-4" />,
  ScanText: <ScanText className="w-4 h-4" />,
  Mail: <Mail className="w-4 h-4" />,
  HelpCircle: <HelpCircle className="w-4 h-4" />,
  Image: <Image className="w-4 h-4" />,
  Download: <Download className="w-4 h-4" />,
  Upload: <Upload className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  Table: <Table className="w-4 h-4" />,
};

export function ToolNode({ data }: NodeProps<ToolNodeData>) {
  const categoryColor = data.categoryColor || "#6B7280";
  
  const getStatusStyles = () => {
    switch (data.status) {
      case "active":
        return "border-2 border-yellow-500 bg-yellow-500/20 shadow-lg shadow-yellow-500/40";
      case "success":
        return "border-2 bg-card";
      case "error":
        return "border-2 border-red-500 bg-red-500/10";
      default:
        return "border bg-card hover:bg-muted/50";
    }
  };

  const icon = data.icon ? iconMap[data.icon] : <FileText className="w-4 h-4" />;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        "w-[100px] h-[60px] rounded-lg",
        "shadow-sm transition-all duration-200 cursor-pointer",
        getStatusStyles(),
        data.status === "active" && "animate-pulse",
        data.isInstance && "border-dashed"
      )}
      style={{
        borderColor: data.status === "idle" || data.status === "success" 
          ? categoryColor 
          : undefined,
      }}
    >
      {/* Target handle - for receiving connections (write tools receive from agent) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-muted-foreground !w-2 !h-2"
      />

      {/* Source handle - for sending connections (read tools send to agent) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-muted-foreground !w-2 !h-2"
      />

      {/* Category color indicator dot */}
      <div 
        className={cn(
          "absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full border-2 border-background shadow-sm",
          data.isInstance && "ring-2 ring-offset-1 ring-offset-background ring-current"
        )}
        style={{ 
          backgroundColor: categoryColor,
          color: data.isInstance ? categoryColor : undefined,
        }}
      />

      {/* Instance badge */}
      {data.isInstance && (
        <div 
          className="absolute -top-1.5 -right-1.5 px-1 text-[7px] font-bold rounded bg-background border shadow-sm"
          style={{ borderColor: categoryColor, color: categoryColor }}
        >
          INST
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          "mb-1 transition-colors",
          data.status === "active" && "text-yellow-500",
          data.status === "error" && "text-red-500",
          (data.status === "idle" || data.status === "success") && "text-muted-foreground"
        )}
        style={{
          color: (data.status === "idle" || data.status === "success") 
            ? categoryColor 
            : undefined,
        }}
      >
        {icon}
      </div>

      {/* Label */}
      <div className="text-[10px] font-medium text-foreground text-center px-1 truncate w-full">
        {data.label}
      </div>

      {/* Active indicator ring */}
      {data.status === "active" && (
        <div className="absolute inset-0 rounded-lg border-2 border-yellow-500/50 animate-ping" />
      )}
    </div>
  );
}
