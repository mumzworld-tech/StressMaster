import { describe, it, expect, beforeEach } from "vitest";
import {
  SmartParserConfigManager,
  ParsingMetricsCollector,
  ParsingPerformanceMonitor,
  ParseAttempt,
  ParsingDiagnosticAnalyzer,
} from "../../src/core/parser";

describe("Configuration and Monitoring Integration", () => {
  let configManager: SmartParserConfigManager;
  let metricsCollector: ParsingMetricsCollector;
  let performanceMonitor: ParsingPerformanceMonitor;
  let diagnosticAnalyzer: ParsingDiagnosticAnalyzer;

  beforeEach(() => {
    configManager = new SmartParserConfigManager();
    metricsCollector = new ParsingMetricsCollector();
    performanceMonitor = new ParsingPerformanceMonitor(metricsCollector);
    diagnosticAnalyzer = new ParsingDiagnosticAnalyzer(metricsCollector);
  });

  describe("Configuration-Driven Monitoring", () => {
    it("should respect monitoring configuration settings", () => {
      // Disable metrics collection
      configManager.updateConfig({
        monitoring: {
          enableMetrics: false,
          enableDiagnostics: false,
          logLevel: "error",
          metricsRetentionMs: 1000,
        },
      });

      const config = configManager.getConfig();
      expect(config.monitoring.enableMetrics).toBe(false);
      expect(config.monitoring.enableDiagnostics).toBe(false);
      expect(config.monitoring.logLevel).toBe("error");
    });

    it("should use configuration for metrics retention", () => {
      const shortRetentionConfig = {
        monitoring: {
          enableMetrics: true,
          enableDiagnostics: false,
          logLevel: "info" as const,
          metricsRetentionMs: 100, // Very short retention
        },
      };

      configManager.updateConfig(shortRetentionConfig);
      const config = configManager.getConfig();

      expect(config.monitoring.metricsRetentionMs).toBe(100);
    });
  });

  describe("End-to-End Monitoring Workflow", () => {
    it("should track complete parsing pipeline with configuration", async () => {
      // Configure for detailed monitoring
      configManager.updateConfig({
        monitoring: {
          enableMetrics: true,
          enableDiagnostics: true,
          logLevel: "debug",
          metricsRetentionMs: 24 * 60 * 60 * 1000,
        },
        aiProvider: {
          maxRetries: 2,
          temperature: 0.1,
          enableValidationRetries: true,
          timeoutMs: 5000,
        },
      });

      const config = configManager.getConfig();
      const parseAttemptId = "integration-test-1";

      // Start debug session
      const debugSessionId = diagnosticAnalyzer.startDebugSession([
        "integration",
        "test",
      ]);

      // Simulate parsing pipeline stages
      performanceMonitor.startStage(parseAttemptId, "preprocessing");
      await new Promise((resolve) => setTimeout(resolve, 10));
      performanceMonitor.endStage(parseAttemptId, "preprocessing", true, {
        sanitized: true,
        structureExtracted: true,
      });

      performanceMonitor.startStage(parseAttemptId, "format_detection");
      await new Promise((resolve) => setTimeout(resolve, 5));
      performanceMonitor.endStage(parseAttemptId, "format_detection", true, {
        detectedFormat: "json",
        confidence: 0.9,
      });

      performanceMonitor.startStage(parseAttemptId, "ai_parsing");
      await new Promise((resolve) => setTimeout(resolve, 20));
      performanceMonitor.endStage(parseAttemptId, "ai_parsing", true, {
        tokens: 150,
        temperature: config.aiProvider.temperature,
      });

      // Record the complete parse attempt
      const attempt: ParseAttempt = {
        id: parseAttemptId,
        timestamp: Date.now(),
        inputLength: 250,
        detectedFormat: "json",
        confidence: 0.9,
        responseTimeMs: 35, // Sum of stage durations
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 1,
        warnings: 0,
      };

      metricsCollector.recordParseAttempt(attempt);
      diagnosticAnalyzer.addToDebugSession(debugSessionId, parseAttemptId);
      diagnosticAnalyzer.addDebugNote(
        debugSessionId,
        "Successful integration test"
      );

      // Verify metrics collection
      const metrics = metricsCollector.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulParses).toBe(1);
      expect(metrics.averageConfidence).toBe(0.9);

      // Verify diagnostic analysis
      const analysis = diagnosticAnalyzer.analyzeParseAttempt(parseAttemptId);
      expect(analysis.attempt).toBeTruthy();
      expect(analysis.diagnostics).toHaveLength(3); // Three stages
      expect(analysis.timeline).toHaveLength(3);
      expect(analysis.issues).toHaveLength(0); // No issues for successful attempt

      // Verify debug session
      const debugReport =
        diagnosticAnalyzer.getDebugSessionReport(debugSessionId);
      expect(debugReport.session).toBeTruthy();
      expect(debugReport.attempts).toHaveLength(1);
      expect(debugReport.summary.successRate).toBe(1);

      diagnosticAnalyzer.endDebugSession(debugSessionId);
    });

    it("should handle configuration-based error scenarios", async () => {
      // Configure for strict validation
      configManager.updateConfig({
        formatDetection: {
          confidenceThreshold: 0.9, // High threshold
          enableMultiFormatDetection: true,
          enablePatternMatching: true,
        },
        aiProvider: {
          maxRetries: 1, // Low retry count
          temperature: 0.1,
          enableValidationRetries: true,
          timeoutMs: 1000, // Short timeout
        },
        fallback: {
          enableSmartFallback: true,
          fallbackConfidenceThreshold: 0.6,
          maxFallbackAttempts: 2,
        },
      });

      const config = configManager.getConfig();
      const parseAttemptId = "error-test-1";

      // Simulate failed parsing with retries
      performanceMonitor.startStage(parseAttemptId, "format_detection");
      performanceMonitor.endStage(
        parseAttemptId,
        "format_detection",
        false,
        {
          detectedFormat: "unknown",
          confidence: 0.3, // Below threshold
        },
        "Low confidence detection"
      );

      performanceMonitor.startStage(parseAttemptId, "fallback");
      performanceMonitor.endStage(parseAttemptId, "fallback", true, {
        fallbackMethod: "rule_based",
        confidence: 0.7,
      });

      const failedAttempt: ParseAttempt = {
        id: parseAttemptId,
        timestamp: Date.now(),
        inputLength: 500,
        detectedFormat: "unknown",
        confidence: 0.3,
        responseTimeMs: 1200, // Exceeded timeout
        success: false,
        errorType: "low_confidence",
        errorMessage: "Format detection confidence below threshold",
        usedFallback: true,
        retryCount: config.aiProvider.maxRetries,
        assumptions: 0,
        warnings: 2,
      };

      metricsCollector.recordParseAttempt(failedAttempt);

      // Generate diagnostic report
      const report = diagnosticAnalyzer.generateReport();

      expect(report.summary.totalAttempts).toBe(1);
      expect(report.summary.successRate).toBe(0);
      expect(report.detailedAnalysis.fallbackUsage.frequency).toBe(1);

      // Should recommend lowering confidence threshold
      expect(report.recommendations).toContain(
        "Consider improving format detection patterns or lowering confidence threshold"
      );

      // Should suggest config changes
      expect(
        report.configSuggestions.formatDetection?.confidenceThreshold
      ).toBeLessThan(0.9);
    });
  });

  describe("Performance Monitoring with Configuration", () => {
    it("should track performance against configuration thresholds", () => {
      configManager.updateConfig({
        aiProvider: {
          maxRetries: 3,
          temperature: 0.1,
          enableValidationRetries: true,
          timeoutMs: 3000,
        },
        monitoring: {
          enableMetrics: true,
          enableDiagnostics: false,
          logLevel: "info",
          metricsRetentionMs: 24 * 60 * 60 * 1000,
        },
      });

      const config = configManager.getConfig();

      // Create attempts that exceed configured timeout
      const slowAttempts: ParseAttempt[] = [
        {
          id: "slow-1",
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.8,
          responseTimeMs: 4000, // Exceeds timeout
          success: false,
          errorType: "timeout",
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        },
        {
          id: "slow-2",
          timestamp: Date.now(),
          inputLength: 100,
          detectedFormat: "json",
          confidence: 0.8,
          responseTimeMs: 5000, // Exceeds timeout
          success: false,
          errorType: "timeout",
          usedFallback: false,
          retryCount: 0,
          assumptions: 0,
          warnings: 0,
        },
      ];

      slowAttempts.forEach((attempt) =>
        metricsCollector.recordParseAttempt(attempt)
      );

      const report = diagnosticAnalyzer.generateReport();

      // Should detect timeout issues
      expect(report.summary.mostCommonErrors[0].type).toBe("timeout");
      expect(report.configSuggestions.aiProvider?.timeoutMs).toBeGreaterThan(
        config.aiProvider.timeoutMs
      );
    });
  });

  describe("Configuration Validation with Monitoring Data", () => {
    it("should validate configuration against actual performance data", () => {
      // Set unrealistic configuration
      const unrealisticConfig = {
        aiProvider: {
          maxRetries: 0, // No retries
          temperature: 0.1,
          enableValidationRetries: true,
          timeoutMs: 100, // Very short timeout
        },
        formatDetection: {
          confidenceThreshold: 0.99, // Very high threshold
          enableMultiFormatDetection: true,
          enablePatternMatching: true,
        },
      };

      configManager.updateConfig(unrealisticConfig);

      // Simulate realistic performance data
      const realisticAttempts: ParseAttempt[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `realistic-${i}`,
          timestamp: Date.now(),
          inputLength: 200,
          detectedFormat: "mixed",
          confidence: 0.8, // Below configured threshold
          responseTimeMs: 2000, // Above configured timeout
          success: i < 3, // 30% success rate
          errorType: i >= 3 ? "timeout" : undefined,
          usedFallback: i >= 3,
          retryCount: 0, // Can't retry due to config
          assumptions: 2,
          warnings: 1,
        })
      );

      realisticAttempts.forEach((attempt) =>
        metricsCollector.recordParseAttempt(attempt)
      );

      const report = diagnosticAnalyzer.generateReport();

      // Should recommend more realistic configuration
      expect(report.configSuggestions.aiProvider?.timeoutMs).toBeGreaterThan(
        100
      );
      expect(
        report.configSuggestions.formatDetection?.confidenceThreshold
      ).toBeLessThan(0.99);

      expect(report.recommendations).toContain(
        "Response times are high - consider optimizing AI provider settings or input preprocessing"
      );
    });
  });

  describe("Export and Import Configuration with Monitoring", () => {
    it("should export comprehensive system state", () => {
      // Configure system
      configManager.updateConfig({
        monitoring: {
          enableMetrics: true,
          enableDiagnostics: false,
          logLevel: "debug",
          metricsRetentionMs: 24 * 60 * 60 * 1000,
        },
      });

      // Generate some data
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
        assumptions: 1,
        warnings: 0,
      };

      metricsCollector.recordParseAttempt(attempt);

      // Export everything
      const systemState = {
        configuration: configManager.getConfig(),
        diagnosticData: diagnosticAnalyzer.exportDiagnosticData(),
        metricsData: metricsCollector.exportData(),
      };

      expect(systemState.configuration.monitoring.enableMetrics).toBe(true);
      expect(systemState.diagnosticData.rawData.attempts).toHaveLength(1);
      expect(systemState.metricsData.metrics.totalRequests).toBe(1);
    });
  });
});
