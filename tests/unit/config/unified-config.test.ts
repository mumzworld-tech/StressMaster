/**
 * Tests for the unified configuration system
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ConfigurationManager,
  getConfigManager,
  getConfig,
  getAIConfig,
  getExecutionConfig,
  getLoggingConfig,
  getCLIConfig,
  getParserConfig,
  createTestConfig,
  validateEnvironment,
  StressMasterConfig,
  DEFAULT_CONFIG,
  DEFAULT_AI_CONFIG,
  DEFAULT_EXECUTION_CONFIG,
  DEFAULT_LOGGING_CONFIG,
  DEFAULT_CLI_CONFIG,
  DEFAULT_APPLICATION_CONFIG,
} from "../../../src/config";

describe("Unified Configuration System", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Default Configuration", () => {
    it("should have valid default configuration", () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.application).toEqual(DEFAULT_APPLICATION_CONFIG);
      expect(DEFAULT_CONFIG.ai).toEqual(DEFAULT_AI_CONFIG);
      expect(DEFAULT_CONFIG.execution).toEqual(DEFAULT_EXECUTION_CONFIG);
      expect(DEFAULT_CONFIG.logging).toEqual(DEFAULT_LOGGING_CONFIG);
      expect(DEFAULT_CONFIG.cli).toEqual(DEFAULT_CLI_CONFIG);
    });

    it("should have reasonable default values", () => {
      expect(DEFAULT_AI_CONFIG.provider).toBe("ollama");
      expect(DEFAULT_AI_CONFIG.model).toBe("llama3.2:1b");
      expect(DEFAULT_AI_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_AI_CONFIG.timeout).toBe(30000);

      expect(DEFAULT_EXECUTION_CONFIG.maxConcurrentTests).toBe(5);
      expect(DEFAULT_EXECUTION_CONFIG.defaultTimeout).toBe(300000);

      expect(DEFAULT_LOGGING_CONFIG.level).toBe("info");
      expect(DEFAULT_LOGGING_CONFIG.enableMetrics).toBe(true);

      expect(DEFAULT_CLI_CONFIG.interactive).toBe(true);
      expect(DEFAULT_CLI_CONFIG.outputFormat).toBe("json");
    });
  });

  describe("ConfigurationManager", () => {
    let configManager: ConfigurationManager;

    beforeEach(() => {
      configManager = new ConfigurationManager();
    });

    it("should initialize with configuration from all sources", () => {
      const config = configManager.getConfig();
      // The config will be loaded from ai-config.json if it exists
      expect(config.ai.provider).toBeDefined();
      expect(config.execution.maxConcurrentTests).toBe(5);
      expect(config.logging.level).toBe("info");
    });

    it("should provide section-specific getters", () => {
      const aiConfig = configManager.getAIConfig();
      const executionConfig = configManager.getExecutionConfig();
      const loggingConfig = configManager.getLoggingConfig();
      const cliConfig = configManager.getCLIConfig();
      const parserConfig = configManager.getParserConfig();

      expect(aiConfig.provider).toBeDefined();
      expect(executionConfig.maxConcurrentTests).toBe(5);
      expect(loggingConfig.level).toBe("info");
      expect(cliConfig.interactive).toBe(true);
      expect(parserConfig).toBeDefined();
    });

    it("should update configuration", () => {
      configManager.updateConfig({
        ai: {
          provider: "openai" as const,
          model: "gpt-4",
          maxRetries: DEFAULT_AI_CONFIG.maxRetries,
          timeout: DEFAULT_AI_CONFIG.timeout,
        },
      });

      const config = configManager.getConfig();
      expect(config.ai.provider).toBe("openai");
      expect(config.ai.model).toBe("gpt-4");
      expect(config.ai.maxRetries).toBe(3); // Should keep default
    });

    it("should validate configuration", () => {
      const errors = configManager.validateConfiguration();
      expect(errors).toHaveLength(0);

      configManager.updateConfig({
        ai: {
          provider: DEFAULT_AI_CONFIG.provider,
          model: DEFAULT_AI_CONFIG.model,
          maxRetries: DEFAULT_AI_CONFIG.maxRetries,
          timeout: -1,
        },
      });

      const errorsAfterUpdate = configManager.validateConfiguration();
      expect(errorsAfterUpdate.length).toBeGreaterThan(0);
      expect(errorsAfterUpdate).toContain("AI timeout must be greater than 0");
    });

    it("should support configuration listeners", () => {
      let notificationReceived = false;
      let receivedConfig: StressMasterConfig | null = null;

      const listener = (config: StressMasterConfig) => {
        notificationReceived = true;
        receivedConfig = config;
      };

      configManager.addListener(listener);
      configManager.updateConfig({
        logging: {
          level: "debug" as const,
          format: DEFAULT_LOGGING_CONFIG.format,
          enableMetrics: DEFAULT_LOGGING_CONFIG.enableMetrics,
          enableDiagnostics: DEFAULT_LOGGING_CONFIG.enableDiagnostics,
        },
      });

      expect(notificationReceived).toBe(true);
      expect(receivedConfig).not.toBeNull();
      expect(receivedConfig!.logging.level).toBe("debug");

      configManager.removeListener(listener);
    });

    it("should export configuration for debugging", () => {
      const exported = configManager.exportConfiguration();

      expect(exported.current).toBeDefined();
      expect(exported.sources).toBeDefined();
      expect(exported.validation).toBeDefined();
      expect(Array.isArray(exported.sources)).toBe(true);
      expect(Array.isArray(exported.validation)).toBe(true);
    });
  });

  describe("Environment Variable Configuration", () => {
    it("should load configuration from environment variables", () => {
      process.env.NODE_ENV = "development";
      process.env.MODEL_NAME = "gpt-3.5-turbo";
      process.env.OLLAMA_HOST = "remote-host";
      process.env.OLLAMA_PORT = "11435";
      process.env.LOG_LEVEL = "debug";

      const configManager = new ConfigurationManager();
      const config = configManager.getConfig();

      expect(config.application.nodeEnv).toBe("development");
      expect(config.ai.model).toBe("gpt-3.5-turbo");
      expect(config.ai.endpoint).toBe("http://remote-host:11435");
      expect(config.logging.level).toBe("debug");
    });

    it("should handle Docker configuration from environment", () => {
      process.env.DOCKER_HOST = "tcp://docker-host:2376";
      process.env.DOCKER_TLS_VERIFY = "1";
      process.env.DOCKER_CERT_PATH = "/certs";

      const configManager = new ConfigurationManager();
      const config = configManager.getConfig();

      expect(config.security?.dockerHost).toBe("tcp://docker-host:2376");
      expect(config.security?.dockerTlsVerify).toBe(true);
      expect(config.security?.dockerCertPath).toBe("/certs");
    });
  });

  describe("Global Configuration Functions", () => {
    it("should provide global configuration access", () => {
      const config = getConfig();
      const aiConfig = getAIConfig();
      const executionConfig = getExecutionConfig();
      const loggingConfig = getLoggingConfig();
      const cliConfig = getCLIConfig();
      const parserConfig = getParserConfig();

      expect(config).toBeDefined();
      expect(aiConfig).toBeDefined();
      expect(executionConfig).toBeDefined();
      expect(loggingConfig).toBeDefined();
      expect(cliConfig).toBeDefined();
      expect(parserConfig).toBeDefined();
    });

    it("should return the same configuration manager instance", () => {
      const manager1 = getConfigManager();
      const manager2 = getConfigManager();

      expect(manager1).toBe(manager2);
    });
  });

  describe("Test Configuration", () => {
    it("should create test configuration with overrides", () => {
      const testConfig = createTestConfig({
        ai: {
          provider: "openai" as const,
          model: "gpt-4",
          maxRetries: 3,
          timeout: 5000,
        },
      });

      expect(testConfig.application.nodeEnv).toBe("test");
      expect(testConfig.logging.level).toBe("error");
      expect(testConfig.ai.provider).toBe("openai");
      expect(testConfig.ai.timeout).toBe(5000); // Test default
    });

    it("should create test configuration with defaults", () => {
      const testConfig = createTestConfig();

      expect(testConfig.application.nodeEnv).toBe("test");
      expect(testConfig.logging.level).toBe("error");
      expect(testConfig.logging.enableMetrics).toBe(false);
      expect(testConfig.ai.timeout).toBe(5000);
    });
  });

  describe("Environment Validation", () => {
    it("should validate valid environment", () => {
      process.env.NODE_ENV = "production";
      process.env.MODEL_NAME = "llama3.2:1b";
      process.env.LOG_LEVEL = "info";

      const validation = validateEnvironment();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect invalid environment variables", () => {
      process.env.APP_PORT = "invalid-port";
      process.env.LOG_LEVEL = "invalid-level";

      const validation = validateEnvironment();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain("APP_PORT must be a valid number");
      expect(validation.errors).toContain(
        "LOG_LEVEL must be one of: debug, info, warn, error"
      );
    });

    it("should provide warnings for missing production variables", () => {
      process.env.NODE_ENV = "production";
      delete process.env.MODEL_NAME;
      delete process.env.OLLAMA_HOST;

      const validation = validateEnvironment();

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings).toContain(
        "MODEL_NAME not set, using default model"
      );
      expect(validation.warnings).toContain(
        "OLLAMA_HOST not set, using localhost"
      );
    });
  });

  describe("Backward Compatibility", () => {
    it("should export legacy configuration types", () => {
      // These should be available for backward compatibility
      const config = getConfig();
      expect(config.parser).toBeDefined();
    });

    it("should support legacy parser configuration access", () => {
      const parserConfig = getParserConfig();
      expect(parserConfig).toBeDefined();
      expect(parserConfig.preprocessing).toBeDefined();
      expect(parserConfig.aiProvider).toBeDefined();
    });
  });

  describe("Configuration Sources Priority", () => {
    it("should prioritize environment variables over file configuration", () => {
      // Set environment variable that should override file config
      process.env.MODEL_NAME = "env-model";

      const configManager = new ConfigurationManager();
      const config = configManager.getConfig();

      expect(config.ai.model).toBe("env-model");
    });

    it("should list configuration sources with priorities", () => {
      const configManager = new ConfigurationManager();
      const sources = configManager.getConfigurationSources();

      expect(sources).toHaveLength(4);
      expect(sources.find((s) => s.name === "environment")?.priority).toBe(4);
      expect(sources.find((s) => s.name === "ai-config-file")?.priority).toBe(
        3
      );
      expect(sources.find((s) => s.name === "package-config")?.priority).toBe(
        2
      );
      expect(sources.find((s) => s.name === "defaults")?.priority).toBe(1);
    });
  });
});
