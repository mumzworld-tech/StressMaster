# Plan: StressMaster MCP Server & Claude Code Skill

> Generated: 2026-04-18
> Branch: `feat/mcp-server-and-skill`
> Mode: HOLD

## Overview

Expose StressMaster's full load testing capabilities as an MCP (Model Context Protocol) server and a Claude Code skill. The MCP server wraps existing programmatic APIs (parser, generator, executor, analyzer, config, templates) as MCP tools and resources, allowing any MCP-compatible agent (Claude Code, Kiro, Codex, etc.) to run load tests programmatically. The skill provides a guided workflow for Claude Code users to invoke StressMaster from their coding sessions.

## Scope Challenge

**Considered and ruled out:**
- Building a separate npm package — adds maintenance burden with no benefit; single package is simpler
- Rewriting core APIs — all orchestration, parsing, generation, execution, and analysis already exist and are well-typed
- SSE transport — stdio is the standard for local MCP servers; SSE can be added later
- Prompt templates via MCP — not needed initially; the skill covers guided workflows

**Why HOLD mode:** The entire core API surface is reusable as-is. The new work is purely the MCP adapter layer (tools + resources + server bootstrap) and the skill file. No core logic changes needed.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                MCP Client (Claude Code / Kiro / etc) │
│                                                       │
│  Tools:                    Resources:                 │
│  ├─ run_load_test          ├─ test-history://list     │
│  ├─ parse_command          ├─ test-result://{id}      │
│  ├─ generate_k6_script     ├─ templates://list        │
│  ├─ analyze_results        ├─ template://{name}       │
│  ├─ list_templates         └─ config://current        │
│  ├─ manage_template                                   │
│  ├─ get_config                                        │
│  └─ set_config                                        │
└───────────────┬───────────────────────────────────────┘
                │ stdio (JSON-RPC)
                ▼
