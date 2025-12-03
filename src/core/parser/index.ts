/**
 * Core Parser Module - Unified exports for the consolidated parser system
 *
 * This module provides a clean interface to the unified command parser
 * that consolidates functionality from the original command-parser.ts,
 * universal-command-parser.ts, and smart-ai-provider.ts files.
 */

// ============================================================================
// MAIN PARSER CLASSES
// ============================================================================

export { UnifiedCommandParser } from "./command/parser";
// export * from "./command"; // Commented out for now

// ============================================================================
// CORE TYPES AND INTERFACES
// ============================================================================

export type {
  // Parser interfaces
  CommandParser,
  ParseResult,
  DetailedParseResult,
  ParseExplanation,
  Assumption,
  StructuredData,
  Ambiguity,

  // Input processing types
  InputFormat,
  ParsingHint,
  FormatDetectionResult,

  // Prompt and validation types
  PromptExample,
  EnhancedPrompt,
  ValidationContext,
  EnhancedValidationResult,

  // Suggestion and error types
  SuggestionContext,
  Suggestion,
  ParseError,
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult,
  FallbackParseResult,

  // Connection and configuration types
  OllamaResponse,
  ConnectionPoolConfig,
  InputPreprocessor,
  ContextEnhancer,
  SmartPromptBuilder,
  ErrorRecoveryConfig,
  ParserStatus,
  ParsingStatistics,
} from "./types";

// ============================================================================
// AI PROVIDERS
// ============================================================================

export {
  AIProvider,
  SmartAIProvider,
  BaseAIProvider,
  OpenAIProvider,
  ClaudeProvider,
  GeminiProvider,
  OpenRouterProvider,
  AmazonQProvider,
  AIProviderFactory,
  createProvider,
  isSmartProvider,
  getAvailableProviders,
} from "./ai-providers";

// AI Provider types
export type {
  AIProviderType,
  AIConfig,
  AIProviderConfig,
  CompletionRequest,
  CompletionResponse,
  SmartParseResponse,
  ParseContext,
} from "./ai-providers";

// ============================================================================
// UTILITY MODULES
// ============================================================================

export { PromptBuilder } from "./prompt-builder";
export { ResponseHandler } from "./response-handler";
export { ParserUtils } from "./utils";
export { FallbackParser } from "./fallback";
export * from "./fallback";

// ============================================================================
// CONFIGURATION AND MONITORING
// ============================================================================

export {
  ParserConfig,
  ParsingMetrics,
  ParseAttempt,
  DiagnosticInfo,
  DiagnosticReport,
  DebugSession,
  DEFAULT_PARSER_CONFIG,
  ParserConfigManager,
  ParsingMetricsCollector,
  ParsingPerformanceMonitor,
  ParsingDiagnosticAnalyzer,
  UnifiedParserSystem,
  // Legacy exports for backward compatibility
  SmartParserConfig,
  DEFAULT_SMART_PARSER_CONFIG,
  SmartParserConfigManager,
} from "./config";

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Re-export commonly used classes for backward compatibility
export {
  DefaultInputPreprocessor,
  FormatDetector,
  DefaultContextEnhancer,
} from "./utils";
export { DefaultSmartPromptBuilder } from "./prompt-builder";

// Factory function for creating parser instances
export function createUnifiedParser(
  config?: import("./types").ParserConfig
): import("./command/parser").UnifiedCommandParser {
  const { UnifiedCommandParser } = require("./command/parser");
  return new UnifiedCommandParser(config);
}

// Default parser instance factory
export function createDefaultParser(): import("./command/parser").UnifiedCommandParser {
  const { UnifiedCommandParser } = require("./command/parser");
  return new UnifiedCommandParser({
    aiProvider: "claude",
    modelName: "claude-3-5-sonnet-20241022",
    maxRetries: 3,
    timeout: 30000,
  });
}

// Parser configuration presets
export const ParserPresets = {
  openai: {
    aiProvider: "openai" as const,
    modelName: "gpt-3.5-turbo",
    maxRetries: 3,
    timeout: 30000,
  },
  claude: {
    aiProvider: "claude" as const,
    modelName: "claude-3-5-sonnet-20241022",
    maxRetries: 3,
    timeout: 30000,
  },
  gemini: {
    aiProvider: "gemini" as const,
    modelName: "gemini-pro",
    maxRetries: 3,
    timeout: 30000,
  },
} as const;

// Utility functions
export function isParserReady(
  parser: import("./command/parser").UnifiedCommandParser
): boolean {
  return true; // Simplified for now
}

export async function initializeParser(
  parser: import("./command/parser").UnifiedCommandParser
): Promise<boolean> {
  try {
    await parser.initialize();
    return true; // Simplified for now
  } catch (error) {
    console.error("Failed to initialize parser:", error);
    return false;
  }
}

export function getParserCapabilities(
  parser: import("./command/parser").UnifiedCommandParser
): import("./types").ParserStatus {
  return {
    isReady: true,
    providerName: "simplified",
    components: {
      preprocessor: true,
      formatDetector: true,
      contextEnhancer: true,
      promptBuilder: true,
      aiProvider: true,
    },
    capabilities: ["parsing", "validation"],
  };
}

// Version information
export const PARSER_VERSION = "2.0.0";
export const PARSER_BUILD_DATE = new Date().toISOString();

// Migration helpers for backward compatibility
export function migrateFromOldParser(
  oldConfig: any
): import("./types").ParserConfig {
  return {
    aiProvider: "claude",
    modelName: oldConfig.modelName || "claude-3-5-sonnet-20241022",
    maxRetries: oldConfig.maxRetries || 3,
    timeout: oldConfig.timeout || 30000,
  };
}

export function migrateFromUniversalParser(
  oldConfig: any
): import("./types").ParserConfig {
  return {
    aiProvider: oldConfig.provider || "claude",
    modelName: oldConfig.model || "claude-3-5-sonnet-20241022",
    apiKey: oldConfig.apiKey,
    maxRetries: oldConfig.maxRetries || 3,
    timeout: oldConfig.timeout || 30000,
  };
}
