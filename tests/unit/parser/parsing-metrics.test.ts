import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ParsingMetricsCollector,
  ParsingPerformanceMonitor,
  ParseAttempt,
  DiagnosticInfo,
} from "../../../src/core/parser/config";

describe("ParsingMetricsCollector", () => {
  let collector: ParsingMetricsCollector;

  beforeEach(() => {
    collector = new ParsingMetricsCollector(60000); // 1 minute retention for testing
  });

  describe("Metrics Collection", () => {
    it("should initialize with empty metrics", () => {
      const metrics = collector.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulParses).toBe(0);
      expect(metrics.failedParses).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });

    it("should record successful parse attempt", () => {
      const attempt: ParseAttempt = {
        id: "test-1",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.9,
        responseTimeMs: 1500,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 1,
        warnings: 0,
      };

      collector.recordParseAttempt(attempt);
      const metrics = collector.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulParses).toBe(1);
      expect(metrics.failedParses).toBe(0);
      expect(metrics.averageResponseTime).toBe(1500);
      expect(metrics.averageConfidence).toBe(0.9);
    });

    it("should record failed parse attempt", () => {
      const attempt: ParseAttempt = {
        id: "test-2",
        timestamp: Date.now(),
        inputLength: 200,
        detectedFormat: "unknown",
        confidence: 0.3,
        responseTimeMs: 2000,
        success: false,
        errorType: "validation_error",
        errorMessage: "Invalid format",
        usedFallback: true,
        retryCount: 2,
        assumptions: 0,
        warnings: 3,
      };

      collector.recordParseAttempt(attempt);
      const metrics = collector.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulParses).toBe(0);
      expect(metrics.failedParses).toBe(1);
      expect(metrics.fallbackUsed).toBe(1);
      expect(metrics.errorsByType.validation_error).toBe(1);
      expect(metrics.retryCount).toBe(2);
    });

    it("should calculate aggregated metrics correctly", () => {
      const attempts: ParseAttempt[] = [
        {
          id: "test-1",
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.8,
          responseTimeMs: 1000,
          success: true,
          usedFallback: false,
          retryCount: 0,
          assumptions: 1,
          warnings: 0,
        },
        {
          id: "test-2",
          timestamp: Date.now(),
          inputLength: 150,
          detectedFormat: "mixed",
          confidence: 0.6,
          responseTimeMs: 2000,
          success: true,
          usedFallback: false,
          retryCount: 1,
          assumptions: 2,
          warnings: 1,
        },
        {
          id: "test-3",
          timestamp: Date.now(),
          inputLength: 200,
          detectedFormat: "unknown",
          confidence: 0.2,
          responseTimeMs: 3000,
          success: false,
          errorType: "timeout",
          usedFallback: true,
          retryCount: 3,
          assumptions: 0,
          warnings: 2,
        },
      ];

      attempts.forEach((attempt) => collector.recordParseAttempt(attempt));
      const metrics = collector.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulParses).toBe(2);
      expect(metrics.failedParses).toBe(1);
      expect(metrics.fallbackUsed).toBe(1);
      expect(metrics.averageResponseTime).toBe(2000);
      expect(metrics.averageConfidence).toBe(0.7); // (0.8 + 0.6) / 2
      expect(metrics.formatDetectionAccuracy).toBe(2 / 3);
      expect(metrics.retryCount).toBe(4);
    });
  });

  describe("Diagnostic Recording", () => {
    it("should record diagnostic information", () => {
      const diagnostic: DiagnosticInfo = {
        parseAttemptId: "test-1",
        timestamp: Date.now(),
        stage: "preprocessing",
        details: { inputLength: 100 },
        duration: 50,
        success: true,
      };

      collector.recordDiagnostic(diagnostic);
      const diagnostics = collector.getDiagnostics("test-1");

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toEqual(diagnostic);
    });

    it("should filter diagnostics by parse attempt ID", () => {
      const diagnostics: DiagnosticInfo[] = [
        {
          parseAttemptId: "test-1",
          timestamp: Date.now(),
          stage: "preprocessing",
          details: {},
          duration: 50,
          success: true,
        },
        {
          parseAttemptId: "test-2",
          timestamp: Date.now(),
          stage: "ai_parsing",
          details: {},
          duration: 1000,
          success: true,
        },
        {
          parseAttemptId: "test-1",
          timestamp: Date.now(),
          stage: "validation",
          details: {},
          duration: 25,
          success: true,
        },
      ];

      diagnostics.forEach((d) => collector.recordDiagnostic(d));

      const test1Diagnostics = collector.getDiagnostics("test-1");
      const test2Diagnostics = collector.getDiagnostics("test-2");

      expect(test1Diagnostics).toHaveLength(2);
      expect(test2Diagnostics).toHaveLength(1);
    });
  });

  describe("Time Range Filtering", () => {
    it("should filter parse attempts by time range", () => {
      const now = Date.now();
      const attempts: ParseAttempt[] = [
        {
          id: "old",
          timestamp: now - 2000,
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.8,
          responseTimeMs: 1000,
          success: true,
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        },
        {
          id: "recent",
          timestamp: now - 500,
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.8,
          responseTimeMs: 1000,
          success: true,
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        },
      ];

      attempts.forEach((attempt) => collector.recordParseAttempt(attempt));

      const recentAttempts = collector.getParseAttempts(now - 1000);
      expect(recentAttempts).toHaveLength(1);
      expect(recentAttempts[0].id).toBe("recent");

      const rangeAttempts = collector.getParseAttempts(now - 2500, now - 1500);
      expect(rangeAttempts).toHaveLength(1);
      expect(rangeAttempts[0].id).toBe("old");
    });

    it("should get aggregated metrics for time period", () => {
      const now = Date.now();
      const attempts: ParseAttempt[] = [
        {
          id: "old",
          timestamp: now - 2000,
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.5,
          responseTimeMs: 1000,
          success: false,
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        },
        {
          id: "recent",
          timestamp: now - 500,
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.9,
          responseTimeMs: 2000,
          success: true,
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        },
      ];

      attempts.forEach((attempt) => collector.recordParseAttempt(attempt));

      const recentMetrics = collector.getAggregatedMetrics(now - 1000, now);
      expect(recentMetrics.totalRequests).toBe(1);
      expect(recentMetrics.successfulParses).toBe(1);
      expect(recentMetrics.averageConfidence).toBe(0.9);
    });
  });

  describe("Data Cleanup", () => {
    it("should clean up old data based on retention period", async () => {
      const shortRetentionCollector = new ParsingMetricsCollector(100); // 100ms retention

      const oldAttempt: ParseAttempt = {
        id: "old",
        timestamp: Date.now() - 200, // Older than retention
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.8,
        responseTimeMs: 1000,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      shortRetentionCollector.recordParseAttempt(oldAttempt);

      // Wait for retention period to pass
      await new Promise((resolve) => setTimeout(resolve, 150));

      const newAttempt: ParseAttempt = {
        id: "new",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.8,
        responseTimeMs: 1000,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      shortRetentionCollector.recordParseAttempt(newAttempt);

      const attempts = shortRetentionCollector.getParseAttempts();
      expect(attempts).toHaveLength(1);
      expect(attempts[0].id).toBe("new");
    });
  });

  describe("Data Export", () => {
    it("should export all data", () => {
      const attempt: ParseAttempt = {
        id: "test",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.8,
        responseTimeMs: 1000,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      const diagnostic: DiagnosticInfo = {
        parseAttemptId: "test",
        timestamp: Date.now(),
        stage: "preprocessing",
        details: {},
        duration: 50,
        success: true,
      };

      collector.recordParseAttempt(attempt);
      collector.recordDiagnostic(diagnostic);

      const exportedData = collector.exportData();

      expect(exportedData.metrics.totalRequests).toBe(1);
      expect(exportedData.attempts).toHaveLength(1);
      expect(exportedData.diagnostics).toHaveLength(1);
    });
  });

  describe("Reset Functionality", () => {
    it("should reset all metrics and data", () => {
      const attempt: ParseAttempt = {
        id: "test",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.8,
        responseTimeMs: 1000,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      collector.recordParseAttempt(attempt);
      collector.reset();

      const metrics = collector.getMetrics();
      const attempts = collector.getParseAttempts();

      expect(metrics.totalRequests).toBe(0);
      expect(attempts).toHaveLength(0);
    });
  });
});

describe("ParsingPerformanceMonitor", () => {
  let collector: ParsingMetricsCollector;
  let monitor: ParsingPerformanceMonitor;

  beforeEach(() => {
    collector = new ParsingMetricsCollector();
    monitor = new ParsingPerformanceMonitor(collector);
  });

  describe("Stage Monitoring", () => {
    it("should track stage performance", () => {
      const parseAttemptId = "test-1";
      const stage = "preprocessing";

      monitor.startStage(parseAttemptId, stage);

      // Simulate some processing time
      setTimeout(() => {
        monitor.endStage(parseAttemptId, stage, true, { processed: true });
      }, 10);

      const activeOps = monitor.getActiveOperations();
      expect(activeOps).toHaveLength(1);
      expect(activeOps[0].parseAttemptId).toBe(parseAttemptId);
      expect(activeOps[0].stage).toBe(stage);
    });

    it("should record diagnostic information when stage ends", () => {
      const parseAttemptId = "test-1";
      const stage = "ai_parsing";

      monitor.startStage(parseAttemptId, stage);
      monitor.endStage(parseAttemptId, stage, true, { tokens: 150 });

      const diagnostics = collector.getDiagnostics(parseAttemptId);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].stage).toBe(stage);
      expect(diagnostics[0].success).toBe(true);
      expect(diagnostics[0].details.tokens).toBe(150);
    });

    it("should handle stage failures", () => {
      const parseAttemptId = "test-1";
      const stage = "validation";
      const error = "Validation failed";

      monitor.startStage(parseAttemptId, stage);
      monitor.endStage(parseAttemptId, stage, false, {}, error);

      const diagnostics = collector.getDiagnostics(parseAttemptId);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].success).toBe(false);
      expect(diagnostics[0].error).toBe(error);
    });

    it("should track multiple concurrent operations", () => {
      monitor.startStage("test-1", "preprocessing");
      monitor.startStage("test-2", "ai_parsing");
      monitor.startStage("test-1", "validation");

      const activeOps = monitor.getActiveOperations();
      expect(activeOps).toHaveLength(3);

      const test1Ops = activeOps.filter((op) => op.parseAttemptId === "test-1");
      const test2Ops = activeOps.filter((op) => op.parseAttemptId === "test-2");

      expect(test1Ops).toHaveLength(2);
      expect(test2Ops).toHaveLength(1);
    });

    it("should remove completed operations from active list", () => {
      const parseAttemptId = "test-1";
      const stage = "preprocessing";

      monitor.startStage(parseAttemptId, stage);
      expect(monitor.getActiveOperations()).toHaveLength(1);

      monitor.endStage(parseAttemptId, stage, true);
      expect(monitor.getActiveOperations()).toHaveLength(0);
    });

    it("should handle ending non-existent stage gracefully", () => {
      // Should not throw error
      monitor.endStage("non-existent", "preprocessing", true);

      const diagnostics = collector.getDiagnostics("non-existent");
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("Duration Tracking", () => {
    it("should calculate stage duration correctly", async () => {
      const parseAttemptId = "test-1";
      const stage = "ai_parsing";

      monitor.startStage(parseAttemptId, stage);

      // Wait a bit to ensure measurable duration
      await new Promise((resolve) => setTimeout(resolve, 10));

      monitor.endStage(parseAttemptId, stage, true);

      const diagnostics = collector.getDiagnostics(parseAttemptId);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].duration).toBeGreaterThan(0);
    });

    it("should track active operation duration", async () => {
      const parseAttemptId = "test-1";
      const stage = "preprocessing";

      monitor.startStage(parseAttemptId, stage);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const activeOps = monitor.getActiveOperations();
      expect(activeOps).toHaveLength(1);
      expect(activeOps[0].duration).toBeGreaterThan(0);
    });
  });
});
