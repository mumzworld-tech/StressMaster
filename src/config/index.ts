/**
 * Unified Configuration System for StressMaster
 *
 * This module consolidates all configuration handling into a single system
 * while maintaining backward compatibility with existing configuration files.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ParserConfig, DEFAULT_PARSER_CONFIG } from "../core/parser/config";

// ============================================================================
// Core Configuration Interfaces
// ============================================================================

export interface AIProviderConfig {
  provider: "ollama" | "openai" | "claude" | "gemini";
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxRetries: number;
  timeout: number;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    [key: string]: any;
  };
}

export interface ExecutionConfig {
  maxConcurrentTests: number;
  defaultTimeout: number;
  resourceLimits: {
    memory: string;
    cpu: string;
  };
  k6: {
    runnerImage: string;
    memoryLimit: string;
  };
  directories: {
    data: string;
    scripts: string;
    results: string;
  };
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
  enableMetrics: boolean;
  enableDiagnostics: boolean;
}

export interface CLIConfig {
  interactive: boolean;
  verbose: boolean;
  outputFormat: "json" | "csv" | "html";
  historyFile?: string;
  maxHistoryEntries: number;
  autoComplete: boolean;
}

export interface SecurityConfig {
  dockerHost?: string;
  dockerTlsVerify?: boolean;
  dockerCertPath?: string;
}

export interface ApplicationConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  restartPolicy: string;
  composeProjectName: string;
}

/**
 * Main configuration interface that combines all subsystem configurations
 */
export interface StressMasterConfig {
  application: ApplicationConfig;
  ai: AIProviderConfig;
  execution: ExecutionConfig;
  logging: LoggingConfig;
  cli: CLIConfig;
  parser: ParserConfig;
  security?: SecurityConfig;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  provider: "ollama",
  endpoint: "http://localhost:11434",
  model: "llama3.2:1b",
  maxRetries: 3,
  timeout: 30000,
  options: {
    temperature: 0.1,
    top_p: 0.9,
  },
};

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxConcurrentTests: 5,
  defaultTimeout: 300000, // 5 minutes
  resourceLimits: {
    memory: "2g",
    cpu: "1.0",
  },
  k6: {
    runnerImage: "grafana/k6:latest",
    memoryLimit: "2g",
  },
  directories: {
    data: "/app/data",
    scripts: "/app/scripts/k6",
    results: "/app/results",
  },
};

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: "info",
  format: "json",
  enableMetrics: true,
  enableDiagnostics: false,
};

export const DEFAULT_CLI_CONFIG: CLIConfig = {
  interactive: true,
  verbose: false,
  outputFormat: "json",
  maxHistoryEntries: 1000,
  autoComplete: true,
};

export const DEFAULT_APPLICATION_CONFIG: ApplicationConfig = {
  nodeEnv: "production",
  port: 3000,
  restartPolicy: "unless-stopped",
  composeProjectName: "stressmaster",
};

export const DEFAULT_CONFIG: StressMasterConfig = {
  application: DEFAULT_APPLICATION_CONFIG,
  ai: DEFAULT_AI_CONFIG,
  execution: DEFAULT_EXECUTION_CONFIG,
  logging: DEFAULT_LOGGING_CONFIG,
  cli: DEFAULT_CLI_CONFIG,
  parser: DEFAULT_PARSER_CONFIG,
};

// ============================================================================
// Configuration Sources
// ============================================================================

interface ConfigSource {
  name: string;
  priority: number;
  load(): Partial<StressMasterConfig>;
}

/**
 * Environment variables configuration source
 */
class EnvironmentConfigSource implements ConfigSource {
  name = "environment";
  priority = 4; // Highest priority

