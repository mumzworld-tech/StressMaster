import { describe, it, expect, beforeEach, vi } from "vitest";
import { InteractiveCLI } from "../../src/interfaces/cli/interactive-cli";
import { CLIConfig } from "../../src/interfaces/cli/cli-interface";
import { tmpdir } from "os";
import { join } from "path";
import { promises as fs } from "fs";

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockProcessStdout = vi
  .spyOn(process.stdout, "write")
  .mockImplementation(() => true);

describe("CLI Integration", () => {
  let cli: InteractiveCLI;
  let tempHistoryFile: string;

  beforeEach(() => {
    tempHistoryFile = join(tmpdir(), `cli-test-history-${Date.now()}.json`);

    const config: CLIConfig = {
      interactive: false,
      outputFormat: "json",
      verbose: false,
      historyFile: tempHistoryFile,
      maxHistoryEntries: 100,
      autoComplete: false,
    };

    cli = new InteractiveCLI(config);

    // Clear console mocks
    mockConsoleLog.mockClear();
    mockProcessStdout.mockClear();
  });

  it("should initialize CLI with proper configuration", () => {
    expect(cli).toBeDefined();
    expect(cli).toBeInstanceOf(InteractiveCLI);
  });

  it("should handle processCommand method (placeholder)", async () => {
    // Since processCommand is not yet implemented (it's a placeholder),
    // we expect it to throw an error indicating it's not implemented
    await expect(cli.processCommand("test command")).rejects.toThrow(
      "Command processing not yet implemented"
    );
  });

  it("should handle displayResults with mock data", () => {
    const mockResult = {
      id: "test-123",
      spec: {
        id: "spec-123",
        name: "Test Load Test",
        description: "A test load test",
        testType: "spike" as const,
        requests: [],
        loadPattern: {
          type: "spike" as const,
          virtualUsers: 100,
        },
        duration: { value: 30, unit: "seconds" as const },
      },
      startTime: new Date("2024-01-01T10:00:00Z"),
      endTime: new Date("2024-01-01T10:05:00Z"),
      status: "completed" as const,
      metrics: {
        totalRequests: 1000,
        successfulRequests: 950,
        failedRequests: 50,
        responseTime: {
          min: 10,
          max: 500,
          avg: 125.5,
          p50: 100,
          p90: 200,
          p95: 250,
          p99: 400,
        },
        throughput: {
          requestsPerSecond: 33.33,
          bytesPerSecond: 1024000,
        },
        errorRate: 5.0,
      },
      errors: [],
      recommendations: ["Test recommendation"],
      rawData: {
        k6Output: {},
        executionLogs: [],
        systemMetrics: [],
      },
    };

    expect(() => cli.displayResults(mockResult)).not.toThrow();

    // Verify that the display method was called (console.log should have been called)
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it("should handle exportResults with mock data", async () => {
    const mockResult = {
      id: "test-export",
      spec: {
        id: "spec-export",
        name: "Export Test",
        description: "A test for export functionality",
        testType: "baseline" as const,
        requests: [],
        loadPattern: {
          type: "constant" as const,
          virtualUsers: 10,
        },
        duration: { value: 60, unit: "seconds" as const },
      },
      startTime: new Date("2024-01-01T10:00:00Z"),
      endTime: new Date("2024-01-01T10:01:00Z"),
      status: "completed" as const,
      metrics: {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        responseTime: {
          min: 50,
          max: 200,
          avg: 100,
          p50: 95,
          p90: 150,
          p95: 175,
          p99: 190,
        },
        throughput: {
          requestsPerSecond: 1.67,
          bytesPerSecond: 10240,
        },
        errorRate: 5.0,
      },
      errors: [],
      recommendations: [],
      rawData: {
        k6Output: {},
        executionLogs: [],
        systemMetrics: [],
      },
    };

    // Test JSON export
    const jsonFile = await cli.exportResults(mockResult, "json");
    await expect(jsonFile).toBeDefined();
    await fs.unlink(jsonFile).catch(() => {});

    // Test CSV export
    const csvFile = await cli.exportResults(mockResult, "csv");
    await expect(csvFile).toBeDefined();
    await fs.unlink(csvFile).catch(() => {});

    // Test HTML export
    const htmlFile = await cli.exportResults(mockResult, "html");
    await expect(htmlFile).toBeDefined();
    await fs.unlink(htmlFile).catch(() => {});
  });

  it("should handle shutdown gracefully", async () => {
    // Mock process.exit to prevent actual exit during test
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(cli.shutdown()).rejects.toThrow("process.exit called");

    // Verify that console output was generated for shutdown
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("Saving session data")
    );

    mockExit.mockRestore();
  });

  it("should integrate command history with CLI operations", async () => {
    // This tests that the CLI properly integrates with the command history
    // Since processCommand is not implemented, we can't test the full flow
    // But we can verify that the CLI has access to history functionality

    // The CLI should have been initialized with history functionality
    expect(cli).toBeDefined();

    // We can't directly access private members, but we can verify
    // that the CLI doesn't throw errors during initialization
    expect(
      () =>
        new InteractiveCLI({
          interactive: false,
          outputFormat: "json",
          verbose: false,
          maxHistoryEntries: 50,
          autoComplete: true,
        })
    ).not.toThrow();
  });
});
