# Free Agent Feature Documentation

## Overview

Free Agent is an autonomous AI mode in the Agent Builder Console that allows an AI agent to independently complete complex tasks using a suite of tools. Unlike the Workflow mode (which executes predefined node-based workflows), Free Agent operates in an iterative loop where the LLM reasons about the task, executes tools, and tracks progress until completion.

### Key Differences from Workflow Mode

| Aspect | Workflow Mode | Free Agent Mode |
|--------|---------------|-----------------|
| Execution | Pre-defined node graph | Autonomous iteration loop |
| Control | User defines each step | AI decides next actions |
| Memory | Per-node state | Blackboard + Scratchpad + Attributes |
| Flexibility | Fixed flow | Dynamic, goal-oriented |

---

## Architecture

### Frontend Components

```
src/components/freeAgent/
├── FreeAgentView.tsx       # Main container, switches between canvas/panel views
├── FreeAgentPanel.tsx      # Control panel: prompt input, model selection, run controls
├── FreeAgentCanvas.tsx     # Visual node graph showing agent, tools, memory
├── BlackboardViewer.tsx    # Displays planning journal entries
├── ArtifactsPanel.tsx      # Shows generated artifacts (documents, data)
├── RawViewer.tsx           # Debug view: Input/Output/Tools tabs
├── AssistanceModal.tsx     # Modal for user input when agent needs help
├── FinalReportModal.tsx    # Shows task completion summary
└── [Node Components]       # FreeAgentNode, ToolNode, PromptNode, etc.
```

### Core Hook

**`src/hooks/useFreeAgentSession.ts`**

Manages the entire session lifecycle:
- Session state (idle, running, paused, completed, error, needs_assistance)
- Iteration loop execution
- Tool result caching
- Memory synchronization via refs
- Assistance request handling

### Tool Executor

**`src/lib/freeAgentToolExecutor.ts`**

Handles tool execution with two categories:
1. **Frontend Tools**: Executed locally (memory read/write, file operations, exports)
2. **Edge Function Tools**: Dispatched to Supabase functions (search, scrape, API calls)

### Edge Function

**`supabase/functions/free-agent/index.ts`**

Main orchestration function:
- Builds system prompt with memory state
- Calls LLM (Gemini, Claude, or Grok)
- Parses structured JSON response
- Executes backend tools
- Returns results for next iteration

---

## Memory System

Free Agent uses a three-tier memory architecture:

### 1. Blackboard (Planning Journal)

**Purpose**: Track progress, prevent loops, maintain context

- **Always visible** in the system prompt every iteration
- Stores: current step, completed items, next actions, observations, decisions
- Agent MUST write to blackboard every iteration

**Categories**:
- `plan` - Current step and progress tracking
- `observation` - What the agent found or learned
- `insight` - Conclusions drawn from observations
- `decision` - Choices made and reasoning
- `error` - Problems encountered

### 2. Scratchpad (Data Storage)

**Purpose**: Store YOUR SUMMARIES and notes, not raw data dumps

- Contains your summaries, analysis, and extracted insights
- May contain `{{attribute_name}}` references (placeholders, NOT auto-expanded)
- Handlebars are just placeholders - use `read_attribute` to fetch full data
- Read on-demand to preserve context window
- Persists across iterations

**Important**: `read_scratchpad` does NOT auto-expand handlebar references. It returns:
- Your scratchpad content as-is
- List of available attributes for `read_attribute`

### 3. Named Attributes (Tool Result Storage)

**Purpose**: Token-efficient storage of large tool results

When a tool uses `saveAs` parameter:
```json
{ "tool": "web_scrape", "params": { "url": "...", "saveAs": "weather_data" } }
```

- Result is stored as independent attribute
- Agent receives small confirmation (not full data)
- Reference `{{weather_data}}` auto-added to scratchpad as placeholder
- Use `read_attribute(["weather_data"])` to retrieve full content
- **After reading, agent must SUMMARIZE key findings to scratchpad**

### Correct Workflow for Data Retrieval

