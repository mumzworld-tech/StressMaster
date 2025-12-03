/**
 * Integration tests for the unified configuration system
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ConfigurationManager,
  getConfigManager,
  getConfig,
  validateEnvironment,
  createTestConfig,
} from "../../src/config";

describe("Unified Configuration Integration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should load configuration from multiple sources with correct priority", () => {
    // Set environment variables (highest priority)
    process.env.MODEL_NAME = "env-model";
    process.env.LOG_LEVEL = "debug";
    process.env.APP_PORT = "4000";

    const configManager = new ConfigurationManager();
    const config = configManager.getConfig();

    // Environment variables should override file config
    expect(config.ai.model).toBe("env-model");
    expect(config.logging.level).toBe("debug");
    expect(config.application.port).toBe(4000);

    // File config should be used where env vars are not set
    // (ai-config.json has provider: "openai")
    expect(config.ai.provider).toBe("openai");
  });

  it("should validate configuration and provide helpful errors", () => {
    process.env.APP_PORT = "invalid";
    process.env.LOG_LEVEL = "invalid";

    const validation = validateEnvironment();

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("APP_PORT must be a valid number");
    expect(validation.errors).toContain(
      "LOG_LEVEL must be one of: debug, info, warn, error"
    );
  });

  it("should support configuration updates and notifications", () => {
    const configManager = getConfigManager();
    let notificationCount = 0;

    const listener = () => {
      notificationCount++;
    };

    configManager.addListener(listener);

    configManager.updateConfig({
      logging: {
        level: "warn",
        format: "text",
        enableMetrics: false,
        enableDiagnostics: true,
      },
    });

    expect(notificationCount).toBe(1);

    const config = configManager.getConfig();
    expect(config.logging.level).toBe("warn");
    expect(config.logging.format).toBe("text");

    configManager.removeListener(listener);
  });

  it("should provide backward compatibility with legacy configuration", () => {
    const config = getConfig();

    // Should have all required sections
    expect(config.application).toBeDefined();
    expect(config.ai).toBeDefined();
    expect(config.execution).toBeDefined();
    expect(config.logging).toBeDefined();
    expect(config.cli).toBeDefined();
    expect(config.parser).toBeDefined();

    // Parser config should be accessible for backward compatibility
    expect(config.parser.preprocessing).toBeDefined();
    expect(config.parser.aiProvider).toBeDefined();
    expect(config.parser.monitoring).toBeDefined();
  });

  it("should create test configurations properly", () => {
    const testConfig = createTestConfig({
      ai: {
        provider: "claude",
        model: "test-model",
      },
      logging: {
        level: "debug",
      },
    });

    expect(testConfig.application.nodeEnv).toBe("test");
    expect(testConfig.ai.provider).toBe("claude");
    expect(testConfig.ai.model).toBe("test-model");
    expect(testConfig.ai.timeout).toBe(5000); // Test default
    expect(testConfig.logging.level).toBe("debug"); // Override
    expect(testConfig.logging.enableMetrics).toBe(false); // Test default
  });

  it("should export configuration for debugging", () => {
    const configManager = getConfigManager();
    const exported = configManager.exportConfiguration();

    expect(exported.current).toBeDefined();
    expect(exported.sources).toHaveLength(4);
    expect(exported.validation).toBeDefined();

    // Check source priorities
    const sources = exported.sources;
    const envSource = sources.find((s) => s.name === "environment");
    const fileSource = sources.find((s) => s.name === "ai-config-file");
    const packageSource = sources.find((s) => s.name === "package-config");
    const defaultSource = sources.find((s) => s.name === "defaults");

    expect(envSource).toBeDefined();
    expect(fileSource).toBeDefined();
    expect(packageSource).toBeDefined();
    expect(defaultSource).toBeDefined();
  });

  it("should handle Docker configuration from environment", () => {
    process.env.DOCKER_HOST = "tcp://test-host:2376";
    process.env.DOCKER_TLS_VERIFY = "1";
    process.env.DOCKER_CERT_PATH = "/test/certs";

    const configManager = new ConfigurationManager();
    const config = configManager.getConfig();

    expect(config.security?.dockerHost).toBe("tcp://test-host:2376");
    expect(config.security?.dockerTlsVerify).toBe(true);
    expect(config.security?.dockerCertPath).toBe("/test/certs");
  });

  it("should handle production environment warnings", () => {
    process.env.NODE_ENV = "production";
    delete process.env.MODEL_NAME;
    delete process.env.OLLAMA_HOST;

    const validation = validateEnvironment();

    expect(validation.warnings).toContain(
      "MODEL_NAME not set, using default model"
    );
    expect(validation.warnings).toContain(
      "OLLAMA_HOST not set, using localhost"
    );
  });
});
