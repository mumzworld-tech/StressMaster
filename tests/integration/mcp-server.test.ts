/**
 * MCP Server Integration Tests
 *
 * Tests the full MCP server lifecycle: startup, tool listing,
 * resource listing, tool invocation, and shutdown.
 *
 * Prerequisites: `npm run build` must be run before these tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_TOOLS = [
  "run_load_test",
  "parse_command",
  "generate_k6_script",
  "analyze_results",
  "get_config",
  "set_config",
  "list_templates",
  "manage_template",
];

describe("MCP Server Integration", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: ["dist/mcp/index.js"],
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
  }, 30000);

  afterAll(async () => {
    try {
      await client.close();
    } catch {
      // Server may already be closed
    }
  });

  it("should connect to the MCP server", () => {
    // If beforeAll didn't throw, connection succeeded
    expect(client).toBeDefined();
  });

  it("should list all 8 tools", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);

    expect(result.tools).toHaveLength(8);
    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected);
    }
  });

  it("should have input schemas for all tools", async () => {
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("should list resources", async () => {
    // Static resources (non-template)
    const result = await client.listResources();
    expect(result.resources.length).toBeGreaterThanOrEqual(1);
  });

  it("should return config via get_config tool", async () => {
    const result = await client.callTool({
      name: "get_config",
      arguments: {},
    });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);

    const textContent = result.content[0];
    expect(textContent).toHaveProperty("type", "text");

    const parsed = JSON.parse((textContent as { type: "text"; text: string }).text);
    expect(parsed.success).toBe(true);
  });

  it("should return empty templates via list_templates tool", async () => {
    const result = await client.callTool({
      name: "list_templates",
      arguments: {},
    });

    const textContent = result.content[0];
    const parsed = JSON.parse((textContent as { type: "text"; text: string }).text);
    expect(parsed.success).toBe(true);
    expect(Array.isArray(parsed.data)).toBe(true);
  });

  it("should return error for parse_command with empty input", async () => {
    const result = await client.callTool({
      name: "parse_command",
      arguments: { command: "" },
    });

    const textContent = result.content[0];
    const parsed = JSON.parse((textContent as { type: "text"; text: string }).text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
  });

  it("should return error for manage_template with invalid action", async () => {
    const result = await client.callTool({
      name: "manage_template",
      arguments: { action: "create", name: "test" },
    });

    const textContent = result.content[0];
    const parsed = JSON.parse((textContent as { type: "text"; text: string }).text);
    // create without spec should fail
    expect(parsed.success).toBe(false);
  });
});