  load(): Partial<StressMasterConfig> {
    const config: any = {};

    // Application configuration
    if (process.env.NODE_ENV) {
      config.application = {
        ...DEFAULT_APPLICATION_CONFIG,
        nodeEnv: process.env.NODE_ENV as "development" | "production" | "test",
      };
    }

    if (process.env.APP_PORT) {
      config.application = {
        ...config.application,
        ...DEFAULT_APPLICATION_CONFIG,
        port: parseInt(process.env.APP_PORT, 10),
      };
    }

    if (process.env.COMPOSE_PROJECT_NAME) {
      config.application = {
        ...config.application,
        ...DEFAULT_APPLICATION_CONFIG,
        composeProjectName: process.env.COMPOSE_PROJECT_NAME,
      };
    }

    if (process.env.RESTART_POLICY) {
      config.application = {
        ...config.application,
        ...DEFAULT_APPLICATION_CONFIG,
        restartPolicy: process.env.RESTART_POLICY,
      };
    }

    // AI configuration - only set values that are explicitly provided
    const aiOverrides: Partial<AIProviderConfig> = {};

    if (process.env.MODEL_NAME) {
      aiOverrides.model = process.env.MODEL_NAME;
    }

    if (process.env.OLLAMA_HOST && process.env.OLLAMA_PORT) {
      aiOverrides.endpoint = `http://${process.env.OLLAMA_HOST}:${process.env.OLLAMA_PORT}`;
    }

    if (Object.keys(aiOverrides).length > 0) {
      config.ai = aiOverrides;
    }

    // Execution configuration
    if (process.env.K6_RUNNER_IMAGE || process.env.K6_MEMORY_LIMIT) {
      config.execution = {
        ...DEFAULT_EXECUTION_CONFIG,
      };

      if (process.env.K6_RUNNER_IMAGE) {
        config.execution.k6.runnerImage = process.env.K6_RUNNER_IMAGE;
      }

      if (process.env.K6_MEMORY_LIMIT) {
        config.execution.k6.memoryLimit = process.env.K6_MEMORY_LIMIT;
      }

      if (process.env.OLLAMA_MEMORY_LIMIT) {
        config.execution.resourceLimits.memory =
          process.env.OLLAMA_MEMORY_LIMIT;
      }

      if (process.env.APP_MEMORY_LIMIT) {
        // Use for general resource limits
        config.execution.resourceLimits.memory = process.env.APP_MEMORY_LIMIT;
      }
    }

    // Directory configuration
    if (
      process.env.DATA_DIR ||
      process.env.SCRIPTS_DIR ||
      process.env.RESULTS_DIR
    ) {
      config.execution = {
        ...config.execution,
        ...DEFAULT_EXECUTION_CONFIG,
        directories: {
          data:
            process.env.DATA_DIR || DEFAULT_EXECUTION_CONFIG.directories.data,
          scripts:
            process.env.SCRIPTS_DIR ||
            DEFAULT_EXECUTION_CONFIG.directories.scripts,
          results:
            process.env.RESULTS_DIR ||
            DEFAULT_EXECUTION_CONFIG.directories.results,
        },
      };
    }

    // Logging configuration
    if (process.env.LOG_LEVEL || process.env.LOG_FORMAT) {
      config.logging = {
        ...DEFAULT_LOGGING_CONFIG,
      };

      if (process.env.LOG_LEVEL) {
        config.logging.level = process.env.LOG_LEVEL as
          | "debug"
          | "info"
          | "warn"
          | "error";
      }

      if (process.env.LOG_FORMAT) {
        config.logging.format = process.env.LOG_FORMAT as "json" | "text";
      }
    }

    // Security configuration
    if (
      process.env.DOCKER_HOST ||
      process.env.DOCKER_TLS_VERIFY ||
      process.env.DOCKER_CERT_PATH
    ) {
      config.security = {
        dockerHost: process.env.DOCKER_HOST,
        dockerTlsVerify: process.env.DOCKER_TLS_VERIFY === "1",
        dockerCertPath: process.env.DOCKER_CERT_PATH,
      };
    }

    return config;
  }
}

/**
 * AI configuration file source (config/ai-config.json)
 */
class AIConfigFileSource implements ConfigSource {
  name = "ai-config-file";
  priority = 3;

  load(): Partial<StressMasterConfig> {
    const configPath = join(process.cwd(), "config", "ai-config.json");

    if (!existsSync(configPath)) {
      return {};
    }

    try {
      const fileContent = readFileSync(configPath, "utf-8");
      const aiConfig = JSON.parse(fileContent);

      // Transform the AI config file format to our internal format
      const config: Partial<StressMasterConfig> = {
        ai: {
          provider: aiConfig.provider || DEFAULT_AI_CONFIG.provider,
          apiKey: aiConfig.apiKey,
          endpoint: aiConfig.endpoint || DEFAULT_AI_CONFIG.endpoint,
          model: aiConfig.model || DEFAULT_AI_CONFIG.model,
          maxRetries: aiConfig.maxRetries || DEFAULT_AI_CONFIG.maxRetries,
          timeout: aiConfig.timeout || DEFAULT_AI_CONFIG.timeout,
          options: aiConfig.options || DEFAULT_AI_CONFIG.options,
        },
      };

      return config;
    } catch (error) {
      console.warn(`Warning: Failed to load AI config file: ${error}`);
      return {};
    }
  }
}

/**
 * Package.json configuration source
 */
class PackageConfigSource implements ConfigSource {
  name = "package-config";
  priority = 2;

  load(): Partial<StressMasterConfig> {
    const packagePath = join(process.cwd(), "package.json");

    if (!existsSync(packagePath)) {
      return {};
    }

    try {
      const packageContent = readFileSync(packagePath, "utf-8");
      const packageJson = JSON.parse(packageContent);

      // Look for stressmaster configuration in package.json
      if (packageJson.stressmaster) {
        return packageJson.stressmaster as Partial<StressMasterConfig>;
      }

      return {};
    } catch (error) {
      console.warn(`Warning: Failed to load package.json config: ${error}`);
      return {};
    }
  }
}

