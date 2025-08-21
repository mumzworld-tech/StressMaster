import { describe, it, expect, beforeEach } from "vitest";
import {
  ParsingDiagnosticAnalyzer,
  DiagnosticReport,
  DebugSession,
} from "../../../src/core/parser/config";
import {
  ParsingMetricsCollector,
  ParseAttempt,
  DiagnosticInfo,
} from "../../../src/core/parser/config";

describe("ParsingDiagnosticAnalyzer", () => {
  let collector: ParsingMetricsCollector;
  let analyzer: ParsingDiagnosticAnalyzer;

  beforeEach(() => {
    collector = new ParsingMetricsCollector();
    analyzer = new ParsingDiagnosticAnalyzer(collector);
  });

  describe("Diagnostic Report Generation", () => {
    it("should generate empty report for no data", () => {
      const report = analyzer.generateReport();

      expect(report.summary.totalAttempts).toBe(0);
      expect(report.summary.successRate).toBe(0);
      expect(report.recommendations).toHaveLength(0);
      expect(report.detailedAnalysis.slowestAttempts).toHaveLength(0);
    });

    it("should generate comprehensive report with data", () => {
      const attempts: ParseAttempt[] = [
        {
          id: "success-1",
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.9,
          responseTimeMs: 1000,
          success: true,
          usedFallback: false,
          retryCount: 0,
          assumptions: 1,
          warnings: 0,
        },
        {
          id: "failure-1",
          timestamp: Date.now(),
          inputLength: 200,
          detectedFormat: "unknown",
          confidence: 0.3,
          responseTimeMs: 5000,
          success: false,
          errorType: "validation_error",
          errorMessage: "Invalid format",
          usedFallback: true,
          retryCount: 2,
          assumptions: 0,
          warnings: 3,
        },
      ];

      attempts.forEach((attempt) => collector.recordParseAttempt(attempt));

      const report = analyzer.generateReport();

      expect(report.summary.totalAttempts).toBe(2);
      expect(report.summary.successRate).toBe(0.5);
      expect(report.summary.averageResponseTime).toBe(3000);
      expect(report.summary.mostCommonErrors).toHaveLength(1);
      expect(report.summary.mostCommonErrors[0].type).toBe("validation_error");
      expect(report.detailedAnalysis.failedAttempts).toHaveLength(1);
    });

    it("should generate recommendations based on metrics", () => {
      const slowAttempts: ParseAttempt[] = Array.from(
        { length: 5 },
        (_, i) => ({
          id: `slow-${i}`,
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.6,
          responseTimeMs: 8000, // Slow response
          success: true,
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        })
      );

      slowAttempts.forEach((attempt) => collector.recordParseAttempt(attempt));

      const report = analyzer.generateReport();

      expect(report.recommendations).toContain(
        "Response times are high - consider optimizing AI provider settings or input preprocessing"
      );
    });

    it("should generate config suggestions", () => {
      const highRetryAttempts: ParseAttempt[] = Array.from(
        { length: 3 },
        (_, i) => ({
          id: `retry-${i}`,
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.8,
          responseTimeMs: 15000, // Very slow
          success: true,
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        })
      );

      highRetryAttempts.forEach((attempt) =>
        collector.recordParseAttempt(attempt)
      );

      const report = analyzer.generateReport();

      expect(report.configSuggestions.aiProvider?.timeoutMs).toBeGreaterThan(
        15000
      );
    });
  });

  describe("Parse Attempt Analysis", () => {
    it("should analyze specific parse attempt", () => {
      const attempt: ParseAttempt = {
        id: "test-1",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.4, // Low confidence
        responseTimeMs: 12000, // Slow
        success: false,
        errorType: "timeout",
        errorMessage: "Request timed out",
        usedFallback: true,
        retryCount: 3, // High retries
        assumptions: 0,
        warnings: 2,
      };

      const diagnostics: DiagnosticInfo[] = [
        {
          parseAttemptId: "test-1",
          timestamp: Date.now(),
          stage: "preprocessing",
          details: { sanitized: true },
          duration: 100,
          success: true,
        },
        {
          parseAttemptId: "test-1",
          timestamp: Date.now(),
          stage: "ai_parsing",
          details: { tokens: 500 },
          duration: 11000,
          success: false,
          error: "Timeout",
        },
      ];

      collector.recordParseAttempt(attempt);
      diagnostics.forEach((d) => collector.recordDiagnostic(d));

      const analysis = analyzer.analyzeParseAttempt("test-1");

      expect(analysis.attempt).toEqual(attempt);
      expect(analysis.diagnostics).toHaveLength(2);
      expect(analysis.timeline).toHaveLength(2);
      expect(analysis.issues).toContain("Parsing failed: Request timed out");
      expect(analysis.issues).toContain("Response time exceeded 10 seconds");
      expect(analysis.issues).toContain(
        "Low confidence score in parsing result"
      );
      expect(analysis.issues).toContain("High number of retries required");
    });

    it("should handle non-existent parse attempt", () => {
      const analysis = analyzer.analyzeParseAttempt("non-existent");

      expect(analysis.attempt).toBeNull();
      expect(analysis.diagnostics).toHaveLength(0);
      expect(analysis.issues).toContain("Parse attempt not found");
    });

    it("should generate suggestions based on attempt characteristics", () => {
      const attempt: ParseAttempt = {
        id: "test-1",
        timestamp: Date.now(),
        inputLength: 8000, // Large input
        detectedFormat: "mixed",
        confidence: 0.7,
        responseTimeMs: 3000,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 5, // Many assumptions
        warnings: 4, // Many warnings
      };

      collector.recordParseAttempt(attempt);

      const analysis = analyzer.analyzeParseAttempt("test-1");

      expect(analysis.suggestions).toContain(
        "Consider breaking down large inputs into smaller chunks"
      );
      expect(analysis.suggestions).toContain(
        "High number of assumptions made - provide more explicit input"
      );
      expect(analysis.suggestions).toContain(
        "Multiple warnings generated - review input format and completeness"
      );
    });
  });

  describe("Debug Sessions", () => {
    it("should create and manage debug sessions", () => {
      const sessionId = analyzer.startDebugSession(["test", "debugging"]);

      expect(sessionId).toMatch(/^debug_\d+_[a-z0-9]+$/);

      const session = analyzer.endDebugSession(sessionId);
      expect(session).toBeTruthy();
      expect(session!.tags).toEqual(["test", "debugging"]);
      expect(session!.endTime).toBeTruthy();
    });

    it("should add parse attempts to debug session", () => {
      const sessionId = analyzer.startDebugSession();

      analyzer.addToDebugSession(sessionId, "attempt-1");
      analyzer.addToDebugSession(sessionId, "attempt-2");

      const report = analyzer.getDebugSessionReport(sessionId);
      expect(report.session!.parseAttempts).toEqual(["attempt-1", "attempt-2"]);
    });

    it("should add notes to debug session", () => {
      const sessionId = analyzer.startDebugSession();

      analyzer.addDebugNote(sessionId, "Testing edge case");
      analyzer.addDebugNote(sessionId, "Found issue with format detection");

      const report = analyzer.getDebugSessionReport(sessionId);
      expect(report.session!.notes).toHaveLength(2);
      expect(report.session!.notes[0]).toContain("Testing edge case");
    });

    it("should generate debug session report", () => {
      const sessionId = analyzer.startDebugSession();

      const attempt: ParseAttempt = {
        id: "debug-attempt",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.8,
        responseTimeMs: 1500,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      collector.recordParseAttempt(attempt);
      analyzer.addToDebugSession(sessionId, "debug-attempt");
      analyzer.endDebugSession(sessionId);

      const report = analyzer.getDebugSessionReport(sessionId);

      expect(report.session).toBeTruthy();
      expect(report.attempts).toHaveLength(1);
      expect(report.summary.totalAttempts).toBe(1);
      expect(report.summary.successRate).toBe(1);
      expect(report.summary.averageResponseTime).toBe(1500);
    });

    it("should handle non-existent debug session", () => {
      const report = analyzer.getDebugSessionReport("non-existent");

      expect(report.session).toBeNull();
      expect(report.attempts).toHaveLength(0);
      expect(report.summary).toBeNull();
    });
  });

  describe("Data Export", () => {
    it("should export comprehensive diagnostic data", () => {
      const attempt: ParseAttempt = {
        id: "export-test",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.8,
        responseTimeMs: 1500,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      collector.recordParseAttempt(attempt);

      const sessionId = analyzer.startDebugSession(["export"]);
      analyzer.addToDebugSession(sessionId, "export-test");
      analyzer.endDebugSession(sessionId);

      const exportData = analyzer.exportDiagnosticData();

      expect(exportData.report).toBeTruthy();
      expect(exportData.rawData.attempts).toHaveLength(1);
      expect(exportData.debugSessions).toHaveLength(1);
    });
  });

  describe("Performance Analysis", () => {
    it("should identify performance bottlenecks", () => {
      const attempt: ParseAttempt = {
        id: "perf-test",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.8,
        responseTimeMs: 5150,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      const diagnostics: DiagnosticInfo[] = [
        {
          parseAttemptId: "perf-test",
          timestamp: Date.now(),
          stage: "preprocessing",
          details: {},
          duration: 100,
          success: true,
        },
        {
          parseAttemptId: "perf-test",
          timestamp: Date.now(),
          stage: "ai_parsing",
          details: {},
          duration: 5000, // Slow stage
          success: true,
        },
        {
          parseAttemptId: "perf-test",
          timestamp: Date.now(),
          stage: "validation",
          details: {},
          duration: 50,
          success: true,
        },
      ];

      collector.recordParseAttempt(attempt);
      diagnostics.forEach((d) => collector.recordDiagnostic(d));

      const analysis = analyzer.analyzeParseAttempt("perf-test");

      expect(analysis.suggestions).toContain(
        "Optimize slow stages: ai_parsing"
      );
    });

    it("should calculate stage performance metrics", () => {
      const attempts: ParseAttempt[] = [
        {
          id: "stage-1",
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
        },
        {
          id: "stage-2",
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
        },
      ];

      const diagnostics: DiagnosticInfo[] = [
        {
          parseAttemptId: "stage-1",
          timestamp: Date.now(),
          stage: "preprocessing",
          details: {},
          duration: 100,
          success: true,
        },
        {
          parseAttemptId: "stage-2",
          timestamp: Date.now(),
          stage: "preprocessing",
          details: {},
          duration: 200,
          success: false,
        },
      ];

      attempts.forEach((a) => collector.recordParseAttempt(a));
      diagnostics.forEach((d) => collector.recordDiagnostic(d));

      const report = analyzer.generateReport();

      const preprocessingStage = report.summary.performanceByStage.find(
        (s) => s.stage === "preprocessing"
      );

      expect(preprocessingStage).toBeTruthy();
      expect(preprocessingStage!.averageDuration).toBe(150);
      expect(preprocessingStage!.successRate).toBe(0.5);
    });
  });

  describe("Error Pattern Analysis", () => {
    it("should identify common error patterns", () => {
      const failedAttempts: ParseAttempt[] = [
        {
          id: "error-1",
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "unknown",
          confidence: 0.2,
          responseTimeMs: 1000,
          success: false,
          errorType: "validation_error",
          errorMessage: "Invalid JSON",
          usedFallback: true,
          retryCount: 1,
          assumptions: 0,
          warnings: 0,
        },
        {
          id: "error-2",
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "unknown",
          confidence: 0.3,
          responseTimeMs: 1000,
          success: false,
          errorType: "validation_error",
          errorMessage: "Missing required fields",
          usedFallback: true,
          retryCount: 2,
          assumptions: 0,
          warnings: 0,
        },
        {
          id: "error-3",
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "mixed",
          confidence: 0.4,
          responseTimeMs: 1000,
          success: false,
          errorType: "timeout",
          errorMessage: "Request timeout",
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        },
      ];

      failedAttempts.forEach((attempt) =>
        collector.recordParseAttempt(attempt)
      );

      const report = analyzer.generateReport();

      expect(report.summary.mostCommonErrors).toHaveLength(2);
      expect(report.summary.mostCommonErrors[0].type).toBe("validation_error");
      expect(report.summary.mostCommonErrors[0].count).toBe(2);
      expect(report.detailedAnalysis.fallbackUsage.commonTriggers).toContain(
        "validation_error"
      );
    });
  });
});
