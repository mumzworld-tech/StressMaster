import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ServiceContext, RESOURCE_URIS } from "./types";

/**
 * Register MCP resources on the server.
 * Resources provide read-only views of StressMaster state (history, templates, config).
 */
export function registerResources(server: McpServer, ctx: ServiceContext): void {
  // 1. Test History List - all test executions
  server.resource(
    "test-history",
    RESOURCE_URIS.TEST_HISTORY,
    async (uri) => {
      try {
        const entries = ctx.history.getEntries();
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(entries, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Failed to retrieve test history: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );

  // 2. Test Result by ID - specific test execution
  server.resource(
    "test-result",
    new ResourceTemplate(RESOURCE_URIS.TEST_RESULT, { list: undefined }),
    async (uri, { id }) => {
      try {
        const entry = ctx.history.getEntry(id as string);
        if (!entry) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `Test result not found: ${id}`,
            }],
          };
        }
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(entry, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Failed to retrieve test result ${id}: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );

  // 3. Templates List - all saved test templates
  server.resource(
    "templates",
    RESOURCE_URIS.TEMPLATES,
    async (uri) => {
      try {
        const templates = await ctx.templates.listTemplates();
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(templates, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Failed to retrieve templates: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );

  // 4. Template by Name - specific template details
  server.resource(
    "template",
    new ResourceTemplate(RESOURCE_URIS.TEMPLATE, { list: undefined }),
    async (uri, { name }) => {
      try {
        const template = await ctx.templates.loadTemplate(name as string);
        if (!template) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `Template not found: ${name}`,
            }],
          };
        }
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(template, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Failed to load template ${name}: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );

  // 5. Current Config - StressMaster configuration
  server.resource(
    "config",
    RESOURCE_URIS.CONFIG,
    async (uri) => {
      try {
        const config = await ctx.config.getConfig();
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(config, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Failed to retrieve config: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );
}
