// Free Agent View - Main container component
import React, { useState, useEffect, useCallback } from "react";
import { FreeAgentCanvas } from "./FreeAgentCanvas";
import { FreeAgentPanel } from "./FreeAgentPanel";
import { BlackboardViewer } from "./BlackboardViewer";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { RawViewer } from "./RawViewer";
import { AssistanceModal } from "./AssistanceModal";
import { FinalReportModal } from "./FinalReportModal";
import { useFreeAgentSession } from "@/hooks/useFreeAgentSession";
import type { ToolsManifest, SessionFile, AssistanceRequest, FreeAgentSession } from "@/types/freeAgent";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FreeAgentViewProps {
  model?: string;
  maxIterations?: number;
}

export function FreeAgentView({ model, maxIterations }: FreeAgentViewProps) {
  const [toolsManifest, setToolsManifest] = useState<ToolsManifest | null>(null);
  const [assistanceModalOpen, setAssistanceModalOpen] = useState(false);
  const [finalReportModalOpen, setFinalReportModalOpen] = useState(false);
  const [pendingAssistance, setPendingAssistance] = useState<AssistanceRequest | null>(null);

  const {
    session,
    isRunning,
    activeToolIds,
    startSession,
    respondToAssistance,
    stopSession,
    resetSession,
    continueSession,
    updateScratchpad,
  } = useFreeAgentSession({ model, maxIterations });

  // Load tools manifest
  useEffect(() => {
    fetch("/data/toolsManifest.json")
      .then((res) => res.json())
      .then(setToolsManifest)
      .catch(console.error);
  }, []);

  // Handle assistance request
  useEffect(() => {
    if (session?.status === "needs_assistance" && session.assistanceRequest) {
      setPendingAssistance(session.assistanceRequest);
      setAssistanceModalOpen(true);
    }
  }, [session?.status, session?.assistanceRequest]);

  // Show final report when completed
  useEffect(() => {
    if (session?.status === "completed" && session.finalReport) {
      setFinalReportModalOpen(true);
    }
  }, [session?.status, session?.finalReport]);

  const handleStart = useCallback(
    async (prompt: string, files: SessionFile[], existingSession?: FreeAgentSession | null) => {
      await startSession(prompt, files, existingSession);
    },
    [startSession]
  );

  const handleAssistanceResponse = useCallback(
    (response: { response?: string; fileId?: string; selectedChoice?: string }) => {
      setAssistanceModalOpen(false);
      setPendingAssistance(null);
      respondToAssistance(response);
    },
    [respondToAssistance]
  );

  const handleReset = useCallback(() => {
    setFinalReportModalOpen(false);
    resetSession();
  }, [resetSession]);

  const [mobileTab, setMobileTab] = useState<"panel" | "canvas" | "data">("panel");

  return (
    <div className="h-full w-full bg-background">
      {/* Mobile Layout */}
      <div className="lg:hidden h-full flex flex-col">
        {/* Mobile Tabs */}
        <div className="border-b border-border bg-card">
          <div className="flex">
            <button
              onClick={() => setMobileTab("panel")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mobileTab === "panel"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              Control
            </button>
            <button
              onClick={() => setMobileTab("canvas")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mobileTab === "canvas"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => setMobileTab("data")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mobileTab === "data"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              Data
            </button>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "panel" && (
            <div className="h-full overflow-y-auto">
              <FreeAgentPanel
                session={session}
                isRunning={isRunning}
                onStart={handleStart}
                onStop={stopSession}
                onReset={resetSession}
                onContinue={continueSession}
              />
            </div>
          )}
          {mobileTab === "canvas" && (
            <div className="h-full">
              <FreeAgentCanvas
                session={session}
                toolsManifest={toolsManifest}
                activeToolIds={activeToolIds}
                onScratchpadChange={updateScratchpad}
              />
            </div>
          )}
          {mobileTab === "data" && (
            <div className="h-full">
              <Tabs defaultValue="blackboard" className="h-full flex flex-col">
                <TabsList className="mx-2 mt-2">
                  <TabsTrigger value="blackboard" className="flex-1">
                    Blackboard
                  </TabsTrigger>
                  <TabsTrigger value="artifacts" className="flex-1">
                    Artifacts
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="flex-1">
                    Raw
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="blackboard" className="flex-1 overflow-hidden m-0 p-0">
                  <BlackboardViewer entries={session?.blackboard || []} />
                </TabsContent>
                <TabsContent value="artifacts" className="flex-1 overflow-hidden m-0 p-0">
                  <ArtifactsPanel artifacts={session?.artifacts || []} />
                </TabsContent>
                <TabsContent value="raw" className="flex-1 overflow-hidden m-0 p-0">
                  <RawViewer rawData={session?.rawData || []} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block h-full">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - Control & Info */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-hidden">
                <FreeAgentPanel
                  session={session}
                  isRunning={isRunning}
                  onStart={handleStart}
                  onStop={stopSession}
                  onReset={resetSession}
                  onContinue={continueSession}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Center - Canvas */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full bg-muted/20">
              <FreeAgentCanvas
                session={session}
                toolsManifest={toolsManifest}
                activeToolIds={activeToolIds}
                onScratchpadChange={updateScratchpad}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Blackboard & Artifacts */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <div className="h-full">
              <Tabs defaultValue="blackboard" className="h-full flex flex-col">
                <TabsList className="mx-2 mt-2">
                  <TabsTrigger value="blackboard" className="flex-1">
                    Blackboard
                  </TabsTrigger>
                  <TabsTrigger value="artifacts" className="flex-1">
                    Artifacts
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="flex-1">
                    Raw
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="blackboard" className="flex-1 overflow-hidden m-0 p-0">
                  <BlackboardViewer entries={session?.blackboard || []} />
                </TabsContent>
                <TabsContent value="artifacts" className="flex-1 overflow-hidden m-0 p-0">
                  <ArtifactsPanel artifacts={session?.artifacts || []} />
                </TabsContent>
                <TabsContent value="raw" className="flex-1 overflow-hidden m-0 p-0">
                  <RawViewer rawData={session?.rawData || []} />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Modals */}
      <AssistanceModal
        request={pendingAssistance}
        open={assistanceModalOpen}
        onClose={() => setAssistanceModalOpen(false)}
        onRespond={handleAssistanceResponse}
      />

      <FinalReportModal
        report={session?.finalReport || null}
        open={finalReportModalOpen}
        onClose={() => setFinalReportModalOpen(false)}
        onReset={handleReset}
      />
    </div>
  );
}