1. Fetch with saveAs: `{ "tool": "brave_search", "params": { "query": "...", "saveAs": "search_results" } }`
2. Receive confirmation: "Saved to 'search_results'. Use read_attribute..."
3. Read attribute: `{ "tool": "read_attribute", "params": { "names": ["search_results"] } }`
4. **SUMMARIZE** to scratchpad: `{ "tool": "write_scratchpad", "params": { "content": "## Search Summary\\n- Key finding 1\\n- Key finding 2" } }`
5. Continue working from your summary - don't re-read raw data!

---

## Tool Categories

### Memory Tools (Frontend-Handled)
| Tool | Description |
|------|-------------|
| `read_blackboard` | Read planning journal entries |
| `write_blackboard` | Add entry to planning journal |
| `read_scratchpad` | Read data storage (NO handlebar expansion - use read_attribute) |
| `write_scratchpad` | Save data to persistent storage |
| `read_file` | Read content of session file |
| `read_prompt` | Get original user prompt |
| `read_prompt_files` | List available session files |
| `read_attribute` | Access saved tool results |

### Search & Web Tools (Edge Functions)
| Tool | Edge Function | Description |
|------|---------------|-------------|
| `brave_search` | brave-search | Web search via Brave API |
| `google_search` | google-search | Web search via Google API |
| `web_scrape` | web-scrape | Extract content from webpage |

### GitHub Tools (Edge Functions)
| Tool | Edge Function | Description |
|------|---------------|-------------|
| `read_github_repo` | github-fetch | Get repository file tree |
| `read_github_file` | github-fetch | Read specific files from repo |

### Document Tools (Edge Functions)
| Tool | Edge Function | Description |
|------|---------------|-------------|
| `pdf_info` | tool_pdf-handler | Get PDF metadata and page count |
| `pdf_extract_text` | tool_pdf-handler | Extract text from PDF |
| `ocr_image` | tool_ocr-handler | OCR text extraction from image |
| `read_zip_contents` | tool_zip-handler | List files in ZIP archive |
| `read_zip_file` | tool_zip-handler | Read specific file from ZIP |
| `extract_zip_files` | tool_zip-handler | Extract files from ZIP |

### Communication Tools
| Tool | Edge Function | Description |
|------|---------------|-------------|
| `send_email` | send-email | Send email via Resend |
| `request_assistance` | (frontend) | Ask user for input |

### Generation Tools (Edge Functions)
| Tool | Edge Function | Description |
|------|---------------|-------------|
| `image_generation` | run-nano | Generate image from prompt |
| `elevenlabs_tts` | elevenlabs-tts | Text-to-speech synthesis |

### API Tools (Edge Functions)
| Tool | Edge Function | Description |
|------|---------------|-------------|
| `get_call_api` | api-call | HTTP GET request |
| `post_call_api` | api-call | HTTP POST request |
| `execute_sql` | external-db | Execute SQL on external database |

### Utility Tools (Edge Functions)
| Tool | Edge Function | Description |
|------|---------------|-------------|
| `get_time` | time | Get current date/time |
| `get_weather` | tool_weather | Get weather for location |

### Export Tools (Frontend-Handled)
| Tool | Description |
|------|-------------|
| `export_word` | Create Word document artifact |
| `export_pdf` | Create PDF document artifact |

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER ENTERS PROMPT                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              SESSION INITIALIZED (iteration = 1)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────────┐
         │           ITERATION LOOP START             │
         └────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. BUILD SYSTEM PROMPT                                         │