┌───────────────────────────────────────────────────────┐
│            src/mcp/server.ts  [TASK-006]               │
│            MCP Server (StdioServerTransport)           │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Tool Defs   │  │  Resource    │  │  Server      │ │
│  │  TASK-003/4  │  │  Providers   │  │  Bootstrap   │ │
│  │              │  │  TASK-005    │  │  TASK-006    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘ │
│         │                 │                            │
│         ▼                 ▼                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Existing StressMaster Core APIs          │   │
│  │  UnifiedCommandParser | K6ScriptGenerator        │   │
│  │  LoadTestWorkflowOrchestrator | AIResultsAnalyzer│   │
│  │  ConfigManagementService | TemplateManagement    │   │
│  │  ExecutorSelectionService | LoadTestHistoryMgr   │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  .claude/skills/stressmaster/SKILL.md    │
│  [TASK-009]                              │
│  Guides Claude Code users through:       │
│  - Running load tests via MCP tools      │
│  - Interpreting results                  │
│  - Generating K6 scripts for codebases   │
└──────────────────────────────────────────┘
```

## Existing Code Leverage

| Sub-problem | Existing Code | Action |
|------------|---------------|--------|
| NL command parsing | `src/core/parser/command/parser.ts` — `UnifiedCommandParser.parseCommand()` | Reuse as-is |
| K6 script generation | `src/core/generator/script-generator.ts` — `K6ScriptGenerator` | Reuse as-is |
| Load test execution | `src/core/orchestrator/load-test-orchestrator.ts` — `LoadTestWorkflowOrchestrator` | Reuse as-is |
| Results analysis | `src/core/analyzer/results-analyzer.ts` — `AIResultsAnalyzer` | Reuse as-is |
| Config management | `src/services/config-management.service.ts` — `ConfigManagementService` | Reuse as-is |
| Template management | `src/services/template-management.service.ts` — `TemplateManagementService` | Reuse as-is |
| Executor selection | `src/services/executor-selection.service.ts` — `ExecutorSelectionService` | Reuse as-is |
| Test history tracking | `src/interfaces/cli/load-test-history-manager.ts` — `LoadTestHistoryManager` | Reuse as-is |
| Type definitions | `src/types/` — `LoadTestSpec`, `TestResult`, `PerformanceMetrics`, etc. | Reuse as-is |
| MCP server framework | (none) | Build new |
| MCP tool handlers | (none) | Build new |
| MCP resource providers | (none) | Build new |
| Entry point + packaging | (none) | Build new |
| Claude Code skill | (none) | Build new |

## Tasks

### TASK-001: Create MCP types and shared interfaces

Define TypeScript interfaces for MCP tool input/output schemas that bridge MCP JSON schemas to existing StressMaster types. These types are the contract between the MCP layer and the core APIs.

Create `src/mcp/types.ts` with:
- Tool input schemas (matching MCP tool `inputSchema` definitions)
- Tool result wrappers (standardized success/error responses)
- Resource URI patterns as constants

Reference existing types from `src/types/common.ts` (`TestType`, `HttpMethod`, `LoadPatternType`), `src/types/load-test-spec.ts` (`LoadTestSpec`), and `src/types/test-result.ts` (`TestResult`, `AnalyzedResults`).

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] `src/mcp/types.ts` exports input/output interfaces for all 8 MCP tools
- [ ] Types reference existing StressMaster types (no duplication)
- [ ] Invalid tool inputs are representable as validation errors in the result type

**Agent:** nodejs-senior-api-engineer

**Priority:** P0

---

### TASK-002: Install MCP SDK and configure package.json

Add `@modelcontextprotocol/sdk` dependency and configure a new `stressmaster-mcp` binary entry point in `package.json`. Update `tsconfig.json` if needed to include the new `src/mcp/` directory (it's already covered by `src/**/*`).

Modify `package.json`:
- Add `@modelcontextprotocol/sdk` to `dependencies`
- Add `"stressmaster-mcp": "./dist/mcp/index.js"` to the `bin` field
- Add the `stressmaster-mcp` entry to `files` array if needed

**Type:** infra
**Effort:** S

**Acceptance Criteria:**
- [ ] `@modelcontextprotocol/sdk` installs without peer dependency conflicts
- [ ] `package.json` has `stressmaster-mcp` bin entry pointing to `dist/mcp/index.js`
- [ ] `npm run build` compiles `src/mcp/` files to `dist/mcp/` without errors

**Agent:** nodejs-senior-api-engineer

**Priority:** P0

---

### TASK-003: Implement core load testing MCP tools

Create `src/mcp/tools/load-test-tools.ts` with tool handler functions for the primary load testing workflow:

1. **`run_load_test`** — Takes natural language command OR structured `LoadTestSpec`, runs full pipeline (parse → generate → execute → analyze), returns `TestResult` with metrics
2. **`parse_command`** — Takes natural language string, returns parsed `LoadTestSpec` without executing
3. **`generate_k6_script`** — Takes `LoadTestSpec` or natural language, returns generated K6 JavaScript script content
4. **`analyze_results`** — Takes raw test results, returns `AnalyzedResults` with insights, bottlenecks, recommendations

Each tool handler:
- Uses the shared service context (created in TASK-006) to access pre-initialized services
- Validates input
- Calls the existing API method
- Returns structured result

Wire up (matching CLI pattern from `interactive-cli.ts`):
- `UnifiedCommandParser` from `src/core/parser/command/parser.ts` — requires `await initialize()` before first use
- `K6ScriptGenerator` from `src/core/generator/script-generator.ts` — no-arg constructor
- `SmartLoadExecutor` from `src/core/executor/smart-executor.ts` — no-arg constructor, routes to correct executor
- `AIResultsAnalyzer` from `src/core/analyzer/results-analyzer.ts` — requires `AnalyzerConfig`

**Note:** Do NOT use `LoadTestWorkflowOrchestrator` — it has a complex 4-dep constructor with background timers. The CLI uses the simpler direct pattern above.

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] All 4 tool handlers are exported as async functions with typed inputs/outputs
- [ ] `run_load_test` accepts both NL string and structured spec (auto-detects)
- [ ] Tool handlers return errors as structured error objects, never throw unhandled exceptions

**Agent:** nodejs-senior-api-engineer

**Depends on:** TASK-001
**Priority:** P1

---

### TASK-004: Implement config and template MCP tools

Create `src/mcp/tools/management-tools.ts` with tool handler functions for config and template management:

1. **`get_config`** — Returns current StressMaster configuration
2. **`set_config`** — Updates configuration key-value pairs
3. **`list_templates`** — Lists all saved test templates
4. **`manage_template`** — Create, load, delete, or export templates (action-based)

Wire up: `ConfigManagementService` from `src/services/config-management.service.ts`, `TemplateManagementService` from `src/services/template-management.service.ts`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] All 4 tool handlers are exported as async functions
- [ ] `set_config` validates keys against allowed config keys before writing
- [ ] `manage_template` with an invalid action name returns a structured error, not a crash

**Agent:** nodejs-senior-api-engineer

**Depends on:** TASK-001
**Priority:** P1

---

### TASK-005: Implement MCP resource providers

Create `src/mcp/resources.ts` with MCP resource definitions:

1. **`stressmaster://test-history`** — Lists all past test results (read from `.stressmaster/` directory)
2. **`stressmaster://test-result/{id}`** — Returns a specific test result by ID
3. **`stressmaster://templates`** — Lists available templates
4. **`stressmaster://template/{name}`** — Returns a specific template's content
5. **`stressmaster://config`** — Returns current configuration

