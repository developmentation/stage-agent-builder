# AI Agent Workbench

A powerful visual interface for building AI workflows and running autonomous AI agents with advanced memory systems, tool orchestration, and multi-model support.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)

## Overview

AI Agent Workbench provides two distinct modes for AI-powered task execution:

- **Workflow Mode**: Visual canvas for building multi-stage AI pipelines with drag-and-drop nodes
- **Free Agent Mode**: Fully autonomous AI agent with sophisticated memory architecture, 25+ integrated tools, and advanced orchestration capabilities

---

## Table of Contents

- [Features](#features)
- [Free Agent Mode](#free-agent-mode)
  - [Memory Architecture](#memory-architecture)
  - [Tool System](#tool-system)
  - [Reference Resolution](#reference-resolution)
  - [Advanced Features](#advanced-features)
  - [Session Controls](#session-controls)
  - [Prompt Customization](#prompt-customization)
  - [Loop Detection & Prevention](#loop-detection--prevention)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Project Structure](#project-structure)

---

## Features

### Workflow Mode
- Visual canvas for building multi-stage AI pipelines
- Drag-and-drop nodes (Agents, Functions, Tools, Notes)
- Stage-based execution flow with parallel processing
- Multiple view modes (stacked, canvas, simple)
- Real-time execution monitoring

### Free Agent Mode
- Fully autonomous task execution (1-200 iterations)
- Multi-model support: Gemini 2.5/3.x, Claude 4.5, Grok 4.1
- Interactive canvas visualization of agent execution
- Persistent memory across iterations
- File upload support with text extraction

---

## Free Agent Mode

### Memory Architecture

The Free Agent uses a three-tier memory system:

```
┌─────────────────────────────────────────────────────────────┐
│                      MEMORY SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   BLACKBOARD    │  │   SCRATCHPAD    │  │ ATTRIBUTES  │ │
│  │                 │  │                 │  │             │ │
│  │ • Observations  │  │ • Working data  │  │ • Tool      │ │
│  │ • Insights      │  │ • Long content  │  │   results   │ │
│  │ • Plans         │  │ • Summaries     │  │ • Named     │ │
│  │ • Decisions     │  │ • Extracted     │  │   storage   │ │
│  │ • Errors        │  │   information   │  │ • Reusable  │ │
│  │ • Artifacts     │  │                 │  │   data      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Blackboard
Categorized entries tracking agent reasoning and progress:
- **observation**: Facts discovered during execution
- **insight**: Conclusions drawn from observations
- **plan**: Strategic decisions about next steps
- **decision**: Choices made during execution
- **error**: Problems encountered and how they were handled
- **artifact**: Created outputs (documents, code, etc.)
- **question**: Queries requiring user input
- **user_interjection**: User-injected guidance

All entries are prefixed with `[#N category]` for iteration tracking.

#### Scratchpad
Persistent working memory for long-form content:
- Data summaries and extracted information
- Intermediate results between tool calls
- Content too large for blackboard entries

#### Named Attributes
Tool results saved with the `saveAs` parameter:
- Automatically stored and referenced via `{{attribute:name}}`
- Displayed as nodes on the canvas
- Persist across iterations for later use

#### Auto-Logged Entries
When the agent provides missing or poor blackboard updates, the system auto-generates entries:
- Prefixed with `[AUTO-LOGGED #N]`
- Contains artifact count/names, tool call count/names, scratchpad changes
- Prevents context loss during execution

---

### Tool System

25+ integrated edge functions organized by category:

#### Web Tools
| Tool | Description |
|------|-------------|
| `brave_search` | Web search via Brave Search API |
| `google_search` | Web search via Google Custom Search |
| `web_scrape` | Extract content from web pages |

#### Code & Repository Tools
| Tool | Description |
|------|-------------|
| `read_github_repo` | List repository structure |
| `read_github_file` | Read file contents from GitHub |

#### API Tools
| Tool | Description |
|------|-------------|
| `get_call_api` | HTTP GET requests to external APIs |
| `post_call_api` | HTTP POST requests to external APIs |

#### Document Processing
| Tool | Description |
|------|-------------|
| `pdf_info` | Extract PDF metadata |
| `pdf_extract_text` | Extract text from PDF pages |
| `ocr_image` | OCR text extraction from images |

#### File Tools
| Tool | Description |
|------|-------------|
| `read_zip_contents` | List ZIP archive contents |
| `read_zip_file` | Extract specific file from ZIP |
| `extract_zip_files` | Extract multiple files from ZIP |

#### Utility Tools
| Tool | Description |
|------|-------------|
| `get_time` | Get current time for any timezone |
| `get_weather` | Weather data for any location |

#### Reasoning Tools
| Tool | Description |
|------|-------------|
| `think` | Extended thinking/reasoning space |
| `summarize` | AI-powered summarization |
| `analyze` | Deep analysis of content |

#### Database Tools
| Tool | Description |
|------|-------------|
| `execute_sql` | Execute SQL queries |
| `read_database_schemas` | Inspect database structure |

#### Export Tools
| Tool | Description |
|------|-------------|
| `export_word` | Generate Word documents |
| `export_pdf` | Generate PDF documents |

#### Communication Tools
| Tool | Description |
|------|-------------|
| `send_email` | Send emails via configured provider |
| `elevenlabs_tts` | Text-to-speech generation |

#### Memory Tools
| Tool | Description |
|------|-------------|
| `read_blackboard` | Read current blackboard entries |
| `write_blackboard` | Add entry to blackboard |
| `read_scratchpad` | Read scratchpad content |
| `write_scratchpad` | Update scratchpad content |
| `read_attribute` | Read named attribute value |
| `read_prompt` | Read user's original prompt |
| `read_prompt_files` | Read uploaded file contents |
| `request_assistance` | Pause and request user input |

---

### Reference Resolution

Pass large data to tools using placeholders instead of copying content:

| Placeholder | Description |
|-------------|-------------|
| `{{scratchpad}}` | Full scratchpad content |
| `{{blackboard}}` | Formatted blackboard entries |
| `{{attribute:name}}` | Specific named attribute |
| `{{attributes}}` | All attributes as JSON |
| `{{artifact:id}}` | Specific artifact content |
| `{{artifacts}}` | All artifacts as JSON |

**Example:**
```json
{
  "tool": "summarize",
  "parameters": {
    "content": "{{attribute:extracted_data}}",
    "context": "{{blackboard}}"
  }
}
```

---

### Advanced Features

#### Self-Author Mode
When enabled, the agent can modify its own system prompt:

- **`read_self`**: Inspect current prompt configuration
- **`write_self`**: Modify sections, add/delete custom sections, toggle tools

Supports:
- `sectionOverrides`: Modify existing section content
- `addSections`: Create new custom sections
- `deleteSections`: Remove custom sections
- Tool enable/disable toggles

#### Spawn Children (Parallel Execution)
Create child agent instances for parallel task processing:

```
┌──────────────────────────────────────────────────────────┐
│                    PARENT AGENT                          │
│                   (Orchestrator)                         │
└────────────────────────┬─────────────────────────────────┘
                         │ spawn
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ Child 1 │    │ Child 2 │    │ Child 3 │
    │ Task A  │    │ Task B  │    │ Task C  │
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │ merge
                         ▼
              ┌──────────────────────┐
              │ MERGED MEMORY        │
              │ • Prefixed blackboard│
              │ • Combined attributes│
              │ • Scratchpad updates │
              └──────────────────────┘
```

Configuration:
- **Max Children**: 1-100 concurrent child agents
- **Child Max Iterations**: Iteration limit per child
- Children inherit full system prompt with task injection
- Memory automatically merges back to parent on completion

---

### Session Controls

| Control | Description |
|---------|-------------|
| **Start** | Begin agent execution |
| **Stop** | Immediately halt execution |
| **Reset** | Clear status but preserve prompt |
| **Clear** | Reset everything including memory |
| **Continue** | Resume with new prompt, preserving memory |
| **Interject** | Inject guidance mid-execution |
| **Retry** | Auto-retry failed iterations (up to 3x) |

---

### Prompt Customization

Full control over the agent's system prompt:

#### Section Management
- Edit any prompt section content
- Add custom sections with unique IDs
- Delete custom sections
- Reorder sections via drag-and-drop
- Enable/disable individual sections

#### Tool Customization
- Override tool descriptions
- Enable/disable individual tools
- Tools removed from prompt when disabled

#### Import/Export
- Export configurations as JSON
- Import to restore customizations
- Share configurations between projects

#### Enhance Prompt (AI Planning)
AI-powered task planning before execution:
1. Submit your task to the enhancement modal
2. AI generates structured execution plan with phases
3. Refine iteratively with feedback
4. Apply enhanced prompt to agent

#### Reflect (Post-Session Analysis)
AI analysis after session completion:
- Identifies successes and failures
- Analyzes root causes of issues
- Generates optimization recommendations
- Provides rewritten prompt suggestions
- Downloadable as Markdown

---

### Loop Detection & Prevention

Multiple mechanisms prevent agent loops:

1. **Iteration Prefixing**: All blackboard entries tagged with `[#N category]`
2. **Duplicate Detection**: Compares last 5 entries for repetition
3. **Auto-Generated Summaries**: Forces progress tracking when agent fails to update
4. **Loop Warnings**: Injects prominent warnings into system prompt when loops detected
5. **{{CURRENT_ITERATION}}** variable: Agent always knows current iteration number

---

### Secrets Management

Secure handling of API keys and credentials:

- **Session Storage**: Secrets never persist to disk
- **Per-Tool Mapping**: Map secrets to specific tool parameters
- **Custom Headers**: Add authentication headers to API calls
- **Import Options**: JSON or .env file parsing
- **Export Options**: Optional value inclusion for portability

---

## Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** + **shadcn/ui** components
- **React Flow** for canvas visualization
- **React Query** for data management

### Backend (Lovable Cloud)
- **Supabase Edge Functions** for all backend logic
- Multi-provider LLM integration (Gemini, Claude, Grok)
- Structured JSON response enforcement per provider

### System Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend  │────▶│  free-agent      │────▶│   LLM Provider  │
│   React App │◀────│  Edge Function   │◀────│  (Gemini/Claude)│
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                    │
       │                    ▼
       │            ┌──────────────────┐
       │            │   Tool Edge      │
       │            │   Functions      │
       │            │   (25+ tools)    │
       │            └──────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│            Canvas Visualization         │
│  • Agent nodes    • Tool nodes          │
│  • Artifact nodes • Connection edges    │
│  • Child agents   • Status indicators   │
└─────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or bun

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables
Managed automatically by Lovable Cloud. No manual configuration required for basic usage.

---

## Configuration

### System Prompt Template
`public/data/systemPromptTemplate.json`

Defines all prompt sections, their editability status, and default content.

### Tools Manifest
`public/data/toolsManifest.json`

Complete tool definitions including:
- Tool names and descriptions
- Parameter schemas with types
- Return value specifications
- Category assignments

---

## Project Structure

```
src/
├── components/
│   ├── freeAgent/           # Free Agent UI components
│   │   ├── FreeAgentView.tsx
│   │   ├── FreeAgentPanel.tsx
│   │   ├── FreeAgentCanvas.tsx
│   │   ├── BlackboardViewer.tsx
│   │   ├── ArtifactsPanel.tsx
│   │   ├── SystemPromptViewer.tsx
│   │   └── ... (20+ components)
│   ├── workflow/            # Workflow mode components
│   └── ui/                  # shadcn/ui components
├── hooks/
│   ├── useFreeAgentSession.ts    # Core session logic (1800+ lines)
│   ├── useSecretsManager.ts      # Secrets handling
│   └── usePromptCustomization.ts # Prompt customization
├── lib/
│   ├── freeAgentToolExecutor.ts  # Frontend tool execution
│   ├── referenceResolver.ts      # Reference placeholder resolution
│   └── systemPromptBuilder.ts    # Prompt data construction
├── types/
│   ├── freeAgent.ts              # Free Agent TypeScript types
│   └── systemPrompt.ts           # System prompt types
└── pages/
    └── Index.tsx                 # Main app with mode toggle

supabase/functions/
├── free-agent/          # Main agent orchestration
├── enhance-prompt/      # AI planning
├── brave-search/        # Web search
├── google-search/       # Google search
├── web-scrape/          # Page scraping
├── github-fetch/        # GitHub integration
├── api-call/            # External API calls
├── tool_pdf-handler/    # PDF processing
├── tool_ocr-handler/    # OCR
├── tool_zip-handler/    # ZIP handling
├── tool_weather/        # Weather data
├── time/                # Time data
├── external-db/         # Database queries
├── send-email/          # Email sending
├── elevenlabs-tts/      # Text-to-speech
└── ...

public/
├── data/
│   ├── systemPromptTemplate.json  # Prompt configuration
│   ├── toolsManifest.json         # Tool definitions
│   └── freeAgentInstructions.json # Agent instructions
└── docs/
    └── FREEAGENT.md               # Detailed documentation
```

---

## Technologies Used

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui |
| **Visualization** | React Flow, Recharts |
| **State** | React Query, React Hooks |
| **Backend** | Supabase Edge Functions (Deno) |
| **AI Models** | Gemini 2.5/3.x, Claude 4.5, Grok 4.1 |
| **File Processing** | PDF.js, Mammoth, ExcelJS, JSZip |

---

## Documentation

For detailed Free Agent documentation, see:
- [`public/docs/FREEAGENT.md`](public/docs/FREEAGENT.md) - Comprehensive feature documentation

---

## License

This project is built with [Lovable](https://lovable.dev).
