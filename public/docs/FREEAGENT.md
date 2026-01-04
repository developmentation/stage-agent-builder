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

## Enhance Prompt Feature

The **Enhance Prompt** feature uses AI to transform a vague user request into a detailed, structured execution plan before the agent starts running.

### Purpose

- Convert informal requests into actionable step-by-step plans
- Identify which tools the agent should use at each phase
- Define clear success criteria and checkpoints
- Anticipate potential challenges
- Estimate the number of iterations needed

### How to Use

1. **Enter your task description** in the prompt textarea
2. **Click "Enhance Prompt"** (the wand icon button) above "Start Agent"
3. **Review the generated plan** in the modal that opens
4. **Choose a view**: 
   - **Preview**: Rendered markdown view of the plan
   - **Edit**: Raw text editor for manual modifications
5. **Refine (optional)**: Provide feedback and click "Refine" for AI improvement
6. **Accept**: Choose between:
   - **Accept**: Replace prompt and return to panel
   - **Accept & Start**: Replace prompt and immediately start the agent

### Enhancement Modal Features

| Feature | Description |
|---------|-------------|
| **Original Prompt** | Read-only display of your initial request |
| **Model Indicator** | Shows which AI model will generate the plan |
| **Preview Tab** | Formatted markdown rendering of the plan |
| **Edit Tab** | Raw text editor for manual changes |
| **Feedback Input** | Optional field to provide refinement instructions |
| **Refine Button** | Re-generates plan incorporating your feedback |
| **Start Over** | Regenerates from scratch |

### Generated Plan Structure

The enhanced prompt follows a consistent structure:

```markdown
## Goal
Clear restatement of what needs to be accomplished.

## Strategy  
High-level approach to solving the problem.

## Execution Plan

### Phase 1: [Name]
- **Tools**: [which tools to use]
- **Actions**: [specific steps]
- **Store**: [what to save to blackboard/scratchpad]
- **Expected Output**: [what this phase produces]

### Phase 2: [Name]
...

## Success Criteria
- [How to know the task is complete]
- [Quality checks to perform]

## Potential Challenges
- [Possible issues and how to handle them]

## Estimated Iterations: [number]
```

### Context Provided to Enhancement

The enhancement AI receives:
- Your original prompt
- Complete list of available tools with descriptions and parameters
- Metadata about uploaded files (names, types, sizes)
- The selected model's capabilities

### Iterative Refinement

You can refine the plan multiple times:

1. Review the generated plan
2. Identify areas that need improvement
3. Enter feedback like:
   - "Focus more on error handling"
   - "Add a verification step after data collection"
   - "Use brave_search instead of google_search"
   - "Include a step to save intermediate results"
4. Click "Refine" to regenerate with your feedback incorporated

### When to Use Enhance Prompt

**Recommended for:**
- Complex multi-step tasks
- Research and analysis projects
- Tasks requiring multiple tool integrations
- When you're unsure of the best approach
- Long-running autonomous sessions

**Skip for:**
- Simple single-tool operations
- Tasks you've done before with known steps
- Quick queries or lookups

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

## Customizable System Prompt

Free Agent supports full customization of the system prompt, allowing users to modify agent behavior, test different configurations, and create reusable prompt templates.

### Prompt Tab Overview

Access the Prompt tab in Free Agent view to see and modify:

1. **System Sections** - Core agent instructions (read-only)
2. **Customizable Sections** - Editable parts of the prompt
3. **Runtime Sections** - Dynamic placeholders populated at execution
4. **Tools** - Tool definitions with editable descriptions
5. **Response Schemas** - Provider-specific JSON schemas (view-only)

### Section Types

| Type | Badge Color | Editable | Description |
|------|-------------|----------|-------------|
| System | Red | No | Core agent identity and critical rules |
| Customizable | Blue | Yes | Workflow, anti-loop rules, data handling |
| Runtime | Purple | No | Dynamic placeholders ({{TOOLS_LIST}}, etc.) |
| Custom | Green | Yes | User-added sections |

### Editing Sections

For sections marked as "Customizable":

1. Click the **Edit** button on any customizable section
2. Modify the content in the textarea
3. Click **Save** to persist changes
4. Click **Reset** to restore original content

Changes are automatically saved to localStorage and persist across sessions.

**Visual Indicators:**
- **Modified** badge appears on edited sections
- **Reordered** badge shows sections moved from default position
- **Custom** badge identifies user-created sections

### Adding Custom Sections

1. Click **Add Section** at the top of the Prompt tab
2. Enter a unique title and description
3. Write your custom content
4. Click **Add Section** to save

Custom sections can be:
- Edited at any time
- Reordered using up/down arrows
- Deleted when no longer needed

### Reordering Sections

