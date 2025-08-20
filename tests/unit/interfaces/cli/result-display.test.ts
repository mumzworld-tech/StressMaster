import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResultDisplayManager } from "@/interfaces/cli";
import { TestResult, TestStatus } from "@/core/types";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockProcessStdout = vi
  .spyOn(process.stdout, "write")
  .mockImplementation(() => true);

describe("ResultDisplayManager", () => {
  let displayManager: ResultDisplayManager;
  let mockTestResult: TestResult;
  let tempDir: string;

  beforeEach(() => {
    displayManager = new ResultDisplayManager();
    tempDir = tmpdir();

    // Clear console mocks
    mockConsoleLog.mockClear();
    mockProcessStdout.mockClear();

    // Create a mock test result
    mockTestResult = {
      id: "test-123",
      spec: {
        id: "spec-123",
        name: "Test Load Test",
        description: "A test load test",
        testType: "spike",
        requests: [],
        loadPattern: {
          type: "spike",
          virtualUsers: 100,
        },
        duration: { value: 30, unit: "seconds" },
      },
      startTime: new Date("2024-01-01T10:00:00Z"),
      endTime: new Date("2024-01-01T10:05:00Z"),
      status: "completed" as TestStatus,
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
      errors: [
        {
          errorType: "HTTP_500",
          errorMessage: "Internal Server Error",
          count: 30,
          percentage: 3.0,
          firstOccurrence: new Date("2024-01-01T10:01:00Z"),
          lastOccurrence: new Date("2024-01-01T10:04:00Z"),
        },
        {
          errorType: "TIMEOUT",
          errorMessage: "Request timeout",
          count: 20,
          percentage: 2.0,
          firstOccurrence: new Date("2024-01-01T10:02:00Z"),
          lastOccurrence: new Date("2024-01-01T10:04:30Z"),
        },
      ],
      recommendations: [
        "Consider increasing server capacity",
        "Review timeout settings",
        "Monitor database performance",
      ],
      rawData: {
        k6Output: {},
        executionLogs: [],
        systemMetrics: [],
      },
    };
  });

  describe("displayResults", () => {
    it("should display test results with proper formatting", () => {
      displayManager.displayResults(mockTestResult);

      // Verify that console.log was called multiple times for different sections
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("✅ Test Completed Successfully!")
      );
    });

    it("should display error information when errors exist", () => {
      displayManager.displayResults(mockTestResult);

      // Should display error section since we have errors in mock data
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("⚠️  Error Summary:")
      );
    });

    it("should display recommendations when they exist", () => {
      displayManager.displayResults(mockTestResult);

      // Should display recommendations section
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("💡 AI Recommendations:")
      );
    });

    it("should handle results with no errors gracefully", () => {
      const resultWithoutErrors = {
        ...mockTestResult,
        errors: [],
      };

      expect(() =>
        displayManager.displayResults(resultWithoutErrors)
      ).not.toThrow();
    });

    it("should handle results with no recommendations gracefully", () => {
      const resultWithoutRecommendations = {
        ...mockTestResult,
        recommendations: [],
      };

      expect(() =>
        displayManager.displayResults(resultWithoutRecommendations)
      ).not.toThrow();
    });
  });

  describe("exportResults", () => {
    it("should export results to JSON format", async () => {
      const filename = join(tempDir, "test-export.json");

      const exportedFile = await displayManager.exportResults(
        mockTestResult,
        "json",
        filename
      );

      expect(exportedFile).toBe(filename);

      // Verify file was created and contains valid JSON
      const content = await fs.readFile(filename, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.id).toBe(mockTestResult.id);
      expect(parsed.metrics.totalRequests).toBe(1000);

      // Cleanup
      await fs.unlink(filename).catch(() => {});
    });

    it("should export results to CSV format", async () => {
      const filename = join(tempDir, "test-export.csv");

      const exportedFile = await displayManager.exportResults(
        mockTestResult,
        "csv",
        filename
      );

      expect(exportedFile).toBe(filename);

      // Verify file was created and contains CSV data
      const content = await fs.readFile(filename, "utf-8");

      expect(content).toContain(
        '"Metric Category","Metric Name","Value","Unit"'
      );
      expect(content).toContain('"Summary","Test ID","test-123"');
      expect(content).toContain('"Requests","Total Requests","1000","count"');

      // Cleanup
      await fs.unlink(filename).catch(() => {});
    });

    it("should export results to HTML format", async () => {
      const filename = join(tempDir, "test-export.html");

      const exportedFile = await displayManager.exportResults(
        mockTestResult,
        "html",
        filename
      );

      expect(exportedFile).toBe(filename);

      // Verify file was created and contains HTML
      const content = await fs.readFile(filename, "utf-8");

      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<title>Load Test Results - test-123</title>");
      expect(content).toContain("1,000"); // Formatted number
      expect(content).toContain("95.00%"); // Success rate

      // Cleanup
      await fs.unlink(filename).catch(() => {});
    });

    it("should generate default filename when none provided", async () => {
      const exportedFile = await displayManager.exportResults(
        mockTestResult,
        "json"
      );

      expect(exportedFile).toMatch(
        /^load-test-test-123-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/
      );

      // Cleanup
      await fs.unlink(exportedFile).catch(() => {});
    });

    it("should throw error for unsupported format", async () => {
      await expect(
        displayManager.exportResults(mockTestResult, "xml" as any)
      ).rejects.toThrow("Unsupported export format: xml");
    });
  });

  describe("progress display", () => {
    it("should show progress updates", () => {
      const progressUpdate = {
        testId: "test-123",
        progress: 50,
        currentPhase: "Executing",
        message: "Running load test...",
        timestamp: new Date(),
      };

      displayManager.showProgress(progressUpdate);

      // Verify progress bar was written to stdout
      expect(mockProcessStdout).toHaveBeenCalledWith(
        expect.stringContaining("🔄 Executing:")
      );
      expect(mockProcessStdout).toHaveBeenCalledWith(
        expect.stringContaining("50.0%")
      );
    });

    it("should show execution metrics", () => {
      const executionMetrics = {
        status: "running" as const,
        progress: 50,
        currentVUs: 50,
        requestsCompleted: 500,
        requestsPerSecond: 25.5,
        avgResponseTime: 150.5,
        errorRate: 0.05,
        timestamp: new Date(),
      };

      // Clear previous mock calls
      mockProcessStdout.mockClear();

      displayManager.showExecutionMetrics(executionMetrics);

      // Verify that stdout was called twice: once to clear, once to write content
      expect(mockProcessStdout).toHaveBeenCalledTimes(2);
      expect(mockProcessStdout).toHaveBeenNthCalledWith(1, "\r\x1b[K"); // Clear line

      // Check that the second call contains the key metrics (ignoring color codes)
      const secondCall = mockProcessStdout.mock.calls[1][0] as string;
      expect(secondCall).toContain("📊");
      expect(secondCall).toContain("50"); // VUs value
      expect(secondCall).toContain("25.5"); // RPS value
      expect(secondCall).toContain("500"); // requestsCompleted value
      expect(secondCall).toContain("151"); // avgResponseTime value (rounded from 150.5)
      expect(secondCall).toContain("5.0"); // errorRate value (just the number)
      expect(secondCall).toContain("%"); // percentage symbol
      expect(secondCall).toContain("ms"); // Response time with ms suffix
    });

    it("should clear progress display", () => {
      // First show some progress
      const progressUpdate = {
        testId: "test-123",
        progress: 75,
        currentPhase: "Completing",
        message: "Finishing test...",
        timestamp: new Date(),
      };

      displayManager.showProgress(progressUpdate);
      displayManager.clearProgress();

      // Verify clear sequence was written
      expect(mockProcessStdout).toHaveBeenCalledWith("\r\x1b[K");
    });
  });

  describe("formatting utilities", () => {
    it("should format bytes correctly", () => {
      // Test the private formatBytes method through HTML export
      const result = {
        ...mockTestResult,
        metrics: {
          ...mockTestResult.metrics,
          throughput: {
            requestsPerSecond: 10,
            bytesPerSecond: 1536, // 1.5 KB
          },
        },
      };

      const filename = join(tempDir, "format-test.html");

      displayManager.exportResults(result, "html", filename).then(async () => {
        const content = await fs.readFile(filename, "utf-8");
        expect(content).toContain("1.50 KB/s");

        // Cleanup
        await fs.unlink(filename).catch(() => {});
      });
    });

    it("should format percentages correctly", () => {
      // This is tested through the CSV export which includes percentages
      const filename = join(tempDir, "percentage-test.csv");

      displayManager
        .exportResults(mockTestResult, "csv", filename)
        .then(async () => {
          const content = await fs.readFile(filename, "utf-8");
          expect(content).toContain("95.00"); // Success rate

          // Cleanup
          await fs.unlink(filename).catch(() => {});
        });
    });
  });
});
