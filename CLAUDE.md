# StressMaster

AI-powered load testing CLI tool that converts natural language commands into K6 load test scripts. Built with TypeScript, Node.js.

## Project Documentation

@.claude/claude-md-refs/architecture.md
@.claude/claude-md-refs/development-guide.md
@.claude/claude-md-refs/exports-reference.md

## Quick Documentation Reference

| Need Help With | See File |
|----------------|----------|
| Adding features, commands, providers, sections | development-guide.md |
| Understanding system structure, flows, pipelines | architecture.md |
| Finding classes, services, hooks, types, exports | exports-reference.md |

## Project Overview

| Aspect | Details |
|--------|---------|
| **Name** | StressMaster (`stressmaster` / `sm` CLI aliases) |
| **Version** | 1.0.6 |
| **Language** | TypeScript (ES2022, CommonJS) |
| **Runtime** | Node.js >= 18 |
| **Package Manager** | npm (root CLI), pnpm (website) |
| **Test Framework** | Vitest |
| **Linting** | ESLint + TypeScript |
| **License** | MIT |

## Two Sub-Projects

| Sub-Project | Path | Stack | Purpose |
|-------------|------|-------|---------|
| CLI Tool | `/` (root) | TypeScript, Commander.js, K6, Docker | Load testing CLI |
| Website | `/website/` | Next.js 16, Tailwind v4, shadcn, Motion | Marketing landing page |

## Key Commands

```bash
# CLI Tool (root)
npm run build           # Compile TypeScript
npm run dev             # Run with tsx (hot reload)
npm test                # All tests (Vitest)
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run validate        # typecheck + lint + test
npm run lint            # ESLint check

# Website
cd website
pnpm dev                # Dev server (localhost:3000)
pnpm build              # Static export to out/
pnpm lint               # ESLint

# MCP Server
stressmaster-mcp            # Start MCP server (stdio transport)
```

## Architecture Summary

**CLI Flow:** User Input → Parser (AI/Fallback) → Orchestrator → Generator (K6 Script) → Executor (Smart Selection) → Analyzer → Display/Export

**MCP Server:** StressMaster CLI tools exposed as MCP tools (8 tools + 5 resources) via stdio transport for agent integration

**5 AI Providers:** OpenAI, Claude, Gemini, OpenRouter, Amazon Q (with fallback regex parser)

**5 Executors:** BasicHttp (simple), K6 (complex), Workflow (multi-step), Batch (batch files), EnhancedBatch

**7 Test Types:** spike, stress, endurance, volume, baseline, workflow, batch

## CI/CD

| Pipeline | Trigger | Action |
|----------|---------|--------|
| `release.yml` | Tag push `v*.*.*` | npm publish + GitHub Release |
| `deploy-website.yml` | Push to main/master (`website/**`) | Build + deploy to GitHub Pages |

**Regular pushes to master do NOT trigger npm release. Only version tags do.**

## Conventions

- **Imports:** Use `@/` path alias for both CLI (`src/*`) and website (`src/*`)
- **Components:** Use shadcn/ui components, not native HTML elements (Button not button, Heading not h1)
- **Website images:** Use `next/image` with `unoptimized`, prepend basePath in production
- **Website animations:** Use Motion (`motion/react`) for scroll reveals, anime.js for canvas effects
- **Services:** Suffix with `.service.ts`, classes with dependency injection via constructor
- **Commands:** Factory function pattern `createXCommands()` in `commands/` directory
- **Types:** Centralized in `src/types/`, exported via barrel `index.ts`
- **Tests:** Mirror src structure under `tests/unit/`, `tests/integration/`, `tests/e2e/`
- **Error handling:** Use `StressMasterError` from `features/common/error-utils.ts`

## Environment Variables (CLI Tool)

| Variable | Purpose | Values |
|----------|---------|--------|
| `AI_PROVIDER` | AI provider selection | openai, claude, gemini, openrouter, amazonq |
| `AI_API_KEY` | Provider API key | string |
| `AI_ENDPOINT` | Custom API endpoint (optional) | URL |
| `AI_MODEL` | Model override (optional) | string |
| `NODE_ENV` | Environment | development, production, test |

## Skills, Agents & Plugins

### Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| start | Every task | Mandatory workflow initialization |
| commit | "commit", "/commit" | Intelligent conventional commits |
| create-pr | "create PR", "/pr" | PR creation with validation |
| ast-grep | Code pattern search | AST-based structural code search |
| run-parallel-agents-feature-build | 3+ independent features | Parallel agent orchestration |
| run-parallel-agents-feature-debug | 3+ independent bugs | Parallel debug orchestration |
| update-claude-md-after-install | "update docs" | Project documentation sync |
| update-agent-learnings | Post-session | Propagate learnings to agents |
| update-skill-learnings | Post-session | Propagate skill insights |
| update-claude-learnings | Post-session | Update CLAUDE.md behaviors |
| plan-enhanced | Plan mode | Optimize plans for parallel execution |
| frontend-design | UI/UX design | Design specifications |
| frontend-design:frontend-design | Frontend code | Production-grade frontend |
| git-worktrees | Worktree management | Isolated branch work |
| ulpi-generate-hooks | ULPI hooks | Generate rules.yml |
| stressmaster | "load test", "stress test", "/stressmaster" | Run load tests via MCP tools |

### Agents

| Agent | Domain |
|-------|--------|
| nextjs-expert | Next.js, React, App Router |
| nodejs-senior-api-engineer | Node.js APIs, Express, NestJS |
| senior-product-manager | Requirements breakdown |
| Plan | Architecture planning |
| Explore | Codebase exploration |
| general-purpose | Multi-step research |

### Plugins (MCP)

| Plugin | Tools |
|--------|-------|
| Atlassian | Jira issues, Confluence pages, Rovo search |
