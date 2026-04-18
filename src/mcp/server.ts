/**
 * MCP Server Bootstrap
 *
 * Creates the StressMaster MCP server, initializes shared service context,
 * and registers all tools and resources.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ConfigManagementService } from "../services/config-management.service";
import { UnifiedCommandParser } from "../core/parser/command/parser";
import { K6ScriptGenerator } from "../core/generator/script-generator";
import { SmartLoadExecutor } from "../core/executor/smart-executor";
import { AIResultsAnalyzer } from "../core/analyzer/results-analyzer";
import { TemplateManagementService } from "../services/template-management.service";
import type { AIProvider } from "../core/parser/ai-providers";
import { ServiceContext, TestHistoryEntry } from "./types";
import {
  runLoadTest,
  parseCommand,
  generateK6Script,
  analyzeResults,
} from "./tools/load-test-tools";
import {
  getConfig,
  setConfig,
  listTemplates,
  manageTemplate,
} from "./tools/management-tools";
import { registerResources } from "./resources";

/**
 * Create and initialize the shared service context.
 * All services are instantiated and ready for tool handlers.
 */
export async function createServiceContext(): Promise<ServiceContext> {
  // Initialize configuration service
  const configService = new ConfigManagementService();
  await configService.initConfig();

  // Initialize parser (starts with configured AI provider or fallback)
  const parser = new UnifiedCommandParser({});
  await parser.initialize();

  // Initialize generator
  const generator = new K6ScriptGenerator();

  // Initialize executor
  const executor = new SmartLoadExecutor();

  // Initialize analyzer
  const analyzer = new AIResultsAnalyzer({
    ollamaEndpoint: "http://localhost:11434",
    modelName: "llama3",
    analysisTemplates: [],
    thresholds: {
      responseTime: { good: 200, acceptable: 1000, poor: 5000 },
      errorRate: { good: 0.01, acceptable: 0.05, poor: 0.1 },
      throughput: { minimum: 1, target: 10, excellent: 100 },
    },
  });

  // Initialize template service
  const templateService = new TemplateManagementService();

  // In-memory test history
  const testHistory: TestHistoryEntry[] = [];

  const ctx: ServiceContext & { _parserInstance: UnifiedCommandParser } = {
    _parserInstance: parser,
    parser: {
      parseCommand: parser.parseCommand.bind(parser),
      initialize: parser.initialize.bind(parser),
    },
    generator: {
      generateScript: (spec) => {
        const k6Script = generator.generateScript(spec);
        return {
          content: k6Script.content,
          filename: `${k6Script.name}.js`,
        };
      },
    },
    executor: {
      executeLoadTest: executor.executeLoadTest.bind(executor),
    },
    analyzer: {
      analyzeResults: analyzer.analyzeResults.bind(analyzer),
    },
    config: {
      getConfig: configService.getConfig.bind(configService),
      setConfig: configService.setConfig.bind(configService),
      initConfig: configService.initConfig.bind(configService),
    },
    templates: {
      listTemplates: templateService.listTemplates.bind(templateService),
      createTemplate: templateService.createTemplate.bind(templateService),
      loadTemplate: templateService.loadTemplate.bind(templateService),
      deleteTemplate: templateService.deleteTemplate.bind(templateService),
      exportTemplate: templateService.exportTemplate.bind(templateService),
    },
    history: {
      getEntries: () => testHistory,
      getEntry: (id: string) => testHistory.find((entry) => entry.id === id),
      addEntry: (entry: Omit<TestHistoryEntry, "id">) => {
        const newEntry: TestHistoryEntry = {
          ...entry,
          id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        };
        testHistory.push(newEntry);
      },
    },
  };

  return ctx;
}

/**
 * Inject the MCP sampling provider into the parser if the client supports it.
 * Call this after the server connects to a transport.
 */
export function enableSamplingIfAvailable(
  server: McpServer,
  parserInstance: UnifiedCommandParser
): void {
  try {
    const lowLevelServer = (server as any).server;
    const capabilities = lowLevelServer?._clientCapabilities;
    if (capabilities?.sampling) {
      const { McpSamplingProvider } = require("./sampling-provider");
      const samplingProvider = new McpSamplingProvider(lowLevelServer);
      samplingProvider.initialize();
      parserInstance.setAIProvider(samplingProvider);
      console.error(
        "[stressmaster-mcp] Using client AI session for parsing (no API key needed)"
      );
    }
  } catch {
    // Sampling not available — parser keeps its existing provider
  }
}

/**
 * Create and configure the MCP server with all tools and resources.
 * Returns the server and the parser instance (for sampling injection after connect).
 */
export async function createServer(): Promise<{
  server: McpServer;
  parser: UnifiedCommandParser;
}> {
  const server = new McpServer({
    name: "stressmaster",
    version: "1.0.0",
  });

  // Initialize shared service context
  const ctx = await createServiceContext();

  // Keep reference to parser for sampling injection
  const parserInstance = (ctx as any)._parserInstance as UnifiedCommandParser;

  // ─── Register Load Test Tools ────────────────────────────────────────────
  // Note: @ts-ignore on some tool registrations due to TS2589 deep type
  // instantiation with MCP SDK generics + zod. Runtime behavior is correct.

  // @ts-ignore TS2589
  server.tool(
    "run_load_test",
    "Run a load test using natural language or a structured spec",
    {
      command: z.string().optional().describe("Natural language command (e.g., 'send 100 GET requests to https://api.example.com/users')"),
      spec: z.any().optional().describe("Structured LoadTestSpec object"),
    },
    async (input) => {
      const result = await runLoadTest(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "parse_command",
    "Parse a natural language command into a LoadTestSpec",
    {
      command: z.string().describe("Natural language command to parse"),
    },
    async (input) => {
      const result = await parseCommand(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "generate_k6_script",
    "Generate a K6 load test script",
    {
      command: z.string().optional().describe("Natural language command (will be parsed first)"),
      spec: z.any().optional().describe("Structured LoadTestSpec object"),
    },
    async (input) => {
      const result = await generateK6Script(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // @ts-ignore TS2589
  server.tool(
    "analyze_results",
    "Analyze load test results with AI insights",
    {
      rawResults: z.any().describe("Raw test results to analyze"),
      spec: z.any().optional().describe("Optional LoadTestSpec for context"),
    },
    async (input) => {
      const result = await analyzeResults(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ─── Register Management Tools ───────────────────────────────────────────

  server.tool(
    "get_config",
    "Get StressMaster configuration",
    {
      key: z.string().optional().describe("Specific config key to retrieve"),
    },
    async (input) => {
      const result = await getConfig(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "set_config",
    "Update a StressMaster configuration value",
    {
      key: z.string().describe("Configuration key to set"),
      value: z.string().describe("Value to set"),
    },
    async (input) => {
      const result = await setConfig(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // @ts-ignore TS2589
  server.tool(
    "list_templates",
    "List all saved test templates",
    {},
    async (input) => {
      const result = await listTemplates(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // @ts-ignore TS2589
  server.tool(
    "manage_template",
    "Create, load, delete, or export test templates",
    {
      action: z.enum(["create", "load", "delete", "export"]).describe("Action to perform"),
      name: z.string().describe("Template name"),
      spec: z.any().optional().describe("LoadTestSpec for create action"),
      description: z.string().optional().describe("Description for create action"),
    },
    async (input) => {
      const result = await manageTemplate(input, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ─── Register Resources ──────────────────────────────────────────────────

  registerResources(server, ctx);

  return { server, parser: parserInstance };
}
