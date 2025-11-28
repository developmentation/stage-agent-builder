import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, FileText, Bot, Sparkles } from "lucide-react";

interface AgentTemplate {
  id: string;
  name: string;
  icon: any;
  description: string;
  category: string;
  defaultSystemPrompt: string;
  defaultUserPrompt: string;
}

const agentTemplates: AgentTemplate[] = [
  { 
    id: "researcher", 
    name: "Researcher", 
    icon: Search, 
    category: "research",
    description: "Gather and analyze information from various sources",
    defaultSystemPrompt: "You are a research assistant specializing in gathering and analyzing information from various sources.",
    defaultUserPrompt: "Research the following topic and provide detailed findings: {input}"
  },
  { 
    id: "summarizer", 
    name: "Summarizer", 
    icon: FileText, 
    category: "content",
    description: "Condense long content into concise summaries",
    defaultSystemPrompt: "You are a summarization expert who creates concise, accurate summaries of long content.",
    defaultUserPrompt: "Summarize the following content: {input}"
  },
  { 
    id: "analyst", 
    name: "Analyst", 
    icon: Bot, 
    category: "analysis",
    description: "Deep data analysis and pattern identification",
    defaultSystemPrompt: "You are a data analyst who provides insightful analysis and identifies patterns in data.",
    defaultUserPrompt: "Analyze the following data and provide insights: {input}"
  },
  { 
    id: "writer", 
    name: "Writer", 
    icon: FileText, 
    category: "content",
    description: "Create engaging written content",
    defaultSystemPrompt: "You are a professional writer who creates compelling, well-structured content.",
    defaultUserPrompt: "Write content based on the following: {input}"
  },
  { 
    id: "editor", 
    name: "Editor", 
    icon: FileText, 
    category: "content",
    description: "Edit and improve written content",
    defaultSystemPrompt: "You are an expert editor who improves clarity, grammar, and style.",
    defaultUserPrompt: "Edit and improve the following content: {input}"
  },
  { 
    id: "fact-checker", 
    name: "Fact Checker", 
    icon: Search, 
    category: "research",
    description: "Verify accuracy and validate claims",
    defaultSystemPrompt: "You are a fact-checker who validates information and identifies inaccuracies.",
    defaultUserPrompt: "Fact-check the following content: {input}"
  },
  { 
    id: "translator", 
    name: "Translator", 
    icon: Sparkles, 
    category: "content",
    description: "Translate content between languages",
    defaultSystemPrompt: "You are a professional translator who provides accurate translations while preserving meaning and tone.",
    defaultUserPrompt: "Translate the following to [TARGET LANGUAGE]: {input}"
  },
  { 
    id: "code-reviewer", 
    name: "Code Reviewer", 
    icon: Bot, 
    category: "analysis",
    description: "Review and analyze code quality",
    defaultSystemPrompt: "You are a code reviewer who identifies bugs, suggests improvements, and ensures best practices.",
    defaultUserPrompt: "Review the following code: {input}"
  },
  { 
    id: "strategist", 
    name: "Strategist", 
    icon: Bot, 
    category: "analysis",
    description: "Develop strategic plans and recommendations",
    defaultSystemPrompt: "You are a strategic advisor who develops actionable plans and recommendations.",
    defaultUserPrompt: "Develop a strategy for: {input}"
  },
];

const categories = [
  { id: "all", name: "All Agents" },
  { id: "library", name: "Library" },
  { id: "research", name: "Research" },
  { id: "content", name: "Content" },
  { id: "analysis", name: "Analysis" },
];

interface AgentSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAgent: (template: AgentTemplate) => void;
  customAgents?: any[];
}

export const AgentSelector = ({
  open,
  onOpenChange,
  onSelectAgent,
  customAgents = [],
}: AgentSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAgents = useMemo(() => {
    // Merge custom agents with predefined templates
    const customAgentsWithCategory = customAgents.map(agent => ({
      ...agent,
      category: "library",
    }));
    let agents = [...customAgentsWithCategory, ...agentTemplates];

    if (selectedCategory !== "all") {
      agents = agents.filter((a) => a.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.category.toLowerCase().includes(query)
      );
    }

    return agents;
  }, [selectedCategory, searchQuery]);

  const handleSelectAgent = (template: AgentTemplate) => {
    onSelectAgent(template);
    setSearchQuery("");
    setSelectedCategory("all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Add Agent</DialogTitle>
          <DialogDescription>
            Select an agent template to add to this stage
          </DialogDescription>
        </DialogHeader>

        {/* Mobile Layout - Filters Above */}
        <div className="flex-1 overflow-hidden flex flex-col xl:hidden">
          {/* Search Bar */}
          <div className="px-6 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Categories - Horizontal Scroll */}
          <div className="px-6 py-3 border-b overflow-x-auto">
            <div className="flex gap-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="whitespace-nowrap"
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Agents List - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-3">
              {filteredAgents.map((template) => (
                <Card
                  key={template.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-all hover:ring-2 hover:ring-primary/20"
                  onClick={() => handleSelectAgent(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <template.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{template.name}</h4>
                        <Badge variant="secondary" className="text-xs capitalize shrink-0">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {filteredAgents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No agents found</p>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout - Filters on Left, Agents on Right */}
        <div className="flex-1 overflow-hidden hidden xl:flex">
          {/* Left Sidebar - Filters */}
          <div className="w-64 border-r flex flex-col">
            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                Categories
              </h3>
              <div className="space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Content - Agents Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              {filteredAgents.map((template) => (
                <Card
                  key={template.id}
                  className="p-4 cursor-pointer hover:shadow-lg transition-all hover:ring-2 hover:ring-primary/20"
                  onClick={() => handleSelectAgent(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <template.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{template.name}</h4>
                        <Badge variant="secondary" className="text-xs capitalize shrink-0">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {filteredAgents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No agents found</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
