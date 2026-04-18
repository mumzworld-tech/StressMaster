#!/usr/bin/env node
/**
 * MCP Server Entry Point
 *
 * Starts the StressMaster MCP server using stdio transport.
 * Handles graceful shutdown on SIGINT/SIGTERM.
 */

import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

async function main() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
