// Free Agent View - Main container component
import React, { useState, useEffect, useCallback } from "react";
import { FreeAgentCanvas } from "./FreeAgentCanvas";
import { FreeAgentPanel } from "./FreeAgentPanel";
import { BlackboardViewer } from "./BlackboardViewer";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { AssistanceModal } from "./AssistanceModal";
import { FinalReportModal } from "./FinalReportModal";
import { useFreeAgentSession } from "@/hooks/useFreeAgentSession";
import type { ToolsManifest, SessionFile, AssistanceRequest } from "@/types/freeAgent";
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
    async (prompt: string, files: SessionFile[]) => {
      await startSession(prompt, files);
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

  return (
    <div className="h-full w-full bg-background">
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
              </TabsList>
              <TabsContent value="blackboard" className="flex-1 overflow-hidden m-0 p-0">
                <BlackboardViewer entries={session?.blackboard || []} />
              </TabsContent>
              <TabsContent value="artifacts" className="flex-1 overflow-hidden m-0 p-0">
                <ArtifactsPanel artifacts={session?.artifacts || []} />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

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
