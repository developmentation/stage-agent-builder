// Category Label Node - Visual grouping label for tool categories
import React from "react";
import { NodeProps } from "reactflow";

interface CategoryLabelNodeData {
  type: "categoryLabel";
  label: string;
  color: string;
  toolCount: number;
}

export function CategoryLabelNode({ data }: NodeProps<CategoryLabelNodeData>) {
  return (
    <div className="flex flex-col items-center pointer-events-none select-none">
      {/* Category name label */}
      <div 
        className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full opacity-80"
        style={{ 
          color: data.color,
          backgroundColor: `${data.color}15`,
        }}
      >
        {data.label}
      </div>
    </div>
  );
}
