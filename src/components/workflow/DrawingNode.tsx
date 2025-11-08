import { memo } from "react";
import { NodeProps } from "reactflow";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Drawing } from "@/types/workflow";

interface DrawingNodeData {
  drawing: Drawing;
  onDelete: (id: string) => void;
}

export const DrawingNode = memo(({ data, selected }: NodeProps<DrawingNodeData>) => {
  const { drawing, onDelete } = data;

  // Calculate bounding box from path
  const getBBox = () => {
    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempPath.setAttribute("d", drawing.path);
    tempSvg.appendChild(tempPath);
    document.body.appendChild(tempSvg);
    const bbox = tempPath.getBBox();
    document.body.removeChild(tempSvg);
    return bbox;
  };

  const bbox = getBBox();

  return (
    <div
      className={`relative group ${selected ? "ring-2 ring-primary rounded" : ""}`}
      style={{
        width: bbox.width + 20,
        height: bbox.height + 20,
      }}
    >
      {/* Toolbar */}
      {selected && (
        <div className="absolute -top-8 left-0 bg-background/90 backdrop-blur-sm rounded p-1 shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(drawing.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      <svg
        width={bbox.width + 20}
        height={bbox.height + 20}
        className="cursor-pointer"
      >
        <path
          d={drawing.path}
          stroke={drawing.color}
          strokeWidth={drawing.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${10 - bbox.x}, ${10 - bbox.y})`}
        />
      </svg>
    </div>
  );
});

DrawingNode.displayName = "DrawingNode";
