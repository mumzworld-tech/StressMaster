# StressMaster MCP Server

Expose StressMaster's AI-powered load testing capabilities to any MCP-compatible agent (Claude Code, Kiro, Codex, etc.) via the Model Context Protocol.

## Quick Start

Install:

```bash
npm install -g stressmaster
```

Add to Claude Code settings (`.claude/settings.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "stressmaster": {
      "command": "stressmaster-mcp",
      "env": {
        "AI_PROVIDER": "claude",
        "AI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or via npx (no global install):

```json
{
  "mcpServers": {
    "stressmaster": {
      "command": "npx",
      "args": ["-y", "stressmaster-mcp"],
      "env": {
        "AI_PROVIDER": "claude",
        "AI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Configuration

| Variable | Purpose | Values |
|----------|---------|--------|
| `AI_PROVIDER` | AI provider for NL parsing | `openai`, `claude`, `gemini`, `openrouter`, `amazonq` |
| `AI_API_KEY` | Provider API key | string |
| `AI_MODEL` | Model override (optional) | string |
| `AI_ENDPOINT` | Custom endpoint (optional) | URL |

## Available Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `run_load_test` | Run complete load test pipeline | `command` (NL) or `spec` (structured) |
| `parse_command` | Parse NL to LoadTestSpec | `command` |
| `generate_k6_script` | Generate K6 script without executing | `command` or `spec` |
| `analyze_results` | AI-powered result analysis | `rawResults` |
| `get_config` | Read configuration | optional `key` |
| `set_config` | Update configuration | `key`, `value` |
| `list_templates` | List test templates | (none) |
| `manage_template` | Manage templates (CRUD) | `action`, `name`, optional `spec` |

## Available Resources

| Resource URI | Description |
|-------------|-------------|
| `stressmaster://test-history` | All test executions in this session |
| `stressmaster://test-result/{id}` | Specific test result by ID |
| `stressmaster://templates` | All saved test templates |
| `stressmaster://template/{name}` | Specific template by name |
| `stressmaster://config` | Current StressMaster configuration |

## Usage Examples

```
# Via Claude Code
"Load test https://api.example.com/users with 100 concurrent users for 30 seconds"

# The agent will use the MCP tools:
# 1. parse_command -> verify spec
# 2. run_load_test -> execute
# 3. Present results
```

Generate a K6 script without running it:

```
# Ask the agent:
"Generate a K6 spike test script for https://api.example.com/products with 500 users"

# The agent calls generate_k6_script and returns the script for review
```

Analyze previous results with AI insights:

```
# After running a test, ask:
"Analyze the last load test results and suggest optimizations"

# The agent calls analyze_results with the raw metrics
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "K6 not found" | Install K6: `brew install k6` or `apt install k6` |
| "AI provider not configured" | Set `AI_PROVIDER` and `AI_API_KEY` env vars |
| "Permission denied" | Ensure `stressmaster-mcp` is executable (`chmod +x`) |
| Server not responding | Check `node dist/mcp/index.js` runs without errors |
| Rate limit errors | Configure a different AI provider or add your own API key |
