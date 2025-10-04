import { ReactNode, useState } from "react";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";

interface ResponsiveLayoutProps {
  sidebar: ReactNode;
  canvas: ReactNode;
  properties: ReactNode;
  onAddStage: () => void;
  onRun: () => void;
  hasSelectedAgent: boolean;
}

export const ResponsiveLayout = ({
  sidebar,
  canvas,
  properties,
  onAddStage,
  onRun,
  hasSelectedAgent,
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
          hasSelectedAgent={hasSelectedAgent}
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
            {canvas}
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
        <div className="w-80 border-r border-border overflow-y-auto">
          {sidebar}
        </div>
        
        <div className="flex-1 overflow-hidden">
          {canvas}
        </div>
        
        <div className="w-96 border-l border-border overflow-y-auto">
          {properties}
        </div>
      </div>
    </>
  );
};
