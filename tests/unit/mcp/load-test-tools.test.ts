import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runLoadTest,
  parseCommand,
  generateK6Script,
  analyzeResults,
} from "../../../src/mcp/tools/load-test-tools.js";
import type {
  ServiceContext,
  LoadTestSpec,
  TestResult,
  RawResults,
  AnalyzedResults,
} from "../../../src/mcp/types.js";

describe("Load Test Tool Handlers", () => {
  // Mock LoadTestSpec
  const mockSpec: LoadTestSpec = {
    id: "test-1",
    name: "Test",
    description: "Test desc",
    testType: "baseline",
    requests: [
      {
        url: "http://example.com",
        method: "GET",
        headers: {},
        queryParams: {},
      },
    ],
    loadPattern: {
      type: "constant",
      virtualUsers: 10,
      duration: { value: 30, unit: "seconds" },
    },
  };

  // Mock TestResult
  const mockTestResult: TestResult = {
    id: "result-1",
    spec: mockSpec,
    startTime: new Date("2024-01-01T10:00:00Z"),
    endTime: new Date("2024-01-01T10:00:30Z"),
    duration: 30000,
    status: "completed",
    metrics: {
      totalRequests: 300,
      successfulRequests: 295,
      failedRequests: 5,
      responseTime: {
        min: 50,
        max: 500,
        avg: 150,
        p50: 140,
        p90: 250,
        p95: 300,
        p99: 450,
      },
      throughput: {
        requestsPerSecond: 10,
        bytesPerSecond: 10240,
      },
      errorRate: 0.0167,
    },
    rawResults: {
      k6Output: { metrics: {}, checks: {} },
      executionLogs: [],
      systemMetrics: [],
    },
  };

  // Mock RawResults
  const mockRawResults: RawResults = {
    k6Output: { metrics: {}, checks: {} },
    executionLogs: ["Test started", "Test completed"],
    systemMetrics: [],
  };

  // Mock AnalyzedResults
  const mockAnalyzedResults: AnalyzedResults = {
    performanceScore: 85,
    insights: [
      {
        category: "performance",
        severity: "info",
        title: "Good performance",
        description: "System performed well",
        recommendation: "Continue monitoring",
        affectedMetrics: ["responseTime"],
      },
    ],
    bottlenecks: [],
    trends: [],
    summary: "Test completed successfully",
  };

  // Mock ServiceContext
  let mockCtx: ServiceContext;

  beforeEach(() => {
    mockCtx = {
      parser: {
        parseCommand: vi.fn().mockResolvedValue(mockSpec),
        initialize: vi.fn().mockResolvedValue(undefined),
      },
      generator: {
        generateScript: vi.fn().mockReturnValue({
          content: "// K6 script content",
          filename: "test.js",
        }),
      },
      executor: {
        executeLoadTest: vi.fn().mockResolvedValue(mockTestResult),
      },
      analyzer: {
        analyzeResults: vi.fn().mockResolvedValue(mockAnalyzedResults),
      },
      config: {
        getConfig: vi.fn().mockResolvedValue({}),
        setConfig: vi.fn().mockResolvedValue(undefined),
        initConfig: vi.fn().mockResolvedValue(undefined),
      },
      templates: {
        listTemplates: vi.fn().mockResolvedValue([]),
        createTemplate: vi.fn().mockResolvedValue({}),
        loadTemplate: vi.fn().mockResolvedValue({}),
        deleteTemplate: vi.fn().mockResolvedValue(undefined),
        exportTemplate: vi.fn().mockResolvedValue({}),
      },
      history: {
        getEntries: vi.fn().mockReturnValue([]),
        getEntry: vi.fn().mockReturnValue(undefined),
        addEntry: vi.fn(),
      },
    };
  });

  describe("parseCommand", () => {
    it("should successfully parse a valid command", async () => {
      const result = await parseCommand(
        { command: "send 100 GET requests to http://example.com" },
        mockCtx
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockSpec);
      }
      expect(mockCtx.parser.parseCommand).toHaveBeenCalledWith(
        "send 100 GET requests to http://example.com"
      );
    });

    it("should return error for empty command", async () => {
      const result = await parseCommand({ command: "" }, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("non-empty string");
        expect(result.code).toBe("INVALID_INPUT");
      }
    });

    it("should return error for whitespace-only command", async () => {
      const result = await parseCommand({ command: "   " }, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("cannot be empty");
        expect(result.code).toBe("INVALID_INPUT");
      }
    });

    it("should handle parser errors gracefully", async () => {
      mockCtx.parser.parseCommand = vi
        .fn()
        .mockRejectedValue(new Error("Parse failed"));

      const result = await parseCommand(
        { command: "invalid command" },
        mockCtx
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Command parsing failed");
        expect(result.error).toContain("Parse failed");
        expect(result.code).toBe("PARSE_ERROR");
      }
    });
  });

  describe("runLoadTest", () => {
    it("should successfully run load test with command", async () => {
      const result = await runLoadTest(
        { command: "send 100 GET requests to http://example.com" },
        mockCtx
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockTestResult);
      }
      expect(mockCtx.parser.parseCommand).toHaveBeenCalled();
      expect(mockCtx.executor.executeLoadTest).toHaveBeenCalledWith(mockSpec);
    });

    it("should successfully run load test with spec", async () => {
      const result = await runLoadTest({ spec: mockSpec }, mockCtx);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockTestResult);
      }
      expect(mockCtx.parser.parseCommand).not.toHaveBeenCalled();
      expect(mockCtx.executor.executeLoadTest).toHaveBeenCalledWith(mockSpec);
    });

    it("should return error when neither command nor spec provided", async () => {
      const result = await runLoadTest({}, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Either 'command' or 'spec' must be provided");
        expect(result.code).toBe("INVALID_INPUT");
      }
    });

    it("should handle executor errors gracefully", async () => {
      mockCtx.executor.executeLoadTest = vi
        .fn()
        .mockRejectedValue(new Error("Execution failed"));

      const result = await runLoadTest({ spec: mockSpec }, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Load test execution failed");
        expect(result.error).toContain("Execution failed");
        expect(result.code).toBe("EXECUTION_ERROR");
      }
    });

    it("should handle parser errors gracefully when using command", async () => {
      mockCtx.parser.parseCommand = vi
        .fn()
        .mockRejectedValue(new Error("Parse failed"));

      const result = await runLoadTest(
        { command: "invalid command" },
        mockCtx
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Load test execution failed");
      }
    });
  });

  describe("generateK6Script", () => {
    it("should successfully generate script from command", async () => {
      const result = await generateK6Script(
        { command: "baseline test for http://example.com" },
        mockCtx
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.script).toBe("// K6 script content");
        expect(result.data.filename).toBe("test.js");
      }
      expect(mockCtx.parser.parseCommand).toHaveBeenCalled();
      expect(mockCtx.generator.generateScript).toHaveBeenCalledWith(mockSpec);
    });

    it("should successfully generate script from spec", async () => {
      const result = await generateK6Script({ spec: mockSpec }, mockCtx);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.script).toBe("// K6 script content");
        expect(result.data.filename).toBe("test.js");
      }
      expect(mockCtx.parser.parseCommand).not.toHaveBeenCalled();
      expect(mockCtx.generator.generateScript).toHaveBeenCalledWith(mockSpec);
    });

    it("should return error when neither command nor spec provided", async () => {
      const result = await generateK6Script({}, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Either 'command' or 'spec' must be provided");
        expect(result.code).toBe("INVALID_INPUT");
      }
    });

    it("should handle generator errors gracefully", async () => {
      mockCtx.generator.generateScript = vi
        .fn()
        .mockImplementation(() => {
          throw new Error("Generation failed");
        });

      const result = await generateK6Script({ spec: mockSpec }, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("K6 script generation failed");
        expect(result.error).toContain("Generation failed");
        expect(result.code).toBe("GENERATION_ERROR");
      }
    });
  });

  describe("analyzeResults", () => {
    it("should successfully analyze results", async () => {
      const result = await analyzeResults(
        { rawResults: mockRawResults, spec: mockSpec },
        mockCtx
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAnalyzedResults);
      }
      expect(mockCtx.analyzer.analyzeResults).toHaveBeenCalledWith(mockRawResults);
    });

    it("should successfully analyze results without spec", async () => {
      const result = await analyzeResults(
        { rawResults: mockRawResults },
        mockCtx
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAnalyzedResults);
      }
    });

    it("should return error when rawResults not provided", async () => {
      const result = await analyzeResults({} as any, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("'rawResults' is required");
        expect(result.code).toBe("INVALID_INPUT");
      }
    });

    it("should handle analyzer errors gracefully", async () => {
      mockCtx.analyzer.analyzeResults = vi
        .fn()
        .mockRejectedValue(new Error("Analysis failed"));

      const result = await analyzeResults(
        { rawResults: mockRawResults },
        mockCtx
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Results analysis failed");
        expect(result.error).toContain("Analysis failed");
        expect(result.code).toBe("ANALYSIS_ERROR");
      }
    });
  });
});
