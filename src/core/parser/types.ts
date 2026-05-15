/**
 * Shared types and interfaces for the unified parser system
 * Extracted from command-parser.ts, universal-command-parser.ts, and smart-ai-provider.ts
 */

import { LoadTestSpec, ValidationResult } from "../../types";

// Core parser interfaces
export interface CommandParser {
  parseCommand(naturalLanguageInput: string): Promise<LoadTestSpec>;
  validateSpec(spec: LoadTestSpec): ValidationResult;
  suggestCorrections(input: string, errors: string[]): string[];
}

// Configuration interfaces
export interface ParserConfig {
  ollamaEndpoint?: string;
  modelName?: string;
  maxRetries?: number;
  timeout?: number;
  aiProvider?: "openai" | "claude" | "gemini" | "openrouter" | "amazonq";
  apiKey?: string;
}

export interface AIProviderConfig {
  model: string;
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  maxRetries?: number;
}

// Parsing result interfaces
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

export interface SmartParseResponse {
  spec: LoadTestSpec;
  confidence: number;
  assumptions: Assumption[];
  warnings: string[];
  suggestions: string[];
}

// Explanation and assumption interfaces
export interface ParseExplanation {
  extractedComponents: string[];
  assumptions: Assumption[];
  ambiguityResolutions: string[];
  suggestions: string[];
}

export interface Assumption {
  field: string;
  assumedValue: any;
  reason: string;
  alternatives: any[];
}

// AI provider interfaces
export interface CompletionRequest {
  prompt: string;
  format?: "json" | "text";
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResponse {
  response: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// Context and preprocessing interfaces
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

export interface ParseContext {
  originalInput: string;
  cleanedInput: string;
  extractedComponents: {
    methods: string[];
    urls: string[];
    headers: Record<string, string>[];
    bodies: string[];
    counts: number[];
    jsonBlocks: string[];
  };
  inferredFields: {
    testType: string;
    duration: string;
    loadPattern: string;
    requestBody?: any;
  };
  ambiguities: Ambiguity[];
  confidence: number;
}

// Format detection interfaces
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

export interface FormatDetectionResult {
  format: InputFormat;
  confidence: number;
  hints: ParsingHint[];
}

// Prompt building interfaces
export interface PromptExample {
  input: string;
  output: LoadTestSpec;
  description: string;
  relevanceScore?: number;
}

export interface EnhancedPrompt {
  systemPrompt: string;
  contextualExamples: PromptExample[];
  clarifications: string[];
  parsingInstructions: string[];
  fallbackInstructions: string[];
}

// Validation interfaces
export interface ValidationContext {
  originalInput: string;
  confidence: number;
  ambiguities: string[];
}

export interface EnhancedValidationResult {
  canProceed: boolean;
  errors: string[];
  warnings: string[];
  issues: string[];
}

// Suggestion interfaces
export interface SuggestionContext {
  originalInput: string;
  parsedSpec?: LoadTestSpec;
  validationIssues: string[];
  confidence: number;
  ambiguities: string[];
}

export interface Suggestion {
  type: "improvement" | "correction" | "clarification";
  message: string;
  priority: "high" | "medium" | "low";
  actionable: boolean;
}

// Error recovery interfaces
export interface ParseError extends Error {
  code?: string;
  context?: any;
  suggestions?: string[];
}

export interface RecoveryStrategy {
  strategy: "retry" | "enhance_prompt" | "fallback" | "manual_intervention";
  maxAttempts: number;
  delay?: number;
  condition?: (error: ParseError) => boolean;
}

export interface RecoveryContext {
  originalInput: string;
  previousAttempts: string[];
  availableStrategies: string[];
}

export interface RecoveryResult {
  success: boolean;
  result?: LoadTestSpec;
  error?: Error;
  confidence: number;
  recoveryPath: string[];
}

// Fallback parsing interfaces
export interface FallbackParseResult {
  spec: LoadTestSpec;
  confidence: number;
  method: string;
  warnings: string[];
}

// Ollama-specific interfaces (for backward compatibility)
export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface ConnectionPoolConfig {
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  retryAttempts?: number;
}

// Input preprocessing interfaces
export interface InputPreprocessor {
  sanitize(input: string): string;
  extractStructuredData(input: string): StructuredData;
  normalizeWhitespace(input: string): string;
  separateRequests(input: string): string[];
}

// Context enhancement interfaces
export interface ContextEnhancer {
  buildContext(
    input: string,
    structuredData: StructuredData,
    hints: ParsingHint[]
  ): ParseContext;
  inferMissingFields(context: ParseContext): ParseContext;
  resolveAmbiguities(context: ParseContext): ParseContext;
}

// Smart prompt building interfaces
export interface SmartPromptBuilder {
  buildPrompt(context: ParseContext): EnhancedPrompt;
  selectRelevantExamples(context: ParseContext): PromptExample[];
  addClarifications(context: ParseContext): string[];
}

// AI provider base interface
export interface BaseAIProvider {
  initialize(): Promise<void>;
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<boolean>;
  getProviderName(): string;
}

// Smart AI provider interface
export interface SmartAIProvider extends BaseAIProvider {
  parseWithContext(context: ParseContext): Promise<SmartParseResponse>;
  validateAndCorrect(
    response: string,
    context: ParseContext
  ): Promise<LoadTestSpec>;
  explainParsing(spec: LoadTestSpec, context: ParseContext): ParseExplanation;
  parseWithRecovery(context: ParseContext): Promise<SmartParseResponse>;
}

// Error recovery system configuration
export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  confidenceThreshold: number;
  enableFallback: boolean;
  fallbackConfidenceThreshold: number;
  enablePromptEnhancement: boolean;
}

// Parser status and capabilities
export interface ParserStatus {
  isReady: boolean;
  providerName: string;
  components: {
    preprocessor: boolean;
    formatDetector: boolean;
    contextEnhancer: boolean;
    promptBuilder: boolean;
    aiProvider: boolean;
  };
  capabilities: string[];
}

// Parsing statistics and diagnostics
export interface ParsingStatistics {
  totalParses: number;
  successfulParses: number;
  failedParses: number;
  averageConfidence: number;
  averageProcessingTime: number;
  commonErrors: Record<string, number>;
}

export interface DiagnosticInfo {
  timestamp: Date;
  input: string;
  processingSteps: string[];
  confidence: number;
  errors: string[];
  warnings: string[];
  assumptions: Assumption[];
}
