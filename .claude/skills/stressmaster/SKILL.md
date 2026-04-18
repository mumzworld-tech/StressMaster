# StressMaster — AI-Powered Load Testing

## When to Use This Skill

Activate this skill when:

- User asks to "load test", "stress test", "performance test", or "benchmark" an API or endpoint
- User says "test my API", "how fast is this endpoint", "check response times"
- User wants to generate K6 scripts for their codebase
- User says "/stressmaster" or "use stressmaster"
- User asks about spike tests, endurance tests, volume tests, or baseline tests against a URL
- User wants to analyze or compare load test results

## Overview

StressMaster is an AI-powered load testing CLI exposed as an MCP server. It converts natural language commands into K6 load test scripts, executes them, and provides AI-powered analysis of the results. This skill teaches you how to use the 8 MCP tools and 5 MCP resources to run load tests directly from a Claude Code session.

The typical flow is: **Parse** (natural language to test spec) -> **Generate** (K6 script) -> **Execute** (run the test) -> **Analyze** (AI-powered insights).

## Prerequisites

The StressMaster MCP server must be configured in your Claude Code settings. Add the following to your MCP server configuration:

**Using npx (recommended):**

```json
{
  "mcpServers": {
    "stressmaster": {
      "command": "npx",
      "args": ["stressmaster-mcp"],
      "env": {
        "AI_PROVIDER": "claude",
        "AI_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Using a global install:**

```json
{
  "mcpServers": {
    "stressmaster": {
      "command": "stressmaster-mcp",
      "env": {
        "AI_PROVIDER": "claude",
        "AI_API_KEY": "your-api-key"
      }
    }
  }
}
```

Supported `AI_PROVIDER` values: `openai`, `claude`, `gemini`, `openrouter`, `amazonq`.

K6 must be installed on the system for complex test execution. Simple HTTP tests run via Node.js and do not require K6.

## Workflow

Follow these 6 steps for every load testing request.

### Step 1: Understand

Ask the user what they want to test. Gather:

- **Target URL** (required) — the endpoint to test
- **HTTP method** — GET, POST, PUT, DELETE, etc. (default: GET)
- **Request payload** — JSON body for POST/PUT requests
- **Headers** — any custom headers (auth tokens, content-type, etc.)
- **Test type** — stress, spike, endurance, volume, baseline (default: stress)
- **Virtual users (VUs)** — concurrent users to simulate
- **Duration** — how long to run the test

If the user provides a natural language command that already contains this information, proceed directly to Step 2.

### Step 2: Parse

Use `mcp__stressmaster__parse_command` to convert the natural language request into a structured `LoadTestSpec`.

```
Tool: mcp__stressmaster__parse_command
Input: { "command": "stress test https://api.example.com/users with 50 VUs for 30 seconds" }
```

**Always show the parsed spec to the user for confirmation before executing.** Display the target URL, method, VU count, duration, and test type clearly.

### Step 3: Preview Script (optional)

If the user wants to see the K6 script before running, or if the test configuration is complex, use `mcp__stressmaster__generate_k6_script`:

```
Tool: mcp__stressmaster__generate_k6_script
Input: { "command": "stress test https://api.example.com/users with 50 VUs for 30 seconds" }
```

This returns the generated K6 JavaScript code. Share it with the user if requested.

### Step 4: Execute

After the user confirms the spec, use `mcp__stressmaster__run_load_test` to execute the test:

```
Tool: mcp__stressmaster__run_load_test
Input: { "command": "stress test https://api.example.com/users with 50 VUs for 30 seconds" }
```

You can also pass a structured `spec` object instead of a `command` string if you already have the parsed LoadTestSpec from Step 2.

### Step 5: Present Results

Display the key metrics from the test results as a concise table. Never dump raw JSON. Format the results like this:

| Metric | Value |
|--------|-------|
| **Total Requests** | 12,450 |
| **Avg Response Time** | 145 ms |
| **P95 Response Time** | 320 ms |
| **P99 Response Time** | 512 ms |
| **Throughput** | 415.0 req/s |
| **Error Rate** | 0.24% |
| **Success Rate** | 99.76% |

Highlight any concerning metrics (high error rates, slow p99, degraded throughput).

### Step 6: Deep Analysis (if needed)

If the user wants deeper insights, or if the results show concerning patterns, use `mcp__stressmaster__analyze_results`:

```
Tool: mcp__stressmaster__analyze_results
Input: { "rawResults": <results from Step 4> }
```

This provides AI-powered analysis including:
- Bottleneck detection
- Performance trend analysis
- Actionable recommendations
- Comparison against industry benchmarks

## Tool Reference

| Tool | Purpose | Key Input |
|------|---------|-----------|
| `mcp__stressmaster__run_load_test` | Full test pipeline (parse -> execute -> analyze) | `command` (NL string) or `spec` (structured LoadTestSpec) |
| `mcp__stressmaster__parse_command` | Convert natural language to LoadTestSpec | `command` (NL string) |
| `mcp__stressmaster__generate_k6_script` | Generate K6 JavaScript script without executing | `command` (NL string) or `spec` (structured LoadTestSpec) |
| `mcp__stressmaster__analyze_results` | AI-powered analysis of test results | `rawResults` from a test run |
| `mcp__stressmaster__get_config` | Read current StressMaster configuration | optional `key` to read a specific setting |
| `mcp__stressmaster__set_config` | Update a configuration key | `key` and `value` |
| `mcp__stressmaster__list_templates` | List all saved test templates | (none) |
| `mcp__stressmaster__manage_template` | Create, load, delete, or export a template | `action` (create/load/delete/export), `name`, optional `spec` |

## Resource Reference

| Resource URI | Purpose |
|--------------|---------|
| `stressmaster://test-history` | List all past test results with timestamps and summary metrics |
| `stressmaster://test-result/{id}` | Get the full details of a specific test result by ID |
| `stressmaster://templates` | List all saved test templates |
| `stressmaster://template/{name}` | Get a specific template by name, including its full spec |
| `stressmaster://config` | Current StressMaster configuration (provider, model, defaults) |