Resources are read-only views into StressMaster state. Wire up: `LoadTestHistoryManager` from `src/interfaces/cli/load-test-history-manager.ts`, `TemplateManagementService`, `ConfigManagementService`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] All 5 resources are registered with proper URI templates
- [ ] Resources return JSON content with appropriate MIME types
- [ ] Requesting a non-existent test result ID returns a not-found error, not a crash

**Agent:** nodejs-senior-api-engineer

**Depends on:** TASK-001
**Priority:** P1

---

### TASK-006: Create MCP server bootstrap and entry point

Create `src/mcp/server.ts` (MCP server class) and `src/mcp/index.ts` (entry point with shebang):

`server.ts`:
- Create a shared service context that initializes all services once on startup:
  - `ConfigManagementService.initConfig()` to ensure `.stressmaster/` defaults exist
  - `UnifiedCommandParser` + `await initialize()` (one-time async init)
  - `K6ScriptGenerator` (no-arg constructor)
  - `SmartLoadExecutor` (no-arg constructor)
  - `AIResultsAnalyzer` (with config)
  - `TemplateManagementService` (for tools + resources to share)
  - `LoadTestHistoryManager` (for tools + resources to share)
- Instantiate `McpServer` from `@modelcontextprotocol/sdk`
- Register all tools from TASK-003 and TASK-004 with JSON Schema `inputSchema`, passing shared context
- Register all resources from TASK-005, passing shared context
- Set server info (name: "stressmaster", version from package.json)

`index.ts`:
- `#!/usr/bin/env node` shebang
- Load dotenv
- Create `StdioServerTransport`
- Connect server to transport
- Handle graceful shutdown (SIGINT, SIGTERM)

Follow the MCP SDK patterns: `server.tool(name, schema, handler)` for tools, `server.resource(template, handler)` for resources.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] `src/mcp/index.ts` starts the MCP server over stdio when executed
- [ ] All 8 tools and 5 resources are registered on server startup
- [ ] Server shuts down cleanly on SIGINT without orphan processes

**Agent:** nodejs-senior-api-engineer

**Depends on:** TASK-002, TASK-003, TASK-004, TASK-005
**Priority:** P1

---

### TASK-007: Add unit tests for MCP tools

