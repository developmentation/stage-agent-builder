import { memo } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { Button } from "@/components/ui/button";
import { Trash2, Palette } from "lucide-react";
import type { Shape } from "@/types/workflow";

interface ShapeNodeData {
  shape: Shape;
  onUpdate: (id: string, updates: Partial<Shape>) => void;
  onDelete: (id: string) => void;
}

const colorOptions = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export const ShapeNode = memo(({ data, selected }: NodeProps<ShapeNodeData>) => {
  const { shape, onUpdate, onDelete } = data;

  const cycleColor = () => {
    const currentIndex = colorOptions.indexOf(shape.color);
    const nextColor = colorOptions[(currentIndex + 1) % colorOptions.length];
    onUpdate(shape.id, { color: nextColor });
  };

  const renderShape = () => {
    const { width, height } = shape.size;
    
    switch (shape.type) {
      case "rectangle":
        return (
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={shape.color}
            fillOpacity={shape.fillOpacity}
            stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth}
            rx={4}
          />
        );
      case "circle":
        return (
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={shape.color}
            fillOpacity={shape.fillOpacity}
            stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth}
          />
        );
      case "triangle":
        return (
          <polygon
            points={`${width / 2},0 ${width},${height} 0,${height}`}
            fill={shape.color}
            fillOpacity={shape.fillOpacity}
            stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={50}
        minHeight={50}
        handleStyle={{ width: 16, height: 16 }}
        lineStyle={{ borderWidth: 2 }}
        onResize={(_, params) => {
          onUpdate(shape.id, {
            size: { width: params.width, height: params.height },
          });
        }}
      />
      <div
        className={`relative group ${selected ? "ring-2 ring-primary rounded" : ""}`}
        style={{
          width: shape.size.width,
          height: shape.size.height,
        }}
      >
        {/* Toolbar */}
        {selected && (
          <div className="absolute -top-8 left-0 flex gap-1 bg-background/90 backdrop-blur-sm rounded p-1 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                cycleColor();
              }}
              title="Change color"
            >
              <Palette className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(shape.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        <svg
          width={shape.size.width}
          height={shape.size.height}
          className="cursor-pointer"
        >
          {renderShape()}
        </svg>
      </div>
    </>
  );
});

ShapeNode.displayName = "ShapeNode";
