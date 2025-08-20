// Main entry point for StressMaster
export * from "./types";
export * from "./interfaces/cli";
export * from "./core/parser"; // Re-exports from core/parser for backward compatibility
export * from "./core/orchestrator";
export * from "./core/generator";
export * from "./core/executor";
export * from "./core/analyzer";

// Export utils and config with namespace to avoid conflicts
import * as Utils from "./features";
import * as Config from "./config";

export { Utils, Config };

// Also export some commonly used utilities directly
export {
  sanitizeInput,
  normalizeWhitespace,
  cleanJsonResponse,
  attemptJsonFix,
  extractTemplateVariables,
  generateTestName,
  toKebabCase,
  toCamelCase,
  flattenObject,
  deepMerge,
  ensureDirectory,
  getFileExtension,
  createError,
  formatDuration,
  parseDuration,
  isValidDuration,
  isValidUrl,
  parseUrl,
  buildUrl,
  extractDomain,
  normalizeUrl,
} from "./features";

export {
  getConfig,
  getAIConfig,
  getExecutionConfig,
  getLoggingConfig,
  getCLIConfig,
  validateEnvironment,
} from "./config";

// Version information
export const VERSION = "1.0.0";
export const APP_NAME = "StressMaster";
