import { describe, it, expect } from "vitest";
import {
  TestResult,
  RawResults,
  SystemMetrics,
  AnalyzedResults,
  PerformanceInsight,
  Bottleneck,
  PerformanceTrend,
} from "../../../src/types/test-result.js";
import { LoadTestSpec } from "../../../src/types/load-test-spec.js";
import { PerformanceMetrics, ErrorSummary } from "../../../src/types/performance-metrics.js";

describe("TestResult Data Models", () => {
  const mockLoadTestSpec: LoadTestSpec = {
    id: "test-spec-1",
    name: "Mock Test",
    description: "A mock test specification",
    testType: "baseline",
    requests: [
      {
        method: "GET",
        url: "https://api.example.com/test",
      },
    ],
    loadPattern: {
      type: "constant",
      virtualUsers: 10,
    },
    duration: { value: 5, unit: "minutes" },
  };

  const mockPerformanceMetrics: PerformanceMetrics = {
    totalRequests: 1000,
    successfulRequests: 950,
    failedRequests: 50,
    responseTime: {
      min: 50,
      max: 2000,
      avg: 250,
      p50: 200,
      p90: 400,
      p95: 500,
      p99: 800,
    },
    throughput: {
      requestsPerSecond: 33.3,
      bytesPerSecond: 102400,
    },
    errorRate: 0.05,
  };

  const mockErrorSummary: ErrorSummary[] = [
    {
      errorType: "HTTP 500",
      count: 30,
      percentage: 3.0,
      firstOccurrence: new Date("2024-01-01T10:00:00Z"),
      lastOccurrence: new Date("2024-01-01T10:05:00Z"),
      sampleMessage: "Internal Server Error",
    },
    {
      errorType: "Timeout",
      count: 20,
      percentage: 2.0,
      firstOccurrence: new Date("2024-01-01T10:01:00Z"),
      lastOccurrence: new Date("2024-01-01T10:04:30Z"),
      sampleMessage: "Request timeout after 30s",
    },
  ];

  describe("TestResult", () => {
    it("should create a complete test result", () => {
      const rawResults: RawResults = {
        k6Output: { metrics: {}, checks: {} },
        executionLogs: ["Test started", "Test completed"],
        systemMetrics: [],
      };

      const testResult: TestResult = {
        id: "result-1",
        spec: mockLoadTestSpec,
        startTime: new Date("2024-01-01T10:00:00Z"),
        endTime: new Date("2024-01-01T10:05:00Z"),
        status: "completed",
        metrics: mockPerformanceMetrics,
        errors: mockErrorSummary,
        recommendations: ["Optimize database queries", "Implement caching"],
        rawData: rawResults,
      };

      expect(testResult.id).toBe("result-1");
      expect(testResult.status).toBe("completed");
      expect(testResult.metrics.totalRequests).toBe(1000);
      expect(testResult.errors).toHaveLength(2);
      expect(testResult.recommendations).toHaveLength(2);
    });

    it("should handle failed test status", () => {
      const testResult: TestResult = {
        id: "failed-result",
        spec: mockLoadTestSpec,
        startTime: new Date("2024-01-01T10:00:00Z"),
        endTime: new Date("2024-01-01T10:02:00Z"),
        status: "failed",
        metrics: {
          ...mockPerformanceMetrics,
          totalRequests: 100,
          errorRate: 0.8,
        },
        errors: [
          {
            errorType: "Connection Refused",
            count: 80,
            percentage: 80.0,
            firstOccurrence: new Date("2024-01-01T10:00:30Z"),
            lastOccurrence: new Date("2024-01-01T10:01:30Z"),
            sampleMessage: "Connection refused by target server",
          },
        ],
        recommendations: ["Check target server availability"],
        rawData: {
          k6Output: {},
          executionLogs: ["Test failed due to connection issues"],
          systemMetrics: [],
        },
      };

      expect(testResult.status).toBe("failed");
      expect(testResult.metrics.errorRate).toBe(0.8);
      expect(testResult.errors[0].errorType).toBe("Connection Refused");
    });

    it("should calculate test duration", () => {
      const startTime = new Date("2024-01-01T10:00:00Z");
      const endTime = new Date("2024-01-01T10:05:30Z");

      const testResult: TestResult = {
        id: "duration-test",
        spec: mockLoadTestSpec,
        startTime,
        endTime,
        status: "completed",
        metrics: mockPerformanceMetrics,
        errors: [],
        recommendations: [],
        rawData: {
          k6Output: {},
          executionLogs: [],
          systemMetrics: [],
        },
      };

      const duration = endTime.getTime() - startTime.getTime();
      expect(duration).toBe(330000); // 5.5 minutes in milliseconds
    });
  });

  describe("RawResults", () => {
    it("should store K6 output and execution logs", () => {
      const rawResults: RawResults = {
        k6Output: {
          metrics: {
            http_req_duration: { avg: 250, p95: 500 },
            http_reqs: { count: 1000, rate: 33.3 },
          },
          checks: {
            "status is 200": { passes: 950, fails: 50 },
          },
        },
        executionLogs: [
          "Starting load test...",
          "Ramping up to 10 VUs",
          "Test completed successfully",
        ],
        systemMetrics: [],
      };

      expect(rawResults.k6Output.metrics).toBeDefined();
      expect(rawResults.executionLogs).toHaveLength(3);
      expect(rawResults.executionLogs[0]).toBe("Starting load test...");
    });

    it("should include system metrics", () => {
      const systemMetric: SystemMetrics = {
        timestamp: new Date("2024-01-01T10:02:30Z"),
        cpuUsage: 45.2,
        memoryUsage: 1024 * 1024 * 512, // 512MB
        networkIO: {
          bytesIn: 1024 * 1024 * 10, // 10MB
          bytesOut: 1024 * 1024 * 5, // 5MB
        },
      };

      const rawResults: RawResults = {
        k6Output: {},
        executionLogs: [],
        systemMetrics: [systemMetric],
      };

      expect(rawResults.systemMetrics).toHaveLength(1);
      expect(rawResults.systemMetrics[0].cpuUsage).toBe(45.2);
      expect(rawResults.systemMetrics[0].networkIO.bytesIn).toBe(
        1024 * 1024 * 10
      );
    });
  });

  describe("AnalyzedResults", () => {
    it("should contain performance insights", () => {
      const insight: PerformanceInsight = {
        category: "response_time",
        severity: "warning",
        message: "Average response time is above optimal threshold",
        recommendation:
          "Consider implementing caching or optimizing database queries",
      };

      const analyzedResults: AnalyzedResults = {
        testResult: {
          id: "analyzed-test",
          spec: mockLoadTestSpec,
          startTime: new Date(),
          endTime: new Date(),
          status: "completed",
          metrics: mockPerformanceMetrics,
          errors: [],
          recommendations: [],
          rawData: { k6Output: {}, executionLogs: [], systemMetrics: [] },
        },
        performanceInsights: [insight],
        bottlenecks: [],
        trends: [],
      };

      expect(analyzedResults.performanceInsights).toHaveLength(1);
      expect(analyzedResults.performanceInsights[0].category).toBe(
        "response_time"
      );
      expect(analyzedResults.performanceInsights[0].severity).toBe("warning");
    });

    it("should identify bottlenecks", () => {
      const bottleneck: Bottleneck = {
        component: "database",
        description: "Database queries are taking longer than expected",
        impact: "high",
        suggestedFix: "Add database indexes and optimize slow queries",
      };

      const analyzedResults: AnalyzedResults = {
        testResult: {
          id: "bottleneck-test",
          spec: mockLoadTestSpec,
          startTime: new Date(),
          endTime: new Date(),
          status: "completed",
          metrics: mockPerformanceMetrics,
          errors: [],
          recommendations: [],
          rawData: { k6Output: {}, executionLogs: [], systemMetrics: [] },
        },
        performanceInsights: [],
        bottlenecks: [bottleneck],
        trends: [],
      };

      expect(analyzedResults.bottlenecks).toHaveLength(1);
      expect(analyzedResults.bottlenecks[0].component).toBe("database");
      expect(analyzedResults.bottlenecks[0].impact).toBe("high");
    });

    it("should track performance trends", () => {
      const trend: PerformanceTrend = {
        metric: "response_time",
        direction: "degrading",
        changePercentage: 15.5,
        timeframe: "last 7 days",
      };

      const analyzedResults: AnalyzedResults = {
        testResult: {
          id: "trend-test",
          spec: mockLoadTestSpec,
          startTime: new Date(),
          endTime: new Date(),
          status: "completed",
          metrics: mockPerformanceMetrics,
          errors: [],
          recommendations: [],
          rawData: { k6Output: {}, executionLogs: [], systemMetrics: [] },
        },
        performanceInsights: [],
        bottlenecks: [],
        trends: [trend],
      };

      expect(analyzedResults.trends).toHaveLength(1);
      expect(analyzedResults.trends[0].direction).toBe("degrading");
      expect(analyzedResults.trends[0].changePercentage).toBe(15.5);
    });
  });

  describe("Error handling", () => {
    it("should handle empty error arrays", () => {
      const testResult: TestResult = {
        id: "no-errors",
        spec: mockLoadTestSpec,
        startTime: new Date(),
        endTime: new Date(),
        status: "completed",
        metrics: {
          ...mockPerformanceMetrics,
          errorRate: 0,
          failedRequests: 0,
        },
        errors: [],
        recommendations: ["Great performance!"],
        rawData: { k6Output: {}, executionLogs: [], systemMetrics: [] },
      };

      expect(testResult.errors).toHaveLength(0);
      expect(testResult.metrics.errorRate).toBe(0);
      expect(testResult.metrics.failedRequests).toBe(0);
    });

    it("should handle multiple error types", () => {
      const multipleErrors: ErrorSummary[] = [
        {
          errorType: "HTTP 404",
          count: 25,
          percentage: 2.5,
          firstOccurrence: new Date("2024-01-01T10:00:00Z"),
          lastOccurrence: new Date("2024-01-01T10:04:00Z"),
          sampleMessage: "Not Found",
        },
        {
          errorType: "HTTP 500",
          count: 15,
          percentage: 1.5,
          firstOccurrence: new Date("2024-01-01T10:01:00Z"),
          lastOccurrence: new Date("2024-01-01T10:03:00Z"),
          sampleMessage: "Internal Server Error",
        },
        {
          errorType: "Connection Timeout",
          count: 10,
          percentage: 1.0,
          firstOccurrence: new Date("2024-01-01T10:02:00Z"),
          lastOccurrence: new Date("2024-01-01T10:04:30Z"),
          sampleMessage: "Connection timed out",
        },
      ];

      const testResult: TestResult = {
        id: "multiple-errors",
        spec: mockLoadTestSpec,
        startTime: new Date(),
        endTime: new Date(),
        status: "completed",
        metrics: {
          ...mockPerformanceMetrics,
          errorRate: 0.05,
          failedRequests: 50,
        },
        errors: multipleErrors,
        recommendations: [
          "Investigate error patterns",
          "Improve error handling",
        ],
        rawData: { k6Output: {}, executionLogs: [], systemMetrics: [] },
      };

      expect(testResult.errors).toHaveLength(3);
      expect(testResult.errors[0].errorType).toBe("HTTP 404");
      expect(testResult.errors[1].count).toBe(15);
      expect(testResult.errors[2].percentage).toBe(1.0);
    });
  });
});
