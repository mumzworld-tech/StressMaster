#!/usr/bin/env node
/**
 * MCP Server Entry Point
 *
 * Starts the StressMaster MCP server using stdio transport.
 * After connection, enables MCP sampling if the client supports it —
 * this lets users of Claude Code, Kiro, Codex, etc. use AI parsing
 * without needing their own API key.
 */

import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, enableSamplingIfAvailable } from "./server";

async function main() {
  const { server, parser } = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // After connection, try to use client's AI session for parsing
  // Fallback chain: MCP sampling → configured API key → regex fallback
  enableSamplingIfAvailable(server, parser);

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await server.close();
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
