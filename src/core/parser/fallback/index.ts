/**
 * Fallback Parser - Main Entry Point
 *
 * This is the main fallback parser that uses rule-based parsing when AI parsing fails.
 * It's been split into smaller, more manageable components for better maintainability.
 */

export { FallbackParser } from "./parser";
export {
  FALLBACK_PARSING_RULES,
  PARSING_PATTERNS,
  KEYWORD_MAPPINGS,
} from "./patterns";
export * from "./utils";
