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
import { Search, X } from "lucide-react";
import { functionDefinitions } from "@/lib/functionDefinitions";
import type { FunctionDefinition } from "@/types/functions";

interface FunctionSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFunction: (functionDef: FunctionDefinition) => void;
}

const categories = [
  { id: "all", name: "All Functions" },
  { id: "string", name: "String" },
  { id: "logic", name: "Logic" },
  { id: "conditional", name: "Conditional" },
  { id: "memory", name: "Memory" },
  { id: "export", name: "Export" },
  { id: "url", name: "URL" },
  { id: "data", name: "Data" },
];

export const FunctionSelector = ({
  open,
  onOpenChange,
  onSelectFunction,
}: FunctionSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFunctions = useMemo(() => {
    let functions = functionDefinitions;

    if (selectedCategory !== "all") {
      functions = functions.filter((f) => f.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      functions = functions.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query) ||
          f.category.toLowerCase().includes(query)
      );
    }

    return functions;
  }, [selectedCategory, searchQuery]);

  const handleSelectFunction = (functionDef: FunctionDefinition) => {
    onSelectFunction(functionDef);
    setSearchQuery("");
    setSelectedCategory("all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Add Function</DialogTitle>
          <DialogDescription>
            Select a function to add to this stage
          </DialogDescription>
        </DialogHeader>

        {/* Mobile Layout - Filters Above */}
        <div className="flex-1 overflow-hidden flex flex-col xl:hidden">
          {/* Search Bar */}
          <div className="px-6 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search functions..."
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

          {/* Functions List - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-3">
              {filteredFunctions.map((func) => (
                <Card
                  key={func.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-all hover:ring-2 hover:ring-primary/20"
                  onClick={() => handleSelectFunction(func)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${func.color}`}>
                      <func.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{func.name}</h4>
                        <Badge variant="secondary" className="text-xs capitalize shrink-0">
                          {func.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{func.description}</p>
                      {func.outputs.length > 1 && (
                        <div className="flex gap-1 mt-2">
                          {func.outputs.map((output) => (
                            <Badge key={output} variant="outline" className="text-[10px] px-1.5 py-0">
                              {output}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {filteredFunctions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No functions found</p>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout - Filters on Left, Functions on Right */}
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

          {/* Right Content - Functions Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              {filteredFunctions.map((func) => (
                <Card
                  key={func.id}
                  className="p-4 cursor-pointer hover:shadow-lg transition-all hover:ring-2 hover:ring-primary/20"
                  onClick={() => handleSelectFunction(func)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${func.color}`}>
                      <func.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{func.name}</h4>
                        <Badge variant="secondary" className="text-xs capitalize shrink-0">
                          {func.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{func.description}</p>
                      {func.outputs.length > 1 && (
                        <div className="flex gap-1 mt-2">
                          {func.outputs.map((output) => (
                            <Badge key={output} variant="outline" className="text-[10px] px-1.5 py-0">
                              {output}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {filteredFunctions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No functions found</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