Create `tests/unit/mcp/load-test-tools.test.ts`, `tests/unit/mcp/management-tools.test.ts`, and `tests/unit/mcp/resources.test.ts`:

Test each tool handler and resource provider in isolation by mocking the underlying services:
- Mock `UnifiedCommandParser`, `K6ScriptGenerator`, `SmartLoadExecutor`, `AIResultsAnalyzer`
- Mock `ConfigManagementService`, `TemplateManagementService`, `LoadTestHistoryManager`
- Test happy path (valid input → expected output)
- Test error path (invalid input → structured error)
- Test edge cases (empty inputs, missing optional fields, non-existent resource IDs)

Follow existing test patterns from `tests/unit/` — use Vitest, mock via `vi.mock()`.

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] Tests cover all 8 tool handlers (at least 2 tests per handler: success + error)
- [ ] Tests cover all 5 resource providers (at least 2 tests per resource: success + not-found/error)
- [ ] Tests mock external dependencies, never make real API calls
- [ ] All tests pass via `npm run test:unit`

**Agent:** nodejs-senior-api-engineer

**Depends on:** TASK-003, TASK-004, TASK-005
**Priority:** P2

---

### TASK-008: Add integration test for MCP server lifecycle

Create `tests/integration/mcp-server.test.ts`:

Test the full MCP server lifecycle:
1. Start the server as a child process via `node dist/mcp/index.js`
2. Send JSON-RPC `initialize` request
3. Verify `tools/list` returns all 8 tools
4. Verify `resources/list` returns all 5 resources
5. Send a `parse_command` tool call with a simple NL input
6. Verify structured `LoadTestSpec` response
7. Send shutdown

Use the MCP client SDK (`Client` from `@modelcontextprotocol/sdk/client`) to connect over stdio.

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] Integration test starts and stops the MCP server without hanging
- [ ] Tool listing returns all 8 tools with valid JSON Schemas
- [ ] `parse_command` tool call returns a valid `LoadTestSpec` shape (with mocked AI)

**Agent:** nodejs-senior-api-engineer

**Depends on:** TASK-006
**Priority:** P2

---

### TASK-009: Create Claude Code skill for StressMaster

Create `.claude/skills/stressmaster/SKILL.md`:

The skill teaches Claude Code agents how to use StressMaster's MCP tools effectively. Structure:

1. **When to Use** — User asks to load test, stress test, performance test, benchmark an API/endpoint
2. **Prerequisites** — StressMaster MCP server must be configured in Claude Code MCP settings
3. **Workflow:**
   - Step 1: Understand what the user wants to test (URL, method, payload, test type)
   - Step 2: Use `parse_command` tool to convert NL to LoadTestSpec (verify it looks right)
   - Step 3: Optionally use `generate_k6_script` to show the script before running
   - Step 4: Use `run_load_test` to execute
   - Step 5: Present results with key metrics (response times, throughput, error rate)
   - Step 6: Use `analyze_results` if deeper analysis is needed
4. **Tool Reference** — Quick reference for all 8 MCP tools with input/output schemas
5. **Examples** — 3-4 example interactions (basic GET test, POST with payload, spike test, batch test)

**Type:** docs
**Effort:** M

**Acceptance Criteria:**
- [ ] Skill file exists at `.claude/skills/stressmaster/SKILL.md` with proper frontmatter
- [ ] Workflow section covers the full test lifecycle (parse → generate → execute → analyze)
- [ ] Skill does NOT duplicate tool documentation — references MCP tool schemas instead

**Agent:** general-purpose

**Priority:** P1

---

### TASK-010: Add MCP configuration documentation and setup instructions

Create `src/mcp/README.md` with:

1. **Quick Start** — How to add StressMaster MCP to Claude Code settings (`claude_desktop_config.json` or `.claude/settings.json`)
2. **Configuration** — Environment variables needed (`AI_PROVIDER`, `AI_API_KEY`)
3. **Available Tools** — Table of all 8 tools with brief descriptions and example inputs
4. **Available Resources** — Table of all 5 resources with URI patterns
5. **Troubleshooting** — Common issues (missing K6 binary, no API key, permission errors)