/**
 * Default configuration source (lowest priority)
 */
class DefaultConfigSource implements ConfigSource {
  name = "defaults";
  priority = 1; // Lowest priority

  load(): Partial<StressMasterConfig> {
    return DEFAULT_CONFIG;
  }
}

// ============================================================================
// Configuration Manager
// ============================================================================

export class ConfigurationManager {
  private config: StressMasterConfig;
  private sources: ConfigSource[];
  private listeners: Array<(config: StressMasterConfig) => void> = [];

  constructor() {
    this.sources = [
      new EnvironmentConfigSource(),
      new AIConfigFileSource(),
      new PackageConfigSource(),
      new DefaultConfigSource(),
    ];

    this.config = this.loadConfiguration();
  }

  /**
   * Get the current configuration
   */
  getConfig(): StressMasterConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Get a specific configuration section
   */
  getAIConfig(): AIProviderConfig {
    return this.config.ai;
  }

  getExecutionConfig(): ExecutionConfig {
    return this.config.execution;
  }

  getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  getCLIConfig(): CLIConfig {
    return this.config.cli;
  }

  getParserConfig(): ParserConfig {
    return this.config.parser;
  }

  getApplicationConfig(): ApplicationConfig {
    return this.config.application;
  }

  getSecurityConfig(): SecurityConfig | undefined {
    return this.config.security;
  }

  /**
   * Update configuration with partial config
   */
  updateConfig(partialConfig: Partial<StressMasterConfig>): void {
    this.config = this.mergeConfigs(this.config, partialConfig);
    this.notifyListeners();
  }

  /**
   * Reload configuration from all sources
   */
  reloadConfiguration(): void {
    this.config = this.loadConfiguration();
    this.notifyListeners();
  }

  /**
   * Validate the current configuration
   */
  validateConfiguration(): string[] {
    const errors: string[] = [];

    // Validate AI configuration
    if (!this.config.ai.model) {
      errors.push("AI model is required");
    }

    if (this.config.ai.timeout <= 0) {
      errors.push("AI timeout must be greater than 0");
    }

    if (this.config.ai.maxRetries < 0) {
      errors.push("AI maxRetries must be non-negative");
    }

    // Validate execution configuration
    if (this.config.execution.maxConcurrentTests <= 0) {
      errors.push("maxConcurrentTests must be greater than 0");
    }

    if (this.config.execution.defaultTimeout <= 0) {
      errors.push("defaultTimeout must be greater than 0");
    }

    // Validate application configuration
    if (
      this.config.application.port <= 0 ||
      this.config.application.port > 65535
    ) {
      errors.push("Application port must be between 1 and 65535");
    }

    // Validate CLI configuration
    if (this.config.cli.maxHistoryEntries <= 0) {
      errors.push("CLI maxHistoryEntries must be greater than 0");
    }

    return errors;
  }

  /**
   * Add a configuration change listener
   */
  addListener(listener: (config: StressMasterConfig) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a configuration change listener
   */
  removeListener(listener: (config: StressMasterConfig) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get configuration source information
   */
  getConfigurationSources(): Array<{ name: string; priority: number }> {
    return this.sources.map((source) => ({
      name: source.name,
      priority: source.priority,
    }));
  }

  /**
   * Export configuration for debugging
   */
  exportConfiguration(): {
    current: StressMasterConfig;
    sources: Array<{ name: string; config: Partial<StressMasterConfig> }>;
    validation: string[];
  } {
    return {
      current: this.getConfig(),
      sources: this.sources.map((source) => ({
        name: source.name,
        config: source.load(),
      })),
      validation: this.validateConfiguration(),
    };
  }

  private loadConfiguration(): StressMasterConfig {
    // Sort sources by priority (higher number = higher priority)
    const sortedSources = [...this.sources].sort(
      (a, b) => a.priority - b.priority
    );

    // Start with empty config and merge from lowest to highest priority
    let config: Partial<StressMasterConfig> = {};

    // Apply sources in ascending priority order (highest priority last to override previous values)
    for (let i = 0; i < sortedSources.length; i++) {
      const sourceConfig = sortedSources[i].load();
      config = this.mergeConfigs(config, sourceConfig);
    }

    return config as StressMasterConfig;
  }

  private mergeConfigs(
    base: Partial<StressMasterConfig>,
    override: Partial<StressMasterConfig>
  ): StressMasterConfig {
    return {
      application: {
        ...base.application,
        ...override.application,
      } as ApplicationConfig,
      ai: { ...base.ai, ...override.ai } as AIProviderConfig,
      execution: {
        ...base.execution,
        ...override.execution,
      } as ExecutionConfig,
      logging: { ...base.logging, ...override.logging } as LoggingConfig,
      cli: { ...base.cli, ...override.cli } as CLIConfig,
      parser: { ...base.parser, ...override.parser } as ParserConfig,
      security: override.security || base.security,
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.config);
      } catch (error) {
        console.warn(`Configuration listener error: ${error}`);
      }
    });
  }
}