Use resources to retrieve historical data and templates. For example, read `stressmaster://test-history` to help the user compare current results against past runs.

## Examples

### Example 1: Basic GET Load Test

**User:** "Load test my users API at https://api.example.com/users with 50 concurrent users for 30 seconds"

**Steps:**

1. Parse the command:
   ```
   Tool: mcp__stressmaster__parse_command
   Input: { "command": "load test https://api.example.com/users with 50 concurrent users for 30 seconds" }
   ```

2. Show the parsed spec to the user:
   - URL: `https://api.example.com/users`
   - Method: GET
   - VUs: 50
   - Duration: 30s
   - Type: stress

3. After confirmation, execute:
   ```
   Tool: mcp__stressmaster__run_load_test
   Input: { "command": "load test https://api.example.com/users with 50 concurrent users for 30 seconds" }
   ```

4. Present results as a formatted metrics table.

### Example 2: POST with JSON Payload

**User:** "Stress test POST https://api.example.com/orders with JSON body {\"item\": \"widget\", \"qty\": 1} -- 100 VUs, 2 minutes"

**Steps:**

1. Parse first to validate the spec includes the correct payload:
   ```
   Tool: mcp__stressmaster__parse_command
   Input: { "command": "stress test POST https://api.example.com/orders with body {\"item\": \"widget\", \"qty\": 1} 100 VUs for 2 minutes" }
   ```

2. Show the parsed spec. Verify:
   - URL: `https://api.example.com/orders`
   - Method: POST
   - Body: `{"item": "widget", "qty": 1}`
   - VUs: 100
   - Duration: 2m

3. After confirmation, execute with `mcp__stressmaster__run_load_test`.

4. Present results. If error rate is high, run `mcp__stressmaster__analyze_results` for deeper analysis.

### Example 3: Spike Test

**User:** "Run a spike test against https://api.example.com/search -- ramp from 10 to 500 users in 10 seconds"

**Steps:**

1. Execute directly since the command is clear:
   ```
   Tool: mcp__stressmaster__run_load_test
   Input: { "command": "spike test https://api.example.com/search ramp from 10 to 500 users in 10 seconds" }
   ```

2. Present results with emphasis on how the system handled the sudden spike -- look for error rate increases, response time degradation at peak load, and recovery behavior.

3. Use `mcp__stressmaster__analyze_results` to get AI insights on system resilience under spike conditions.

### Example 4: Generate K6 Script Only

**User:** "Generate a K6 script for testing my checkout API but don't run it"

**Steps:**

1. Clarify the endpoint details (URL, method, payload, VUs, duration).

2. Generate the script:
   ```
   Tool: mcp__stressmaster__generate_k6_script
   Input: { "command": "stress test POST https://api.example.com/checkout with 200 VUs for 5 minutes" }
   ```

3. Return the K6 JavaScript code to the user. They can save it to a file and run it manually with `k6 run script.js`.

## Important Rules

- **NEVER run a load test without confirming the target URL with the user.** A load test sends real traffic to the target. Running against the wrong URL (especially production) can cause outages.
- **Always show the parsed spec before executing.** Users must verify the URL, HTTP method, VU count, and duration before the test starts.
- **Present results as a concise table, not raw JSON.** Format metrics for readability.
- **If a test fails, suggest checking:** K6 installation (`k6 version`), network connectivity to the target, target URL validity and accessibility, and firewall/proxy settings.
- **Tool names follow MCP naming:** all tools are prefixed with `mcp__stressmaster__` (e.g., `mcp__stressmaster__run_load_test`).
- **For repeated tests,** suggest saving as a template with `mcp__stressmaster__manage_template` so the user can rerun without re-specifying parameters.
- **For comparing runs,** read `stressmaster://test-history` to retrieve past results and present a comparison table.