│     - Include blackboard (always)                               │
│     - Include scratchpad preview                                │
│     - Include previous tool results                             │
│     - Include session files                                     │
│     - Include assistance response (if any)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. CALL LLM (Gemini/Claude/Grok)                              │
│     - Provider-specific formatting                              │
│     - JSON mode enforcement                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. PARSE RESPONSE                                              │
│     - Extract: reasoning, tool_calls, blackboard_entry,        │
│       status, message_to_user, artifacts, final_report          │
│     - Handle parsing errors gracefully                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. EXECUTE TOOLS (parallel within iteration)                   │
│     - Backend tools → Edge functions                            │
│     - Frontend tools → Local handlers                           │
│     - Handle saveAs for auto-attribute creation                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. UPDATE MEMORY                                               │
│     - Add blackboard entry                                      │
│     - Update scratchpad                                         │
│     - Store tool result attributes                              │
│     - Create artifacts                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. CHECK STATUS                                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │ in_progress  │  │  completed   │  │ needs_assistance │      │
│  │ → continue   │  │ → show report│  │ → show modal     │      │
│  └──────────────┘  └──────────────┘  └──────────────────┘      │
│                                                                 │
│  ┌──────────────┐  ┌───────────────────────────────────┐       │
│  │    error     │  │     max_iterations reached        │       │
│  │ → show error │  │ → auto-complete with summary      │       │
│  └──────────────┘  └───────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────────┐
         │     INCREMENT ITERATION, LOOP BACK         │
         └────────────────────────────────────────────┘
```

---

## Anti-Loop Mechanisms

### Problem: Infinite Loops
Without safeguards, the agent might:
- Re-execute the same search repeatedly
- Forget what it already found
- Never progress to completion

### Solutions Implemented

1. **Blackboard Mandatory & Verbose**: Every response MUST include detailed `blackboard_entry`
   - Tracks completed steps AND key findings/extracted data
   - Agent reads this every iteration
   - Must include: COMPLETED, EXTRACTED/FOUND, NEXT
   
2. **Tool Results Visibility**: Results only visible for ONE iteration
   - Must save to scratchpad or use `saveAs`
   - Clear warning in prompt about disappearing results

3. **saveAs Auto-Save**: Data-fetching tools can auto-save results
   - Agent receives confirmation, not full data
   - Reduces token waste and re-fetching

4. **Frontend Tool Cache**: Expensive operations cached for 5 minutes
   - `read_github_repo`, `read_github_file`, `web_scrape`
   - Identical requests served from cache

5. **Max Iterations**: Hard limit (default 20) prevents runaway loops
   - Auto-generates summary when limit reached

---

## Session States

| State | Description | User Actions |
|-------|-------------|--------------|
| `idle` | Ready for new task | Enter prompt, Start |
| `running` | Executing iteration loop | Pause, Stop |
| `paused` | Temporarily halted | Resume, Stop |
| `needs_assistance` | Waiting for user input | Provide response |
| `completed` | Task finished | View report, Continue, Reset |
| `error` | Execution failed | View error, Reset |

### Continue vs Reset

- **Continue**: Preserves blackboard, scratchpad, artifacts. Allows new task building on previous work.
- **Reset**: Clears all memory. Fresh start.

---

## Canvas Visualization

The FreeAgentCanvas provides visual feedback of the agent's state:

```
                    ┌──────────────┐
                    │  Read Tools  │  (brave_search, web_scrape, etc.)
                    │   ┌──┐ ┌──┐  │
                    │   │  │ │  │  │
                    └───┴──┴─┴──┴──┘
                          │
                          ▼ (blue connection)
┌─────────┐         ┌─────────────┐         ┌────────────┐
│ Prompt  │────────▶│    AGENT    │────────▶│ Scratchpad │
│ Node    │         │   (Center)  │         │    Node    │──────▶ Attribute Nodes
└─────────┘         └─────────────┘         └────────────┘
     │                    │                       │
  File Nodes              │                  Artifact Nodes
                          ▼ (amber connection)
                    ┌──────────────┐
                    │ Write Tools  │  (send_email, export_pdf, etc.)
                    │   ┌──┐ ┌──┐  │
                    │   │  │ │  │  │
                    └───┴──┴─┴──┴──┘
