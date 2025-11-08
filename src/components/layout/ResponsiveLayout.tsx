import { ReactNode, useState } from "react";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Workflow } from "@/types/workflow";

interface ResponsiveLayoutProps {
  sidebar: ReactNode;
  mobileCanvas: ReactNode;
  desktopCanvas: ReactNode;
  properties: ReactNode;
  onAddStage: () => void;
  onRun: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onClear: () => void;
  hasSelectedAgent: boolean;
  viewMode?: "stacked" | "canvas" | "simple";
  onToggleViewMode?: () => void;
  workflow?: Workflow;
}

export const ResponsiveLayout = ({
  sidebar,
  mobileCanvas,
  desktopCanvas,
  properties,
  onAddStage,
  onRun,
  onSave,
  onLoad,
  onClear,
  hasSelectedAgent,
  viewMode,
  onToggleViewMode,
  workflow,
}: ResponsiveLayoutProps) => {
  const [mobileTab, setMobileTab] = useState<"library" | "workflow" | "properties">("workflow");

  return (
    <>
      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col flex-1 overflow-hidden">
        <MobileNav
          activeTab={mobileTab}
          onTabChange={setMobileTab}
          onAddStage={onAddStage}
          onRun={onRun}
          onSave={onSave}
          onLoad={onLoad}
          onClear={onClear}
          hasSelectedAgent={hasSelectedAgent}
          viewMode={viewMode}
          onToggleViewMode={onToggleViewMode}
        />
        
        <div className="flex-1 overflow-hidden">
          <div
            className={cn(
              "h-full overflow-y-auto",
              mobileTab !== "library" && "hidden"
            )}
          >
            {sidebar}
          </div>
          <div
            className={cn(
              "h-full overflow-hidden",
              mobileTab !== "workflow" && "hidden"
            )}
          >
            {mobileCanvas}
          </div>
          <div
            className={cn(
              "h-full overflow-y-auto",
              mobileTab !== "properties" && "hidden"
            )}
          >
            {properties}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {viewMode === "simple" ? (
          // Simple view - full width, no sidebars
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            {desktopCanvas}
          </div>
        ) : (
          // Stacked/Canvas view - with sidebars
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30} collapsible collapsedSize={0}>
              <div className="h-full border-r border-border overflow-y-auto relative">
                {sidebar}
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={60} minSize={40}>
              <div className="flex-1 flex flex-col overflow-hidden h-full">
                {desktopCanvas}
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30} collapsible collapsedSize={0}>
              <div className="h-full border-l border-border overflow-y-auto relative">
                {properties}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </>
  );
};
