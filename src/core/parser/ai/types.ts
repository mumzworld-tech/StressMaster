import { LoadTestSpec } from "../../../types";

// ============================================================================
// Core Interfaces and Types
// ============================================================================

export interface AIProvider {
  initialize(): Promise<void>;
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<boolean>;
  isReady(): boolean;
  getProviderName(): string;
}

export interface CompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  format?: "json" | "text";
  options?: Record<string, any>;
  // Enhanced fields for smart parsing
  systemPrompt?: string;
  examples?: any[];
  clarifications?: string[];
}

export interface CompletionResponse {
  response: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: {
    provider: string;
    duration?: number;
    cached?: boolean;
  };
}

export interface AIProviderConfig {
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxRetries?: number;
  timeout?: number;
  options?: Record<string, any>;
}

export type AIProviderType =
  | "openai"
  | "claude"
  | "gemini"
  | "openrouter"
  | "amazonq";

export interface AIConfig {
  provider: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxRetries?: number;
  timeout?: number;
  options?: Record<string, any>;
}

// Smart parsing interfaces
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

export interface ParseContext {
  originalInput: string;
  cleanedInput?: string;
  extractedComponents: {
    methods: string[];
    urls: string[];
    headers: Record<string, string>[];
    bodies: string[];
    counts: number[];
    jsonBlocks: string[];
  };
  inferredFields: {
    testType?: string;
    duration?: string;
    loadPattern?: string;
  };
  ambiguities: Array<{
    field: string;
    possibleValues: any[];
    reason: string;
  }>;
  confidence: number;
}

export interface SmartAIProvider extends AIProvider {
  parseWithContext(context: ParseContext): Promise<SmartParseResponse>;
  validateAndCorrect(
    response: string,
    context: ParseContext
  ): Promise<LoadTestSpec>;
  parseWithRecovery(context: ParseContext): Promise<SmartParseResponse>;
}
