/**
 * Command Parser Interfaces
 *
 * Contains all interfaces and types used by the command parser
 */

import { LoadTestSpec, ValidationResult } from "../../../types";

export interface CommandParser {
  parseCommand(naturalLanguageInput: string): Promise<LoadTestSpec>;
  validateSpec(spec: LoadTestSpec): ValidationResult;
  suggestCorrections(input: string, errors: string[]): string[];
}

export interface ParserConfig {
  ollamaEndpoint?: string;
  modelName?: string;
  maxRetries?: number;
  timeout?: number;
  aiProvider?: "openai" | "claude" | "gemini" | "openrouter" | "amazonq";
  apiKey?: string;
}

export interface ParseResult {
  spec: LoadTestSpec;
  confidence: number;
  ambiguities: string[];
  suggestions: string[];
}

export interface DetailedParseResult extends ParseResult {
  explanation: ParseExplanation;
  warnings: string[];
  assumptions: Assumption[];
  processingSteps: string[];
}

export interface Assumption {
  field: string;
  assumedValue: any;
  reason: string;
  alternatives: any[];
}

export interface SmartParseResponse {
  spec: LoadTestSpec;
  confidence: number;
  assumptions: Assumption[];
  warnings: string[];
  suggestions: string[];
}

export interface ParseExplanation {
  extractedComponents: string[];
  assumptions: Assumption[];
  ambiguityResolutions: string[];
  confidenceFactors: string[];
}

export interface ParserMetrics {
  parseTime: number;
  aiProviderUsed: string;
  confidenceScore: number;
  fallbackUsed: boolean;
  errorCount: number;
  warningCount: number;
}

export interface ParserDiagnostics {
  inputLength: number;
  complexityScore: number;
  ambiguityLevel: "low" | "medium" | "high";
  processingSteps: string[];
  performanceMetrics: ParserMetrics;
}
