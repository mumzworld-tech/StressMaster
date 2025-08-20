/**
 * Shared parser utilities consolidated from various parser modules
 * Contains common functions for input processing, validation, and data extraction
 */

import {
  sanitizeInput,
  normalizeWhitespace,
  cleanJsonResponse,
  attemptJsonFix,
  extractTemplateVariables,
} from "../../features/common/string-utils";
import { isValidUrl } from "../../features/common/validation-utils";

export type InputFormat =
  | "natural_language"
  | "mixed_structured"
  | "curl_command"
  | "http_raw"
  | "json_with_text"
  | "concatenated_requests";

export interface ParsingHint {
  type: "method" | "url" | "headers" | "body" | "count";
  value: string;
  confidence: number;
  position: { start: number; end: number };
}

export interface StructuredData {
  jsonBlocks: string[];
  urls: string[];
  headers: Record<string, string>;
  methods: string[];
  keyValuePairs: Record<string, string>;
}

export interface Ambiguity {
  field: string;
  possibleValues: string[];
  reason: string;
}

// ============================================================================
// INPUT PREPROCESSOR
// ============================================================================

export interface InputPreprocessor {
  preprocess(input: string): Promise<string>;
}

export class DefaultInputPreprocessor implements InputPreprocessor {
  async preprocess(input: string): Promise<string> {
    return ParserUtils.sanitizeInput(input);
  }
}

// ============================================================================
// FORMAT DETECTOR
// ============================================================================

export interface FormatDetectionResult {
  format: InputFormat;
  confidence: number;
  hints: ParsingHint[];
}

export class FormatDetector {
  detectFormat(input: string): FormatDetectionResult {
    return ParserUtils.detectInputFormat(input);
  }
}

// ============================================================================
// CONTEXT ENHANCER
// ============================================================================

export interface ParseContext {
  originalInput: string;
  cleanedInput?: string;
  format?: InputFormat;
  hints?: ParsingHint[];
  ambiguities?: Ambiguity[];
}

export interface ContextEnhancer {
  enhanceContext(context: ParseContext): Promise<ParseContext>;
}

export class DefaultContextEnhancer implements ContextEnhancer {
  async enhanceContext(context: ParseContext): Promise<ParseContext> {
    const structuredData = ParserUtils.extractStructuredData(
      context.originalInput
    );
    return {
      ...context,
      cleanedInput: ParserUtils.sanitizeInput(context.originalInput),
      format: ParserUtils.detectInputFormat(context.originalInput).format,
    };
  }
}

// ============================================================================
// SUGGESTION ENGINE
// ============================================================================

export interface SuggestionContext {
  input: string;
  parseResult?: any;
  errors?: string[];
}

export interface Suggestion {
  type: "correction" | "enhancement" | "alternative";
  message: string;
  confidence: number;
}

export class SuggestionEngine {
  static generateSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (context.errors && context.errors.length > 0) {
      suggestions.push({
        type: "correction",
        message:
          "Consider simplifying your request or providing more specific details",
        confidence: 0.7,
      });
    }

    return suggestions;
  }
}

// ============================================================================
// ERROR RECOVERY
// ============================================================================

export interface ParseError {
  message: string;
  code: string;
  context?: any;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  apply: (error: ParseError, context: any) => Promise<any>;
}

export interface RecoveryContext {
  originalInput: string;
  error: ParseError;
  previousAttempts: number;
}

export interface RecoveryResult {
  success: boolean;
  result?: any;
  newStrategy?: RecoveryStrategy;
}

export class ErrorRecoverySystem {
  static async attemptRecovery(
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // Simple recovery - just return the sanitized input
    return {
      success: true,
      result: ParserUtils.sanitizeInput(context.originalInput),
    };
  }
}

// ============================================================================
// PARSER UTILS CLASS
// ============================================================================

