// Free Agent View - Main container component
import React, { useState, useEffect, useCallback } from "react";
import { FreeAgentCanvas } from "./FreeAgentCanvas";
import { FreeAgentPanel } from "./FreeAgentPanel";
import { BlackboardViewer } from "./BlackboardViewer";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { RawViewer } from "./RawViewer";
import { SystemPromptViewer } from "./SystemPromptViewer";
import { AssistanceModal } from "./AssistanceModal";
import { FinalReportModal } from "./FinalReportModal";
import { ChildAgentDetailModal } from "./ChildAgentDetailModal";
import { useFreeAgentSession } from "@/hooks/useFreeAgentSession";
import { useSecretsManager } from "@/hooks/useSecretsManager";
import { usePromptCustomization } from "@/hooks/usePromptCustomization";
import { buildPromptData } from "@/lib/systemPromptBuilder";
import type { ToolsManifest, SessionFile, AssistanceRequest, FreeAgentSession, AdvancedFeatures, ChildSession } from "@/types/freeAgent";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, Package, FileCode, FileText } from "lucide-react";

interface FreeAgentViewProps {
  maxIterations?: number;
}

export function FreeAgentView({ maxIterations }: FreeAgentViewProps) {
  const [toolsManifest, setToolsManifest] = useState<ToolsManifest | null>(null);
  const [assistanceModalOpen, setAssistanceModalOpen] = useState(false);
  const [finalReportModalOpen, setFinalReportModalOpen] = useState(false);
  const [pendingAssistance, setPendingAssistance] = useState<AssistanceRequest | null>(null);
  const [selectedChild, setSelectedChild] = useState<ChildSession | null>(null);
  const [childModalOpen, setChildModalOpen] = useState(false);

  const {
    session,
    isRunning,
    activeToolIds,
    startSession,
    respondToAssistance,
    stopSession,
    resetSession,
    continueSession,
    retrySession,
    updateScratchpad,
    getCacheSize,
    interjectSession,
  } = useFreeAgentSession({ maxIterations });

  // Secrets manager for tool parameter injection
  const secretsManager = useSecretsManager();
  
  // Prompt customization for dynamic system prompt
  const promptCustomization = usePromptCustomization('default');

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

  // Don't memoize handleStart - we need fresh customizations every time
  const handleStart = async (prompt: string, files: SessionFile[], model: string, maxIterations: number, existingSession?: FreeAgentSession | null, advancedFeatures?: AdvancedFeatures) => {
    // Compute secrets at start time for tool parameter injection
    const secretOverrides = secretsManager.getSecretOverrides();
    const configuredParams = secretsManager.getConfiguredToolParams();
    
    // Build dynamic prompt data from template + customizations
    // Use promptCustomization directly (not from closure) to get latest values
    const promptData = await buildPromptData(promptCustomization);
    
    console.log('[FreeAgentView] Starting session with promptData:', 
      promptData.sections.find(s => s.id === 'identity')?.content.substring(0, 100));
    console.log('[FreeAgentView] Advanced features:', advancedFeatures);
    
    // Pass the promptCustomization.customizations object for self-author tools
    // Provide a default empty object if no customizations exist yet
    const customizationsData = promptCustomization.customizations || {
      templateId: 'default',
      sectionOverrides: {},
      disabledSections: [],
      additionalSections: [],
      orderOverrides: {},
      toolOverrides: {},
    };
    
    // Pass a callback to reload customizations from localStorage when write_self modifies them
    const handlePromptCustomizationChange = () => {
      console.log('[FreeAgentView] write_self triggered - reloading customizations from storage');
      promptCustomization.loadFromStorage();
    };
    
    await startSession(prompt, files, model, maxIterations, existingSession, secretOverrides, configuredParams, promptData, advancedFeatures, customizationsData, handlePromptCustomizationChange);
  };

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

  const handleInterject = useCallback((message: string) => {
    interjectSession(message);
  }, [interjectSession]);

  const handleChildClick = useCallback((childName: string) => {
    const child = session?.orchestration?.children?.find(c => c.name === childName);
    if (child) {
      setSelectedChild(child);
      setChildModalOpen(true);
    }
  }, [session?.orchestration?.children]);

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
                onRetry={retrySession}
                onInterject={handleInterject}
                cacheSize={getCacheSize()}
                secretsManager={secretsManager}
                toolsManifest={toolsManifest}
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
                onRetry={retrySession}
                onChildClick={handleChildClick}
              />
            </div>
          )}
          {mobileTab === "data" && (
            <div className="h-full">
              <Tabs defaultValue="blackboard" className="h-full flex flex-col">
                <TabsList className="mx-2 mt-2 grid grid-cols-4">
                  <TabsTrigger value="blackboard" className="flex items-center justify-center gap-1 px-1">
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <span className="hidden min-[400px]:inline truncate">Blackboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="artifacts" className="flex items-center justify-center gap-1 px-1">
                    <Package className="w-4 h-4 shrink-0" />
                    <span className="hidden min-[400px]:inline truncate">Artifacts</span>
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="flex items-center justify-center gap-1 px-1">
                    <FileCode className="w-4 h-4 shrink-0" />
                    <span className="hidden min-[400px]:inline truncate">Raw</span>
                  </TabsTrigger>
                  <TabsTrigger value="prompt" className="flex items-center justify-center gap-1 px-1">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="hidden min-[400px]:inline truncate">Prompt</span>
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
                <TabsContent value="prompt" className="flex-1 overflow-hidden m-0 p-0">
                  <SystemPromptViewer configuredParams={secretsManager.getConfiguredToolParams()} promptCustomization={promptCustomization} />
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
          <ResizablePanel defaultSize={25} minSize={5} maxSize={35}>
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-hidden">
                <FreeAgentPanel
                  session={session}
                  isRunning={isRunning}
                  onStart={handleStart}
                  onStop={stopSession}
                  onReset={resetSession}
                  onContinue={continueSession}
                  onRetry={retrySession}
                  onInterject={handleInterject}
                  cacheSize={getCacheSize()}
                  secretsManager={secretsManager}
                  toolsManifest={toolsManifest}
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
                onRetry={retrySession}
                onChildClick={handleChildClick}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Blackboard & Artifacts */}
          <ResizablePanel defaultSize={25} minSize={5} maxSize={35}>
            <div className="h-full">
              <Tabs defaultValue="blackboard" className="h-full flex flex-col">
                <TooltipProvider delayDuration={300}>
                  <TabsList className="mx-2 mt-2 grid grid-cols-4 gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="blackboard" className="flex items-center justify-center gap-1 px-1 min-w-0">
                          <ClipboardList className="w-4 h-4 shrink-0" />
                          <span className="hidden xl:inline truncate text-xs">Blackboard</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="xl:hidden">
                        Blackboard
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="artifacts" className="flex items-center justify-center gap-1 px-1 min-w-0">
                          <Package className="w-4 h-4 shrink-0" />
                          <span className="hidden xl:inline truncate text-xs">Artifacts</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="xl:hidden">
                        Artifacts
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="raw" className="flex items-center justify-center gap-1 px-1 min-w-0">
                          <FileCode className="w-4 h-4 shrink-0" />
                          <span className="hidden xl:inline truncate text-xs">Raw</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="xl:hidden">
                        Raw
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="prompt" className="flex items-center justify-center gap-1 px-1 min-w-0">
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="hidden xl:inline truncate text-xs">Prompt</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="xl:hidden">
                        Prompt
                      </TooltipContent>
                    </Tooltip>
                  </TabsList>
                </TooltipProvider>
                <TabsContent value="blackboard" className="flex-1 overflow-hidden m-0 p-0">
                  <BlackboardViewer entries={session?.blackboard || []} />
                </TabsContent>
                <TabsContent value="artifacts" className="flex-1 overflow-hidden m-0 p-0">
                  <ArtifactsPanel artifacts={session?.artifacts || []} />
                </TabsContent>
                <TabsContent value="raw" className="flex-1 overflow-hidden m-0 p-0">
                  <RawViewer rawData={session?.rawData || []} />
                </TabsContent>
                <TabsContent value="prompt" className="flex-1 overflow-hidden m-0 p-0">
                  <SystemPromptViewer configuredParams={secretsManager.getConfiguredToolParams()} promptCustomization={promptCustomization} />
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
        session={session}
        open={finalReportModalOpen}
        onClose={() => setFinalReportModalOpen(false)}
        onReset={handleReset}
      />

      <ChildAgentDetailModal
        isOpen={childModalOpen}
        onClose={() => setChildModalOpen(false)}
        child={selectedChild}
      />
    </div>
  );
}
