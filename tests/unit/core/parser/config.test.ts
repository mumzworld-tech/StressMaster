/**
 * Tests for the unified parser configuration system
 */

import { describe, it, expect } from "vitest";
import {
  ParserConfig,
  DEFAULT_PARSER_CONFIG,
  ParserConfigManager,
  ParsingMetricsCollector,
  ParsingPerformanceMonitor,
  ParsingDiagnosticAnalyzer,
  UnifiedParserSystem,
  ParseAttempt,
} from "../../../src/../../src/core/parser/config";

describe("Unified Parser Configuration System", () => {
  describe("ParserConfig", () => {
    it("should have valid default configuration", () => {
      expect(DEFAULT_PARSER_CONFIG).toBeDefined();
      expect(DEFAULT_PARSER_CONFIG.preprocessing).toBeDefined();
      expect(DEFAULT_PARSER_CONFIG.formatDetection).toBeDefined();
      expect(DEFAULT_PARSER_CONFIG.contextEnhancement).toBeDefined();
      expect(DEFAULT_PARSER_CONFIG.aiProvider).toBeDefined();
      expect(DEFAULT_PARSER_CONFIG.fallback).toBeDefined();
      expect(DEFAULT_PARSER_CONFIG.monitoring).toBeDefined();
    });

    it("should have reasonable default values", () => {
      expect(DEFAULT_PARSER_CONFIG.preprocessing.maxInputLength).toBe(10000);
      expect(DEFAULT_PARSER_CONFIG.formatDetection.confidenceThreshold).toBe(
        0.7
      );
      expect(DEFAULT_PARSER_CONFIG.aiProvider.maxRetries).toBe(3);
      expect(DEFAULT_PARSER_CONFIG.aiProvider.temperature).toBe(0.1);
      expect(DEFAULT_PARSER_CONFIG.monitoring.enableMetrics).toBe(true);
    });
  });

  describe("ParserConfigManager", () => {
    it("should initialize with default config", () => {
      const manager = new ParserConfigManager();
      const config = manager.getConfig();

      expect(config).toEqual(DEFAULT_PARSER_CONFIG);
    });

    it("should merge partial configuration", () => {
      const manager = new ParserConfigManager({
        aiProvider: {
          maxRetries: 5,
          temperature: 0.2,
          enableValidationRetries: true,
          timeoutMs: 30000,
        },
      });

      const config = manager.getConfig();
      expect(config.aiProvider.maxRetries).toBe(5);
      expect(config.aiProvider.temperature).toBe(0.2);
      expect(config.aiProvider.timeoutMs).toBe(
        DEFAULT_PARSER_CONFIG.aiProvider.timeoutMs
      );
    });

    it("should validate configuration", () => {
      const manager = new ParserConfigManager();

      const invalidConfig: ParserConfig = {
        ...DEFAULT_PARSER_CONFIG,
        aiProvider: {
          ...DEFAULT_PARSER_CONFIG.aiProvider,
          temperature: 3.0, // Invalid: > 2
        },
      };

      const errors = manager.validateConfig(invalidConfig);
      expect(errors).toContain(
        "aiProvider.temperature must be between 0 and 2"
      );
    });
  });

  describe("UnifiedParserSystem", () => {
    it("should initialize all components", () => {
      const system = new UnifiedParserSystem();

      expect(system.getConfigManager()).toBeInstanceOf(ParserConfigManager);
      expect(system.getMetricsCollector()).toBeInstanceOf(
        ParsingMetricsCollector
      );
      expect(system.getPerformanceMonitor()).toBeInstanceOf(
        ParsingPerformanceMonitor
      );
      expect(system.getDiagnosticAnalyzer()).toBeInstanceOf(
        ParsingDiagnosticAnalyzer
      );
    });

    it("should provide system status", () => {
      const system = new UnifiedParserSystem();
      const status = system.getSystemStatus();

      expect(status.config).toBeDefined();
      expect(status.metrics).toBeDefined();
      expect(status.activeOperations).toEqual([]);
      expect(status.isHealthy).toBe(true); // No requests yet, should be healthy
    });

    it("should update configuration and recreate components", () => {
      const system = new UnifiedParserSystem();
      const originalCollector = system.getMetricsCollector();

      system.updateConfig({
        monitoring: {
          enableMetrics: true,
          enableDiagnostics: false,
          logLevel: "info",
          metricsRetentionMs: 48 * 60 * 60 * 1000, // 48 hours
        },
      });

      const newCollector = system.getMetricsCollector();
      expect(newCollector).not.toBe(originalCollector); // Should be a new instance

      const config = system.getConfig();
      expect(config.monitoring.metricsRetentionMs).toBe(48 * 60 * 60 * 1000);
    });
  });

  describe("Integration", () => {
    it("should work with metrics collection", () => {
      const system = new UnifiedParserSystem();
      const metricsCollector = system.getMetricsCollector();

      const parseAttempt: ParseAttempt = {
        id: "test-1",
        timestamp: Date.now(),
        inputLength: 100,
        detectedFormat: "json",
        confidence: 0.9,
        responseTimeMs: 500,
        success: true,
        usedFallback: false,
        retryCount: 0,
        assumptions: 0,
        warnings: 0,
      };

      metricsCollector.recordParseAttempt(parseAttempt);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulParses).toBe(1);
      expect(metrics.averageResponseTime).toBe(500);
    });

    it("should work with performance monitoring", () => {
      const system = new UnifiedParserSystem();
      const performanceMonitor = system.getPerformanceMonitor();
      const metricsCollector = system.getMetricsCollector();

      const parseAttemptId = "test-perf-1";

      performanceMonitor.startStage(parseAttemptId, "preprocessing");

      // Simulate some processing time
      setTimeout(() => {
        performanceMonitor.endStage(parseAttemptId, "preprocessing", true, {
          inputLength: 100,
        });

        const diagnostics = metricsCollector.getDiagnostics(parseAttemptId);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].stage).toBe("preprocessing");
        expect(diagnostics[0].success).toBe(true);
      }, 10);
    });
  });
});
