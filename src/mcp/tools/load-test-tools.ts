/**
 * MCP Load Test Tool Handlers
 *
 * Implements the 4 core load testing tool handlers for the StressMaster MCP server.
 * Each handler validates input, calls the appropriate service, and wraps results.
 */

import type {
  RunLoadTestInput,
  ParseCommandInput,
  GenerateK6ScriptInput,
  AnalyzeResultsInput,
  ToolResult,
  GenerateK6ScriptOutput,
  ServiceContext,
  LoadTestSpec,
  TestResult,
  AnalyzedResults,
} from "../types";

// ─── Run Load Test ───────────────────────────────────────────────────────────

/**
 * Execute a load test from either natural language command or structured spec.
 *
 * @param input - Either { command: string } or { spec: LoadTestSpec }
 * @param ctx - Service context with parser, executor, etc.
 * @returns TestResult on success, error on failure
 *
 * @example
 * // From natural language
 * runLoadTest({ command: "send 100 GET requests to https://api.example.com" }, ctx)
 *
 * // From structured spec
 * runLoadTest({ spec: myLoadTestSpec }, ctx)
 */
export async function runLoadTest(
  input: RunLoadTestInput,
  ctx: ServiceContext
): Promise<ToolResult<TestResult>> {
  try {
    // Validate input
    if (!input.command && !input.spec) {
      return {
        success: false,
        error: "Either 'command' or 'spec' must be provided",
        code: "INVALID_INPUT",
      };
    }

    let spec: LoadTestSpec;

    // Parse command if provided, otherwise use spec directly
    if (input.command) {
      spec = await ctx.parser.parseCommand(input.command);
    } else if (input.spec) {
      spec = input.spec;
    } else {
      // This should never happen due to validation above, but TypeScript needs it
      return {
        success: false,
        error: "No valid input provided",
        code: "INVALID_INPUT",
      };
    }

    // Execute the load test
    const result = await ctx.executor.executeLoadTest(spec);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error instanceof Error && "code" in error
        ? String(error.code)
        : undefined;

    return {
      success: false,
      error: `Load test execution failed: ${errorMessage}`,
      code: errorCode || "EXECUTION_ERROR",
    };
  }
}

// ─── Parse Command ───────────────────────────────────────────────────────────

/**
 * Parse a natural language command into a structured LoadTestSpec.
 *
 * @param input - { command: string }
 * @param ctx - Service context with parser
 * @returns LoadTestSpec on success, error on failure
 *
 * @example
 * parseCommand({ command: "stress test https://api.example.com with 500 users" }, ctx)
 */
export async function parseCommand(
  input: ParseCommandInput,
  ctx: ServiceContext
): Promise<ToolResult<LoadTestSpec>> {
  try {
    // Validate input
    if (!input.command || typeof input.command !== "string") {
      return {
        success: false,
        error: "'command' must be a non-empty string",
        code: "INVALID_INPUT",
      };
    }

    if (input.command.trim().length === 0) {
      return {
        success: false,
        error: "Command cannot be empty",
        code: "INVALID_INPUT",
      };
    }

    // Parse the command
    const spec = await ctx.parser.parseCommand(input.command);

    return {
      success: true,
      data: spec,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error instanceof Error && "code" in error
        ? String(error.code)
        : undefined;

    return {
      success: false,
      error: `Command parsing failed: ${errorMessage}`,
      code: errorCode || "PARSE_ERROR",
    };
  }
}

// ─── Generate K6 Script ──────────────────────────────────────────────────────

/**
 * Generate a K6 load test script from either natural language command or structured spec.
 *
 * @param input - Either { command: string } or { spec: LoadTestSpec }
 * @param ctx - Service context with parser and generator
 * @returns Generated K6 script content and filename on success, error on failure
 *
 * @example
 * // From natural language
 * generateK6Script({ command: "baseline test for https://api.example.com" }, ctx)
 *
 * // From structured spec
 * generateK6Script({ spec: myLoadTestSpec }, ctx)
 */
export async function generateK6Script(
  input: GenerateK6ScriptInput,
  ctx: ServiceContext
): Promise<ToolResult<GenerateK6ScriptOutput>> {
  try {
    // Validate input
    if (!input.command && !input.spec) {
      return {
        success: false,
        error: "Either 'command' or 'spec' must be provided",
        code: "INVALID_INPUT",
      };
    }

    let spec: LoadTestSpec;

    // Parse command if provided, otherwise use spec directly
    if (input.command) {
      spec = await ctx.parser.parseCommand(input.command);
    } else if (input.spec) {
      spec = input.spec;
    } else {
      // This should never happen due to validation above, but TypeScript needs it
      return {
        success: false,
        error: "No valid input provided",
        code: "INVALID_INPUT",
      };
    }

    // Generate the K6 script
    const k6Script = ctx.generator.generateScript(spec);

    return {
      success: true,
      data: {
        script: k6Script.content,
        filename: k6Script.filename,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error instanceof Error && "code" in error
        ? String(error.code)
        : undefined;

    return {
      success: false,
      error: `K6 script generation failed: ${errorMessage}`,
      code: errorCode || "GENERATION_ERROR",
    };
  }
}

// ─── Analyze Results ─────────────────────────────────────────────────────────

/**
 * Analyze raw load test results to generate insights, bottlenecks, and recommendations.
 *
 * @param input - { rawResults: RawResults, spec?: LoadTestSpec }
 * @param ctx - Service context with analyzer
 * @returns AnalyzedResults on success, error on failure
 *
 * @example
 * analyzeResults({ rawResults: myRawResults, spec: myLoadTestSpec }, ctx)
 */
export async function analyzeResults(
  input: AnalyzeResultsInput,
  ctx: ServiceContext
): Promise<ToolResult<AnalyzedResults>> {
  try {
    // Validate input
    if (!input.rawResults) {
      return {
        success: false,
        error: "'rawResults' is required",
        code: "INVALID_INPUT",
      };
    }

    // Analyze the results
    const analyzedResults = await ctx.analyzer.analyzeResults(input.rawResults);

    return {
      success: true,
      data: analyzedResults,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error instanceof Error && "code" in error
        ? String(error.code)
        : undefined;

    return {
      success: false,
      error: `Results analysis failed: ${errorMessage}`,
      code: errorCode || "ANALYSIS_ERROR",
    };
  }
}
