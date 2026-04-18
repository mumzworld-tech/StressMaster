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

  // Initialize parser
  const parser = new UnifiedCommandParser({});
  await parser.initialize();

  // Initialize generator
  const generator = new K6ScriptGenerator();

  // Initialize executor
  const executor = new SmartLoadExecutor();

  // Initialize analyzer
  const analyzer = new AIResultsAnalyzer({
    enableAI: false,
    thresholds: {
      responseTime: { warning: 1000, critical: 5000 },
      errorRate: { warning: 0.05, critical: 0.1 },
      throughput: { warning: 10, critical: 1 },
    },
  });

  // Initialize template service
  const templateService = new TemplateManagementService();

  // In-memory test history
  const testHistory: TestHistoryEntry[] = [];

  return {
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
}

/**
 * Create and configure the MCP server with all tools and resources.
 */
export async function createServer(): Promise<McpServer> {
  const server = new McpServer({
    name: "stressmaster",
    version: "1.0.0",
  });

  // Initialize shared service context
  const ctx = await createServiceContext();

  // ─── Register Load Test Tools ────────────────────────────────────────────

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

  return server;
}