Also update the root `README.md` with a new "MCP Server" section that links to the detailed docs.

**Type:** docs
**Effort:** S

**Acceptance Criteria:**
- [ ] `src/mcp/README.md` contains working example config for Claude Code MCP setup
- [ ] Root `README.md` has a new "MCP Server" section with usage summary
- [ ] Configuration example includes the correct binary path (`stressmaster-mcp`)

**Agent:** general-purpose

**Depends on:** TASK-006
**Priority:** P2

---

### TASK-011: Update CLAUDE.md with MCP and skill entries

Update the project's `CLAUDE.md` to include the new MCP server and skill in the appropriate sections:

- Add MCP server to the architecture summary
- Add `stressmaster` skill to the Skills table
- Add MCP binary to the Key Commands section
- Update the file count in Architecture section

Edit `CLAUDE.md` (do not rewrite — targeted edits only).

**Type:** chore
**Effort:** S

**Acceptance Criteria:**
- [ ] CLAUDE.md Skills table includes the `stressmaster` skill entry
- [ ] CLAUDE.md Key Commands section includes `stressmaster-mcp` binary
- [ ] No unrelated changes to CLAUDE.md

**Agent:** general-purpose

**Depends on:** TASK-009
**Priority:** P3

---

## Failure Modes

| Risk | Affected Tasks | Mitigation |
|------|---------------|------------|
| MCP SDK API mismatch (SDK version changes) | TASK-002, TASK-006 | Pin SDK version; use Context7 to fetch latest docs before implementing |
| Service instantiation failures (missing config/env vars) | TASK-003, TASK-004 | Tool handlers must catch and return structured errors; provide sensible defaults |
| Long-running `run_load_test` blocking stdio | TASK-003, TASK-006 | Document maximum expected runtime in tool description. For long tests, recommend users use `parse_command` + `generate_k6_script` to get the script, then run K6 directly via CLI |
| K6 binary not installed on user's system | TASK-003 | `run_load_test` should detect K6 absence and return a clear error message |
| `.stressmaster/` directory or AI config missing | TASK-003, TASK-005 | Service context (TASK-006) calls `ConfigManagementService.initConfig()` to ensure defaults exist before parser initialization. Parser falls back to regex if AI unavailable |
| Circular import between `src/mcp/` and `src/core/` | TASK-003, TASK-004 | MCP layer only imports from published exports (`src/index.ts`), never internal files |

## Test Coverage Map

| New Codepath | Covering Task | Test Type |
|-------------|--------------|-----------|
| MCP tool input validation | TASK-007 | unit |
| `run_load_test` tool handler (parse → execute → analyze) | TASK-007 | unit |
| `parse_command` tool handler | TASK-007 | unit |
| `generate_k6_script` tool handler | TASK-007 | unit |
| `analyze_results` tool handler | TASK-007 | unit |
| Config/template tool handlers | TASK-007 | unit |
| MCP server startup and tool registration | TASK-008 | integration |
| MCP JSON-RPC tool invocation over stdio | TASK-008 | integration |
| MCP resource listing and retrieval | TASK-008 | integration |

## Task Dependencies

```json
{
  "TASK-001": [],
  "TASK-002": [],
  "TASK-003": ["TASK-001"],
  "TASK-004": ["TASK-001"],
  "TASK-005": ["TASK-001"],
  "TASK-006": ["TASK-002", "TASK-003", "TASK-004", "TASK-005"],
  "TASK-007": ["TASK-003", "TASK-004", "TASK-005"],
  "TASK-008": ["TASK-006"],
  "TASK-009": [],
  "TASK-010": ["TASK-006"],
  "TASK-011": ["TASK-009"]
}
```