```

### Node Types

- **Agent Node**: Center, shows current status with pulsing animation when active
- **Tool Nodes**: Above (read) and below (write), color-coded by status
- **Prompt Node**: Left side, shows user's task
- **File Nodes**: Below prompt, session files
- **Scratchpad Node**: Right side, shows memory content
- **Attribute Nodes**: Far right, individual saved tool results
- **Artifact Nodes**: Below scratchpad, generated outputs

---

## Debugging with Raw Viewer

The Raw tab provides complete visibility into the iteration:

### Input Tab
- **System Prompt**: Full prompt sent to LLM including memory state
- **User Prompt**: Original task description
- **Full Prompt**: Combined system + user prompt

### Output Tab
- **Raw Response**: Exact LLM output (JSON)
- **Parse Errors**: If parsing failed, shows error details and problematic text

### Tools Tab
- **Tool Results**: Each tool call with success/failure status and result data

---

## Multi-Model Support

Free Agent supports three LLM providers:

### Gemini (Default)
- Models: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-pro-preview`, `gemini-3-flash-preview`
- JSON Mode: `responseMimeType: "application/json"`
- API Key: `GEMINI_API_KEY`

### Claude
- Models: `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-5`
- JSON Mode: Forced tool use with `respond_with_actions` tool
- API Key: `ANTHROPIC_API_KEY`

### Grok
- Models: `grok-4-1-fast-reasoning`, `grok-4-1-fast-non-reasoning`, `grok-code-fast-1`
- JSON Mode: OpenAI-compatible `response_format` with JSON schema
- API Key: `XAI_API_KEY`

All models use the same response schema for consistency.

---

## Response Schema

Every LLM response must conform to:

```json
{
  "reasoning": "Agent's thought process (required)",
  "tool_calls": [
    {
      "tool": "tool_name",
      "params": { ... }
    }
  ],
  "blackboard_entry": {
    "category": "plan|observation|insight|decision|error",
    "content": "What happened this iteration (required)"
  },
  "status": "in_progress|completed|needs_assistance|error",
  "message_to_user": "Optional progress update",
  "artifacts": [
    {
      "type": "text|file|image|data",
      "title": "Artifact title",
      "content": "Artifact content",
      "description": "Optional description"
    }
  ],
  "final_report": {
    "summary": "Task completion summary",
    "tools_used": ["tool1", "tool2"],
    "artifacts_created": ["artifact1"],
    "key_findings": ["finding1", "finding2"]
  }
}
```

---

## Error Handling

### LLM Parse Errors
- Attempt direct JSON parse
- Sanitize control characters and retry
- Extract JSON object via regex
- Salvage `reasoning` field for user feedback
- Return raw response for debugging

### Tool Execution Errors
- Logged to console
- Returned in toolResults array
- Agent can react in next iteration

### Rate Limits
- 429 errors surface to user
- 402 (payment required) handled gracefully

---

## Synchronous Memory Refs

To prevent race conditions between iterations:

```typescript
// In useFreeAgentSession.ts
const blackboardRef = useRef<BlackboardEntry[]>([]);
const scratchpadRef = useRef<string>("");
const toolResultAttributesRef = useRef<Record<string, ToolResultAttribute>>({});
```

These refs are updated immediately on tool execution, ensuring the next iteration prompt always has current data (bypassing React state update delays).

---

## Configuration

### Environment Variables (Supabase Secrets)
- `GEMINI_API_KEY` - For Gemini models
- `ANTHROPIC_API_KEY` - For Claude models
- `XAI_API_KEY` - For Grok models
- `BRAVE_API_KEY` - For Brave Search
- `GOOGLE_SEARCH_API` / `GOOGLE_SEARCH_ENGINE` - For Google Search
- `GITHUB_TOKEN` - For GitHub operations
- `RESEND_API_KEY` - For email sending
- `ELEVENLABS_API_KEY` - For text-to-speech

### Tools Manifest

**`public/data/toolsManifest.json`**

Defines all available tools with:
- Display name and description
- Parameter schema
- Category grouping
- Icon assignment

---

## Best Practices

### For Users
1. Be specific in your prompt
2. Attach relevant files upfront
3. Use Continue to build on previous work
4. Check Raw tab when debugging issues

### For Agent Development
1. Always use `saveAs` for data-fetching tools
2. Write to blackboard every iteration
3. Summarize data, don't copy raw JSON
4. Check blackboard before re-executing tools
5. Use `read_attribute` to access saved results
