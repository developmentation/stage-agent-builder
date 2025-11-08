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

  // Calculate bounding box from path for sizing
  const getBBox = () => {
    try {
      const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tempPath.setAttribute("d", drawing.path);
      tempSvg.appendChild(tempPath);
      document.body.appendChild(tempSvg);
      const bbox = tempPath.getBBox();
      document.body.removeChild(tempSvg);
      return bbox;
    } catch (e) {
      // Fallback if bbox calculation fails
      return { x: 0, y: 0, width: 100, height: 100 };
    }
  };

  const bbox = getBBox();
  const padding = 10;

  return (
    <div
      className={`relative group ${selected ? "ring-2 ring-primary rounded shadow-xl" : ""}`}
      style={{
        width: bbox.width + padding * 2,
        height: bbox.height + padding * 2,
        cursor: selected ? 'default' : 'pointer',
      }}
    >
      {/* Toolbar */}
      {selected && (
        <div className="absolute -top-8 left-0 bg-background/90 backdrop-blur-sm rounded p-1 shadow-lg z-50">
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
        width={bbox.width + padding * 2}
        height={bbox.height + padding * 2}
        className="pointer-events-auto"
        style={{ cursor: 'move' }}
      >
        <path
          d={drawing.path}
          stroke={drawing.color}
          strokeWidth={drawing.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${padding - bbox.x}, ${padding - bbox.y})`}
        />
      </svg>
    </div>
  );
});

DrawingNode.displayName = "DrawingNode";