// ============================================================================
// Global Configuration Instance
// ============================================================================

let globalConfigManager: ConfigurationManager | null = null;

/**
 * Get the global configuration manager instance
 */
export function getConfigManager(): ConfigurationManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigurationManager();
  }
  return globalConfigManager;
}

/**
 * Get the current configuration (convenience function)
 */
export function getConfig(): StressMasterConfig {
  return getConfigManager().getConfig();
}

/**
 * Get AI configuration (convenience function)
 */
export function getAIConfig(): AIProviderConfig {
  return getConfigManager().getAIConfig();
}

/**
 * Get execution configuration (convenience function)
 */
export function getExecutionConfig(): ExecutionConfig {
  return getConfigManager().getExecutionConfig();
}

/**
 * Get logging configuration (convenience function)
 */
export function getLoggingConfig(): LoggingConfig {
  return getConfigManager().getLoggingConfig();
}

/**
 * Get CLI configuration (convenience function)
 */
export function getCLIConfig(): CLIConfig {
  return getConfigManager().getCLIConfig();
}

/**
 * Get parser configuration (convenience function)
 */
export function getParserConfig(): ParserConfig {
  return getConfigManager().getParserConfig();
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

// Re-export parser configuration for backward compatibility
export {
  ParserConfig,
  DEFAULT_PARSER_CONFIG,
  ParserConfigManager,
  ParsingMetrics,
  ParseAttempt,
  DiagnosticInfo,
  DiagnosticReport,
  DebugSession,
  ParsingMetricsCollector,
  ParsingPerformanceMonitor,
  ParsingDiagnosticAnalyzer,
  UnifiedParserSystem,
} from "../core/parser/config";

// Legacy type aliases for backward compatibility
export type SmartParserConfig = ParserConfig;
export const DEFAULT_SMART_PARSER_CONFIG = DEFAULT_PARSER_CONFIG;

// ============================================================================
// Configuration Utilities
// ============================================================================

/**
 * Create a configuration override for testing
 */
export function createTestConfig(
  overrides: Partial<StressMasterConfig> = {}
): StressMasterConfig {
  const testDefaults: Partial<StressMasterConfig> = {
    application: {
      ...DEFAULT_APPLICATION_CONFIG,
      nodeEnv: "test",
    },
    logging: {
      ...DEFAULT_LOGGING_CONFIG,
      level: "error", // Reduce noise in tests
      enableMetrics: false,
      enableDiagnostics: false,
    },
    ai: {
      ...DEFAULT_AI_CONFIG,
      timeout: 5000, // Shorter timeout for tests
    },
  };

  // Deep merge the configurations
  const merged = {
    application: {
      ...DEFAULT_CONFIG.application,
      ...testDefaults.application,
      ...overrides.application,
    },
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...testDefaults.ai,
      ...overrides.ai,
    },
    execution: {
      ...DEFAULT_CONFIG.execution,
      ...testDefaults.execution,
      ...overrides.execution,
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      ...testDefaults.logging,
      ...overrides.logging,
    },
    cli: {
      ...DEFAULT_CONFIG.cli,
      ...testDefaults.cli,
      ...overrides.cli,
    },
    parser: {
      ...DEFAULT_CONFIG.parser,
      ...testDefaults.parser,
      ...overrides.parser,
    },
    security:
      overrides.security || testDefaults.security || DEFAULT_CONFIG.security,
  };

  return merged as StressMasterConfig;
}

/**
 * Validate environment variables and provide helpful error messages
 */
export function validateEnvironment(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required environment variables in production
  if (process.env.NODE_ENV === "production") {
    if (!process.env.MODEL_NAME) {
      warnings.push("MODEL_NAME not set, using default model");
    }

    if (!process.env.OLLAMA_HOST) {
      warnings.push("OLLAMA_HOST not set, using localhost");
    }
  }

  // Validate numeric environment variables
  if (process.env.APP_PORT && isNaN(parseInt(process.env.APP_PORT, 10))) {
    errors.push("APP_PORT must be a valid number");
  }

  if (process.env.OLLAMA_PORT && isNaN(parseInt(process.env.OLLAMA_PORT, 10))) {
    errors.push("OLLAMA_PORT must be a valid number");
  }

  // Validate log level
  if (
    process.env.LOG_LEVEL &&
    !["debug", "info", "warn", "error"].includes(process.env.LOG_LEVEL)
  ) {
    errors.push("LOG_LEVEL must be one of: debug, info, warn, error");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