Use the up/down arrows on any section to change its position in the prompt. This affects the order in which instructions appear to the LLM.

- System sections can be moved relative to each other
- Custom sections can be placed anywhere in the order
- Original order can be restored with Reset All

### Runtime Sections (Dynamic Placeholders)

These read-only sections show where dynamic content is injected at execution time:

| Placeholder | Description |
|-------------|-------------|
| `{{TOOLS_LIST}}` | Available tools formatted for the LLM |
| `{{SESSION_FILES}}` | List of attached files |
| `{{BLACKBOARD_CONTENT}}` | Current planning journal entries |
| `{{SCRATCHPAD_CONTENT}}` | Current scratchpad data |
| `{{PREVIOUS_RESULTS}}` | Tool results from last iteration |
| `{{ASSISTANCE_RESPONSE}}` | User response to assistance request |

These placeholders help you understand where runtime data appears in the final prompt sent to the LLM.

### Tools Tab

The Tools tab displays all available tools organized by category:

**Features:**
- Search/filter tools by name
- View tool parameters, types, and requirements
- See edge function or frontend handler mapping
- Edit tool descriptions to customize LLM behavior

**Editing Tool Descriptions:**

1. Click **Edit** on any tool
2. Modify the description
3. Click **Save** to persist

Custom descriptions appear in `{{TOOLS_LIST}}` and help guide the LLM's understanding of when and how to use each tool.

**Tool Categories:**
- Memory (read/write blackboard, scratchpad, attributes)
- Web (search, scrape)
- Code (GitHub operations)
- File (read files, ZIP handling)
- Document (PDF, OCR)
- Utility (time, weather)
- Communication (email, assistance)
- Export (Word, PDF generation)
- API (HTTP calls, SQL)

Tools can belong to multiple categories for easier discovery.

### Response Schemas Tab

View the JSON schemas used to enforce structured responses from each LLM provider:

- **Gemini**: Uses `responseMimeType: "application/json"` with schema
- **Claude**: Uses forced tool call with `respond_with_actions` tool
- **Grok**: Uses OpenAI-compatible `response_format`

These schemas ensure consistent response structure across providers and cannot be edited.

### Export/Import Templates

**Exporting:**
1. Click the **Export** button in the Prompt tab header
2. A JSON file downloads containing:
   - All section customizations
   - Custom sections you've added
   - Order overrides
   - Tool description overrides

**Importing:**
1. Click the **Import** button
2. Select a previously exported JSON file
3. All customizations are restored

**Export Format (v1.0):**
```json
{
  "formatVersion": "1.0",
  "exportedAt": "2026-01-04T...",
  "template": {
    "id": "freeagent-default",
    "name": "FreeAgent Default",
    "sections": [...],
    "responseSchemas": [...],
    "tools": [...]
  },
  "customizations": {
    "sectionOverrides": {
      "section_id": "custom content..."
    },
    "additionalSections": [
      {
        "id": "custom_1",
        "title": "My Custom Rules",
        "content": "...",
        "order": 5.5
      }
    ],
    "orderOverrides": {
      "section_id": 3.5
    },
    "toolOverrides": {
      "brave_search": {
        "description": "Custom search behavior..."
      }
    }
  }
}
```

### Reset Options

- **Reset Section**: Restore individual section to default
- **Reset All**: Clear all customizations and restore factory defaults

### Use Cases

**Testing Different Prompting Strategies:**
- Modify anti-loop rules to test different behaviors
- Add custom sections with specific constraints
- Change tool descriptions to encourage certain patterns

**Creating Specialized Agents:**
- Export a base configuration
- Create variations for different tasks (research, coding, writing)
- Import the appropriate template before running

**Debugging Agent Behavior:**
- View the Raw tab to see the assembled prompt
- Compare against your customizations
- Identify which instructions affect behavior

**Sharing Configurations:**
- Export your optimized template
- Share JSON file with team members
- Import to replicate exact agent behavior

---

## Best Practices

### For Users
1. Be specific in your prompt
2. Attach relevant files upfront
3. Use Continue to build on previous work
4. Check Raw tab when debugging issues
5. Export templates before making major changes
6. Use custom sections for task-specific instructions

### For Agent Development
1. Always use `saveAs` for data-fetching tools
2. Write to blackboard every iteration
3. Summarize data, don't copy raw JSON
4. Check blackboard before re-executing tools
5. Use `read_attribute` to access saved results
6. Test prompt changes with small iterations first

### For Prompt Customization
1. Start with small edits to customizable sections
2. Use the Raw tab to verify changes appear correctly
3. Export working configurations before experimenting
4. Add custom sections for new behaviors rather than modifying core sections
5. Use descriptive titles for custom sections
6. Document your changes in section descriptions
