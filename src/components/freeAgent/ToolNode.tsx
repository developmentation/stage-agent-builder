// Tool Node - Individual tool visualization
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
  toolId?: string;
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
  const getStatusStyles = () => {
    switch (data.status) {
      case "active":
        return "border-yellow-500 bg-yellow-500/20 shadow-yellow-500/40";
      case "success":
        return "border-green-500 bg-green-500/10";
      case "error":
        return "border-red-500 bg-red-500/10";
      default:
        return "border-border bg-card hover:border-muted-foreground/50";
    }
  };

  const icon = data.icon ? iconMap[data.icon] : <FileText className="w-4 h-4" />;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "w-[100px] h-[60px] rounded-lg border",
        "shadow-sm transition-all duration-200 cursor-pointer",
        getStatusStyles(),
        data.status === "active" && "animate-pulse shadow-lg"
      )}
    >
      {/* Handle for connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground !w-2 !h-2"
      />

      {/* Icon */}
      <div
        className={cn(
          "mb-1",
          data.status === "active" && "text-yellow-500",
          data.status === "success" && "text-green-500",
          data.status === "error" && "text-red-500",
          data.status === "idle" && "text-muted-foreground"
        )}
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
