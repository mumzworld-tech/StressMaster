import { describe, it, expect, beforeEach } from "vitest";
import {
  SmartParserConfig,
  SmartParserConfigManager,
  DEFAULT_SMART_PARSER_CONFIG,
} from "../../../src/core/parser/config";

describe("SmartParserConfig", () => {
  let configManager: SmartParserConfigManager;

  beforeEach(() => {
    configManager = new SmartParserConfigManager();
  });

  describe("DEFAULT_SMART_PARSER_CONFIG", () => {
    it("should have valid default values", () => {
      expect(DEFAULT_SMART_PARSER_CONFIG.preprocessing.enableSanitization).toBe(
        true
      );
      expect(DEFAULT_SMART_PARSER_CONFIG.preprocessing.maxInputLength).toBe(
        10000
      );
      expect(
        DEFAULT_SMART_PARSER_CONFIG.formatDetection.confidenceThreshold
      ).toBe(0.7);
      expect(DEFAULT_SMART_PARSER_CONFIG.aiProvider.maxRetries).toBe(3);
      expect(DEFAULT_SMART_PARSER_CONFIG.monitoring.enableMetrics).toBe(true);
    });

    it("should have all required configuration sections", () => {
      expect(DEFAULT_SMART_PARSER_CONFIG).toHaveProperty("preprocessing");
      expect(DEFAULT_SMART_PARSER_CONFIG).toHaveProperty("formatDetection");
      expect(DEFAULT_SMART_PARSER_CONFIG).toHaveProperty("contextEnhancement");
      expect(DEFAULT_SMART_PARSER_CONFIG).toHaveProperty("aiProvider");
      expect(DEFAULT_SMART_PARSER_CONFIG).toHaveProperty("fallback");
      expect(DEFAULT_SMART_PARSER_CONFIG).toHaveProperty("monitoring");
    });
  });

  describe("SmartParserConfigManager", () => {
    it("should initialize with default config", () => {
      const config = configManager.getConfig();
      expect(config).toEqual(DEFAULT_SMART_PARSER_CONFIG);
    });

    it("should initialize with partial override config", () => {
      const override = {
        preprocessing: {
          maxInputLength: 5000,
        },
        aiProvider: {
          maxRetries: 5,
        },
      };

      const manager = new SmartParserConfigManager(override);
      const config = manager.getConfig();

      expect(config.preprocessing.maxInputLength).toBe(5000);
      expect(config.aiProvider.maxRetries).toBe(5);
      expect(config.preprocessing.enableSanitization).toBe(true); // Should keep default
    });

    it("should update config with partial updates", () => {
      const update = {
        formatDetection: {
          confidenceThreshold: 0.8,
        },
      };

      configManager.updateConfig(update);
      const config = configManager.getConfig();

      expect(config.formatDetection.confidenceThreshold).toBe(0.8);
      expect(config.formatDetection.enableMultiFormatDetection).toBe(true); // Should keep existing
    });

    it("should reset to defaults", () => {
      configManager.updateConfig({
        preprocessing: { maxInputLength: 1000 },
      });

      configManager.resetToDefaults();
      const config = configManager.getConfig();

      expect(config).toEqual(DEFAULT_SMART_PARSER_CONFIG);
    });

    it("should return a copy of config to prevent mutation", () => {
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();

      config1.preprocessing.maxInputLength = 999;
      expect(config2.preprocessing.maxInputLength).toBe(10000);
    });
  });

  describe("Configuration Validation", () => {
    it("should validate valid configuration", () => {
      const errors = configManager.validateConfig(DEFAULT_SMART_PARSER_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it("should detect invalid maxInputLength", () => {
      const invalidConfig = {
        ...DEFAULT_SMART_PARSER_CONFIG,
        preprocessing: {
          ...DEFAULT_SMART_PARSER_CONFIG.preprocessing,
          maxInputLength: -1,
        },
      };

      const errors = configManager.validateConfig(invalidConfig);
      expect(errors).toContain(
        "preprocessing.maxInputLength must be greater than 0"
      );
    });

    it("should detect invalid confidence threshold", () => {
      const invalidConfig = {
        ...DEFAULT_SMART_PARSER_CONFIG,
        formatDetection: {
          ...DEFAULT_SMART_PARSER_CONFIG.formatDetection,
          confidenceThreshold: 1.5,
        },
      };

      const errors = configManager.validateConfig(invalidConfig);
      expect(errors).toContain(
        "formatDetection.confidenceThreshold must be between 0 and 1"
      );
    });

    it("should detect invalid temperature", () => {
      const invalidConfig = {
        ...DEFAULT_SMART_PARSER_CONFIG,
        aiProvider: {
          ...DEFAULT_SMART_PARSER_CONFIG.aiProvider,
          temperature: 3.0,
        },
      };

      const errors = configManager.validateConfig(invalidConfig);
      expect(errors).toContain(
        "aiProvider.temperature must be between 0 and 2"
      );
    });

    it("should detect multiple validation errors", () => {
      const invalidConfig = {
        ...DEFAULT_SMART_PARSER_CONFIG,
        preprocessing: {
          ...DEFAULT_SMART_PARSER_CONFIG.preprocessing,
          maxInputLength: 0,
        },
        aiProvider: {
          ...DEFAULT_SMART_PARSER_CONFIG.aiProvider,
          maxRetries: -1,
          timeoutMs: 0,
        },
      };

      const errors = configManager.validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(1);
      expect(errors).toContain(
        "preprocessing.maxInputLength must be greater than 0"
      );
      expect(errors).toContain("aiProvider.maxRetries must be non-negative");
      expect(errors).toContain("aiProvider.timeoutMs must be greater than 0");
    });
  });

  describe("Configuration Merging", () => {
    it("should merge nested configuration objects correctly", () => {
      const override = {
        preprocessing: {
          enableSanitization: false,
          maxInputLength: 8000,
        },
        monitoring: {
          logLevel: "debug" as const,
        },
      };

      const manager = new SmartParserConfigManager(override);
      const config = manager.getConfig();

      expect(config.preprocessing.enableSanitization).toBe(false);
      expect(config.preprocessing.maxInputLength).toBe(8000);
      expect(config.preprocessing.enableStructureExtraction).toBe(true); // Should keep default
      expect(config.monitoring.logLevel).toBe("debug");
      expect(config.monitoring.enableMetrics).toBe(true); // Should keep default
    });

    it("should handle deep partial updates", () => {
      configManager.updateConfig({
        contextEnhancement: {
          maxAmbiguities: 10,
        },
      });

      const config = configManager.getConfig();
      expect(config.contextEnhancement.maxAmbiguities).toBe(10);
      expect(config.contextEnhancement.enableInference).toBe(true); // Should keep existing
      expect(config.contextEnhancement.enableAmbiguityResolution).toBe(true); // Should keep existing
    });
  });

  describe("Configuration Edge Cases", () => {
    it("should handle empty partial config", () => {
      const manager = new SmartParserConfigManager({});
      const config = manager.getConfig();
      expect(config).toEqual(DEFAULT_SMART_PARSER_CONFIG);
    });

    it("should handle undefined partial config", () => {
      const manager = new SmartParserConfigManager(undefined);
      const config = manager.getConfig();
      expect(config).toEqual(DEFAULT_SMART_PARSER_CONFIG);
    });

    it("should handle empty update", () => {
      configManager.updateConfig({});
      const config = configManager.getConfig();
      expect(config).toEqual(DEFAULT_SMART_PARSER_CONFIG);
    });
  });
});