export class ParserUtils {
  private static readonly HTTP_METHODS = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
  ];
  private static readonly URL_PATTERN = /https?:\/\/[^\s]+|\/[^\s]*/g;
  private static readonly JSON_PATTERN = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;

  private static readonly PATTERNS = {
    curl: /curl\s+(-[A-Za-z]\s+[^\s]+\s+)*['"]?https?:\/\/[^\s'"]+['"]?/gi,
    httpMethod: /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/gi,
    url: /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi,
    json: /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    headers: /^\s*[\w-]+:\s*[^\r\n]+$/gm,
    userCount: /\b(\d+)\s*(users?|concurrent|parallel|threads?)\b/gi,
    duration: /\b(\d+)\s*(seconds?|minutes?|hours?|s|m|h)\b/gi,
    rps: /\b(\d+)\s*(rps|requests?\s*per\s*second|req\/s)\b/gi,
  };

  private static readonly HEADER_PATTERNS = [
    /^[ \t]*([A-Za-z][A-Za-z0-9-]*):[ \t]*([^\r\n\\]+)$/gm, // Standard header format
    /['"]([A-Za-z-]+)['"]\s*:\s*['"]([^'"\\]+)['"]/g, // Quoted header format
    /-H\s+['"]([A-Za-z-]+):\s*([^'"\\]+)['"]/g, // Curl -H format
  ];

  /**
   * Sanitizes input by removing control characters and normalizing whitespace
   */
  static sanitizeInput = sanitizeInput;

  /**
   * Normalizes whitespace in input
   */
  static normalizeWhitespace = normalizeWhitespace;

  /**
   * Extracts structured data from input
   */
  static extractStructuredData(input: string): StructuredData {
    const sanitizedInput = this.sanitizeInput(input);

    return {
      jsonBlocks: this.extractJsonBlocks(sanitizedInput),
      urls: this.extractUrls(sanitizedInput),
      headers: this.extractHeaders(sanitizedInput),
      methods: this.extractHttpMethods(sanitizedInput),
      keyValuePairs: this.extractKeyValuePairs(sanitizedInput),
    };
  }

  /**
   * Detects the input format and returns confidence score
   */
  static detectInputFormat(input: string): {
    format: InputFormat;
    confidence: number;
    hints: ParsingHint[];
  } {
    const hints: ParsingHint[] = [];
    const formatScores: Record<InputFormat, number> = {
      natural_language: 0.1, // Base score for natural language
      mixed_structured: 0,
      curl_command: 0,
      http_raw: 0,
      json_with_text: 0,
      concatenated_requests: 0,
    };

    // Extract parsing hints and calculate format scores
    this.extractParsingHints(input, hints);
    this.calculateFormatScores(input, hints, formatScores);

    // Determine the most likely format
    const format = this.selectBestFormat(formatScores);
    const confidence = Math.min(formatScores[format], 1.0);

    return { format, confidence, hints };
  }

  /**
   * Separates multiple requests from concatenated input
   */
  static separateRequests(input: string): string[] {
    const sanitizedInput = this.sanitizeInput(input);

    // Split by common request separators
    const separators = [
      /\n\s*---+\s*\n/g, // Markdown-style separators
      /\n\s*===+\s*\n/g, // Alternative separators
      /\n\s*Request\s*\d*\s*:?\s*\n/gi, // "Request 1:", "Request:", etc.
      /\n\s*\d+\.\s*\n/g, // Numbered lists "1.", "2.", etc.
    ];

    let requests = [sanitizedInput];

    for (const separator of separators) {
      const newRequests: string[] = [];
      for (const request of requests) {
        newRequests.push(...request.split(separator));
      }
      requests = newRequests;
    }

    // Filter out empty requests and trim
    return requests.map((req) => req.trim()).filter((req) => req.length > 0);
  }

  /**
   * Validates if a URL is properly formatted
   */
  static isValidUrl = isValidUrl;

  /**
   * Extracts template variables from a template string
   */
  static extractTemplateVariables = extractTemplateVariables;

  /**
   * Converts duration to seconds for comparison
   */
  static convertToSeconds(duration: { value: number; unit: string }): number {
    switch (duration.unit) {
      case "seconds":
        return duration.value;
      case "minutes":
        return duration.value * 60;
      case "hours":
        return duration.value * 3600;
      default:
        return duration.value;
    }
  }

  /**
   * Attempts to fix common JSON formatting issues
   */
  static attemptJsonFix = attemptJsonFix;

  /**
   * Cleans JSON response by removing markdown formatting
   */
  static cleanJsonResponse = cleanJsonResponse;

  private static extractJsonBlocks(input: string): string[] {
    const matches = input.match(this.JSON_PATTERN) || [];
    const validJsonBlocks: string[] = [];

    for (const match of matches) {
      try {
        JSON.parse(match);
        validJsonBlocks.push(match);
      } catch {
        // Try to fix common JSON issues
        const fixed = attemptJsonFix(match);
        if (fixed) {
          validJsonBlocks.push(fixed);
        }
      }
    }

    return validJsonBlocks;
  }

  private static extractUrls(input: string): string[] {
    const matches = input.match(this.URL_PATTERN) || [];
    return Array.from(new Set(matches)); // Remove duplicates
  }

  private static extractHeaders(input: string): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const pattern of this.HEADER_PATTERNS) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const [, key, value] = match;
        if (key && value) {
          // Normalize header key to lowercase with proper casing
          const normalizedKey = key
            .toLowerCase()
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join("-");
          // Clean up value by removing trailing backslashes and quotes
          const cleanValue = value
            .trim()
            .replace(/['"\\]+$/, "")
            .replace(/^['"]/, "");
          headers[normalizedKey] = cleanValue;
        }
      }
    }

    return headers;
  }

  private static extractHttpMethods(input: string): string[] {
    const methods: string[] = [];
    const upperInput = input.toUpperCase();

    for (const method of this.HTTP_METHODS) {
      const regex = new RegExp(`\\b${method}\\b`, "g");
      if (regex.test(upperInput)) {
        methods.push(method);
      }
    }

    return Array.from(new Set(methods)); // Remove duplicates
  }

  private static extractKeyValuePairs(input: string): Record<string, string> {
    const pairs: Record<string, string> = {};

    // Pattern for key-value pairs like "key: value" or "key = value"
    const kvPattern = /(\w+)\s*[:=]\s*([^\n\r,;]+)/g;
    let match;

    while ((match = kvPattern.exec(input)) !== null) {
      const [, key, value] = match;
      if (key && value) {
        pairs[key.trim()] = value.trim();
      }
    }

    return pairs;
  }

  private static extractParsingHints(
    input: string,
    hints: ParsingHint[]
  ): void {
    // Reset all regex lastIndex
    Object.values(this.PATTERNS).forEach((pattern) => {
      if (pattern.global) pattern.lastIndex = 0;
    });

    // Extract HTTP methods
    let match;
    while ((match = this.PATTERNS.httpMethod.exec(input)) !== null) {
      hints.push({
        type: "method",
        value: match[0].toUpperCase(),
        confidence: 0.9,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    // Extract URLs
    this.PATTERNS.url.lastIndex = 0;
    while ((match = this.PATTERNS.url.exec(input)) !== null) {
      hints.push({
        type: "url",
        value: match[0],
        confidence: 0.95,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    // Extract headers (only lines that look like headers)
    this.PATTERNS.headers.lastIndex = 0;
    while ((match = this.PATTERNS.headers.exec(input)) !== null) {
      hints.push({
        type: "headers",
        value: match[0].trim(),
        confidence: 0.8,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    // Extract JSON bodies with better validation
    this.PATTERNS.json.lastIndex = 0;
    while ((match = this.PATTERNS.json.exec(input)) !== null) {
      try {
        JSON.parse(match[0]);
        hints.push({
          type: "body",
          value: match[0],
          confidence: 0.9,
          position: { start: match.index, end: match.index + match[0].length },
        });
      } catch {
        // Check if it looks like JSON but has syntax errors
        if (
          match[0].includes('"') &&
          (match[0].includes(":") || match[0].includes(","))
        ) {
          hints.push({
            type: "body",
            value: match[0],
            confidence: 0.5,
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
          });
        }
      }
    }

    // Extract user counts
    this.PATTERNS.userCount.lastIndex = 0;
    while ((match = this.PATTERNS.userCount.exec(input)) !== null) {
      hints.push({
        type: "count",
        value: match[1],
        confidence: 0.8,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }
  }

  private static calculateFormatScores(
    input: string,
    hints: ParsingHint[],
    scores: Record<InputFormat, number>
  ): void {
    const lowerInput = input.toLowerCase();

    // Check for curl command - highest priority
    this.PATTERNS.curl.lastIndex = 0;
    if (this.PATTERNS.curl.test(input)) {
      scores.curl_command = 0.95;
      return; // Curl is very distinctive, return early
    }

    // Check for HTTP raw format
    const httpRawIndicators = [
      /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\/\S*\s+HTTP\/\d\.\d/m,
      /^Host:\s*[^\r\n]+/m,
      /^User-Agent:\s*[^\r\n]+/m,
    ];

    let httpRawMatches = 0;
    httpRawIndicators.forEach((pattern) => {
      if (pattern.test(input)) {
        httpRawMatches++;
      }
    });

    if (httpRawMatches >= 2) {
      scores.http_raw = 0.9;
      return; // HTTP raw is also very distinctive
    } else if (httpRawMatches === 1) {
      scores.http_raw = 0.6;
    }

    // Check for concatenated requests - multiple methods or URLs
    const methodCount = hints.filter((h) => h.type === "method").length;
    const urlCount = hints.filter((h) => h.type === "url").length;
    if (methodCount > 1 || urlCount > 1) {
      scores.concatenated_requests = 0.8;
    }

    // Check for JSON with text
    const jsonBlocks = hints.filter((h) => h.type === "body").length;
    const textWithoutJson = input
      .replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, "")
      .trim();
    if (jsonBlocks > 0 && textWithoutJson.length > 20) {
      scores.json_with_text = 0.7;
    }

    // Check for mixed structured data
    const hasUrls = hints.some((h) => h.type === "url");
    const hasHeaders = hints.some((h) => h.type === "headers");
    const hasMethods = hints.some((h) => h.type === "method");
    const hasNaturalLanguage =
      /\b(test|load|performance|users?|requests?|endpoint|please|create|need|want)\b/i.test(
        input
      );

    if ((hasUrls || hasHeaders || hasMethods) && hasNaturalLanguage) {
      scores.mixed_structured = 0.6;
    }

    // Natural language scoring
    const naturalLanguageIndicators = [
      "please",
      "can you",
      "i want",
      "i need",
      "create a test",
      "load test",
      "performance test",
      "test with",
      "simulate",
    ];

    let naturalLanguageScore = 0.1; // Base score
    naturalLanguageIndicators.forEach((indicator) => {
      if (lowerInput.includes(indicator)) {
        naturalLanguageScore += 0.15;
      }
    });

    // Boost natural language if no structured data found
    if (hints.length === 0) {
      naturalLanguageScore += 0.4;
    }

    scores.natural_language = Math.min(naturalLanguageScore, 0.9);

    // Apply complexity multiplier
    const complexity = this.calculateComplexity(input, hints);
    Object.keys(scores).forEach((format) => {
      if (scores[format as InputFormat] > 0) {
        scores[format as InputFormat] = Math.min(
          scores[format as InputFormat] * complexity,
          1.0
        );
      }
    });
  }

  private static calculateComplexity(
    input: string,
    hints: ParsingHint[]
  ): number {
    const baseComplexity = 0.7;
    const hintBonus = Math.min(hints.length * 0.05, 0.2);
    const lengthBonus = Math.min(input.length / 2000, 0.1);

    return Math.min(baseComplexity + hintBonus + lengthBonus, 1.0);
  }

  private static selectBestFormat(
    scores: Record<InputFormat, number>
  ): InputFormat {
    let bestFormat: InputFormat = "natural_language";
    let bestScore = scores.natural_language;

    Object.entries(scores).forEach(([format, score]) => {
      if (score > bestScore) {
        bestFormat = format as InputFormat;
        bestScore = score;
      }
    });

    return bestFormat;
  }
}
