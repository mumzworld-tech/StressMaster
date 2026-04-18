/**
 * MCP Server Types
 *
 * Bridges MCP tool/resource schemas to existing StressMaster types.
 * References types from src/types/ — no duplication.
 */

import type { LoadTestSpec } from "../types/load-test-spec";
import type { TestResult, RawResults, AnalyzedResults } from "../types/test-result";
import type { TestType, HttpMethod, LoadPatternType } from "../types/common";
import type { Template } from "../services/template-management.service";
import type { StressMasterConfig } from "../services/config-management.service";

// Re-export referenced types for convenience
export type {
  LoadTestSpec,
  TestResult,
  RawResults,
  AnalyzedResults,
  TestType,
  HttpMethod,
  LoadPatternType,
  Template,
  StressMasterConfig,
};

/** MCP-local test history entry (no persistent history manager on this branch) */
export interface TestHistoryEntry {
  id: string;
  command: string;
  timestamp: Date;
  spec: LoadTestSpec;
  result?: TestResult;
  status: "completed" | "failed" | "cancelled";
  executionTimeMs: number;
}

// ─── Tool Result Wrapper ─────────────────────────────────────────────────────

export interface ToolSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ToolError {
  success: false;
  error: string;
  code?: string;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

// ─── Load Test Tool Inputs ───────────────────────────────────────────────────

export interface RunLoadTestInput {
  /** Natural language command (e.g., "send 100 GET requests to https://api.example.com/users") */
  command?: string;
  /** Structured LoadTestSpec (alternative to command) */
  spec?: LoadTestSpec;
}

export interface ParseCommandInput {
  /** Natural language command to parse into a LoadTestSpec */
  command: string;
}

export interface GenerateK6ScriptInput {
  /** Natural language command (will be parsed first) */
  command?: string;
  /** Structured LoadTestSpec (alternative to command) */
  spec?: LoadTestSpec;
}

export interface AnalyzeResultsInput {
  /** Raw test results to analyze */
  rawResults: RawResults;
  /** Optional spec for context */
  spec?: LoadTestSpec;
}

// ─── Management Tool Inputs ──────────────────────────────────────────────────

export interface GetConfigInput {
  /** Optional specific config key to retrieve */
  key?: string;
}

export interface SetConfigInput {
  /** Configuration key to set */
  key: string;
  /** Value to set */
  value: string;
}

export interface ListTemplatesInput {
  // No required input
}

export interface ManageTemplateInput {
  /** Action to perform */
  action: "create" | "load" | "delete" | "export";
  /** Template name */
  name: string;
  /** LoadTestSpec for create action */
  spec?: LoadTestSpec;
  /** Description for create action */
  description?: string;
}

// ─── Tool Output Types ───────────────────────────────────────────────────────

export interface GenerateK6ScriptOutput {
  /** The generated K6 JavaScript script content */
  script: string;
  /** Suggested filename */
  filename: string;
}

export interface SetConfigOutput {
  key: string;
  value: string;
  previousValue?: string;
}

export interface ManageTemplateOutput {
  action: string;
  name: string;
  template?: Template;
  message: string;
}

// ─── Resource URI Constants ──────────────────────────────────────────────────

export const RESOURCE_URIS = {
  TEST_HISTORY: "stressmaster://test-history",
  TEST_RESULT: "stressmaster://test-result/{id}",
  TEMPLATES: "stressmaster://templates",
  TEMPLATE: "stressmaster://template/{name}",
  CONFIG: "stressmaster://config",
} as const;

// ─── Shared Service Context ─────────────────────────────────────────────────

export interface ServiceContext {
  parser: {
    parseCommand(command: string): Promise<LoadTestSpec>;
    initialize(): Promise<void>;
  };
  generator: {
    generateScript(spec: LoadTestSpec): { content: string; filename: string };
  };
  executor: {
    executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
  };
  analyzer: {
    analyzeResults(rawResults: RawResults): Promise<AnalyzedResults>;
  };
  config: {
    getConfig(): Promise<StressMasterConfig>;
    setConfig(key: string, value: string): Promise<void>;
    initConfig(): Promise<string | void>;
  };
  templates: {
    listTemplates(): Promise<Template[]>;
    createTemplate(name: string, command: string, spec: LoadTestSpec, description?: string): Promise<Template>;
    loadTemplate(name: string): Promise<Template>;
    deleteTemplate(name: string): Promise<void>;
    exportTemplate(name: string, outputPath: string): Promise<void>;
  };
  history: {
    getEntries(): TestHistoryEntry[];
    getEntry(id: string): TestHistoryEntry | undefined;
    addEntry(entry: Omit<TestHistoryEntry, "id">): TestHistoryEntry;
  };
}
