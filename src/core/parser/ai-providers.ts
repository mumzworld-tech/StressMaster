/**
 * Consolidated AI Providers Module
 * Contains all AI provider implementations with unified interface and integrated factory logic
 */

import { LoadTestSpec } from "../../types";
import { PromptBuilder } from "./prompt-builder";

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

export interface OllamaRequest {
  model: string;
  prompt: string;
  options?: {
    temperature?: number;
    num_predict?: number;
    [key: string]: any;
  };
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

export type AIProviderType = "ollama" | "openai" | "claude" | "gemini";

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

// ============================================================================
// Base Provider Implementation
// ============================================================================

export abstract class BaseAIProvider implements AIProvider {
  protected config: AIProviderConfig;
  protected isInitialized: boolean = false;

  constructor(config: AIProviderConfig) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };
  }

  abstract initialize(): Promise<void>;
  abstract generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse>;
  abstract healthCheck(): Promise<boolean>;
  abstract getProviderName(): string;

  isReady(): boolean {
    return this.isInitialized;
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries || 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxRetries) break;

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

// ============================================================================
// Ollama Client (for Ollama Provider)
// ============================================================================

interface OllamaConfig {
  ollamaEndpoint: string;
  modelName: string;
  maxRetries: number;
  timeout: number;
}

interface OllamaResponse {
  response: string;
  model: string;
  prompt_eval_count?: number;
  eval_count?: number;
  load_duration?: number;
}

export class OllamaClient {
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaEndpoint}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async checkModelAvailability(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaEndpoint}/api/tags`);
      if (!response.ok) return false;

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      return (
        data.models?.some((model: any) => model.name === modelName) || false
      );
    } catch (error) {
      return false;
    }
  }

  async pullModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.config.ollamaEndpoint}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model ${modelName}`);
    }
  }

  async generateCompletion(request: {
    model: string;
    prompt: string;
    format?: string;
    options?: Record<string, any>;
  }): Promise<OllamaResponse> {
    const response = await fetch(`${this.config.ollamaEndpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        format: request.format,
        options: request.options,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} - ${response.statusText}`
      );
    }

    return response.json() as Promise<OllamaResponse>;
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Ollama Provider - Supports local Ollama models
 */
export class OllamaProvider extends BaseAIProvider {
  private static readonly DEFAULT_ENDPOINT = "http://localhost:11434";
  private static readonly DEFAULT_MODEL = "llama3.1:8b";
  private ollamaClient: OllamaClient;

  constructor(config: AIProviderConfig) {
    super({
      endpoint: OllamaProvider.DEFAULT_ENDPOINT,
      ...config,
      model: config.model || OllamaProvider.DEFAULT_MODEL,
    });

    this.ollamaClient = new OllamaClient({
      ollamaEndpoint: this.config.endpoint!,
      modelName: this.config.model,
      maxRetries: this.config.maxRetries || 3,
      timeout: this.config.timeout || 30000,
    });
  }

  async initialize(): Promise<void> {
    try {
      const isHealthy = await this.ollamaClient.healthCheck();
      if (!isHealthy) {
        throw new Error("Ollama service is not available");
      }

      const isModelAvailable = await this.ollamaClient.checkModelAvailability(
        this.config.model
      );
      if (!isModelAvailable) {
        console.log(
          `Model ${this.config.model} not found, attempting to pull...`
        );
        await this.ollamaClient.pullModel(this.config.model);
      }

      this.isInitialized = true;
      console.log(
        `Ollama Provider initialized with model: ${this.config.model}`
      );
    } catch (error) {
      throw new Error(`Failed to initialize Ollama provider: ${error}`);
    }
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const startTime = Date.now();

    return this.retryOperation(async () => {
      const response = await this.ollamaClient.generateCompletion({
        model: request.model || this.config.model,
        prompt: request.prompt,
        format: request.format === "json" ? "json" : undefined,
        options: {
          temperature: request.temperature || 0.1,
          top_p: 0.9,
          num_predict: request.maxTokens || 2000,
          ...request.options,
        },
      });

      const duration = Date.now() - startTime;

      return {
        response: response.response,
        model: response.model,
        usage: {
          promptTokens: response.prompt_eval_count,
          completionTokens: response.eval_count,
          totalTokens:
            (response.prompt_eval_count || 0) + (response.eval_count || 0),
        },
        metadata: {
          provider: "ollama",
          duration,
          cached: response.load_duration === 0,
        },
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    return this.ollamaClient.healthCheck();
  }

  getProviderName(): string {
    return "Ollama";
  }

  async pullModel(modelName: string): Promise<void> {
    await this.ollamaClient.pullModel(modelName);
  }
}

/**
 * OpenAI Provider - Supports GPT models with smart parsing capabilities
 */
export class OpenAIProvider extends BaseAIProvider implements SmartAIProvider {
  private static readonly DEFAULT_ENDPOINT = "https://api.openai.com/v1";
  private static readonly DEFAULT_MODEL = "gpt-3.5-turbo";

  constructor(config: AIProviderConfig) {
    super({
      endpoint: OpenAIProvider.DEFAULT_ENDPOINT,
      ...config,
      model: config.model || OpenAIProvider.DEFAULT_MODEL,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error(
        "OpenAI API key is required. Set AI_API_KEY environment variable."
      );
    }

    try {
      await this.healthCheck();
      this.isInitialized = true;
      console.log(
        `OpenAI Provider initialized with model: ${this.config.model}`
      );
    } catch (error) {
      throw new Error(`Failed to initialize OpenAI provider: ${error}`);
    }
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const startTime = Date.now();

    return this.retryOperation(async () => {
      const systemMessage = this.buildSystemMessage(request);

      const response = await fetch(`${this.config.endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model || this.config.model,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: request.prompt },
          ],
          temperature: request.temperature || 0.1,
          max_tokens: request.maxTokens || 2000,
          response_format:
            request.format === "json" ? { type: "json_object" } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        throw new Error(
          `OpenAI API error: ${response.status} - ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const data = (await response.json()) as any;
      const duration = Date.now() - startTime;

      return {
        response: data.choices[0].message.content,
        model: data.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        metadata: {
          provider: "openai",
          duration,
        },
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  getProviderName(): string {
    return "OpenAI";
  }

  // Smart parsing implementation
  async parseWithContext(context: ParseContext): Promise<SmartParseResponse> {
    try {
      const enhancedPrompt = this.buildEnhancedPrompt(context);
      const response = await this.generateCompletion(enhancedPrompt);
      const spec = await this.validateAndCorrect(response.response, context);

      const confidence = this.calculateParsingConfidence(
        spec,
        context,
        response
      );
      const assumptions = this.extractAssumptions(spec, context);
      const warnings = this.generateWarnings(spec, context);
      const suggestions = this.generateSuggestions(spec, context);

      return { spec, confidence, assumptions, warnings, suggestions };
    } catch (error) {
      throw new Error(`Smart parsing failed: ${(error as Error).message}`);
    }
  }

  async validateAndCorrect(
    response: string,
    context: ParseContext
  ): Promise<LoadTestSpec> {
    const MAX_VALIDATION_RETRIES = 2;
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < MAX_VALIDATION_RETRIES) {
      try {
        const spec = this.parseJsonResponse(response);
        const validationResult = this.validateLoadTestSpec(spec, context);

        if (validationResult.isValid) {
          return validationResult.correctedSpec || spec;
        }

        if (attempts < MAX_VALIDATION_RETRIES - 1) {
          response = await this.correctResponse(
            response,
            validationResult.errors,
            context
          );
          attempts++;
          continue;
        }

        throw new Error(
          `Validation failed: ${validationResult.errors.join(", ")}`
        );
      } catch (error) {
        lastError = error as Error;
        if (attempts < MAX_VALIDATION_RETRIES - 1) {
          response = this.fixCommonJsonIssues(response);
          attempts++;
          continue;
        }
        break;
      }
    }

    throw lastError || new Error("Validation failed after all retries");
  }

  async parseWithRecovery(context: ParseContext): Promise<SmartParseResponse> {
    try {
      return await this.parseWithContext(context);
    } catch (error) {
      console.warn("OpenAI parsing failed, attempting recovery:", error);

      const fallbackSpec: LoadTestSpec = {
        id: `openai-fallback-${Date.now()}`,
        name: "Fallback Load Test",
        description: `Recovery parsing for: ${context.originalInput}`,
        testType: "baseline",
        duration: { value: 30, unit: "seconds" },
        requests: [
          {
            method: "GET",
            url: context.extractedComponents.urls[0] || "http://localhost:8080",
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 10 },
      };

      return {
        spec: fallbackSpec,
        confidence: 0.3,
        assumptions: [
          {
            field: "parsing_method",
            assumedValue: "fallback",
            reason: "Used fallback parsing due to OpenAI error",
            alternatives: ["ai_parsing", "rule_based"],
          },
        ],
        warnings: [
          `OpenAI parsing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
        suggestions: [
          "Try rephrasing your request",
          "Check OpenAI API configuration",
        ],
      };
    }
  }

  private buildSystemMessage(request: CompletionRequest): string {
    if (request.systemPrompt) return request.systemPrompt;

    return `You are StressMaster's AI assistant that converts user input into structured load test specifications.

Your task is to intelligently parse user input and return a valid JSON object matching the LoadTestSpec interface.

Required fields:
- id: string (generate a unique identifier)
- name: string (descriptive test name)  
- description: string (copy of original input)
- testType: "baseline" | "spike" | "stress" | "endurance" | "volume"
- requests: array of RequestSpec objects
- loadPattern: LoadPattern object
- duration: Duration object with value and unit

RequestSpec format:
- method: HTTP method (GET, POST, PUT, DELETE, etc.)
- url: complete URL or path
- headers: optional object with header key-value pairs
- payload: optional PayloadSpec for request body

LoadPattern format:
- type: "constant" | "ramp-up" | "spike" | "step"
- virtualUsers: number of concurrent users
- Additional fields based on type (rampUpTime, etc.)

Duration format:
- value: number
- unit: "seconds" | "minutes" | "hours"

Respond with valid JSON only. Do not include explanations or markdown formatting.`;
  }

  private buildEnhancedPrompt(context: ParseContext): CompletionRequest {
    let systemPrompt = this.buildSystemMessage({} as CompletionRequest);

    if (context.confidence < 0.5) {
      systemPrompt += `\n\nNote: Input has low confidence (${context.confidence.toFixed(
        2
      )}). Make conservative assumptions and use defaults where necessary.`;
    }

    if (context.extractedComponents.methods.length > 0) {
      systemPrompt += `\n\nDetected HTTP methods: ${context.extractedComponents.methods.join(
        ", "
      )}`;
    }

    if (context.extractedComponents.urls.length > 0) {
      systemPrompt += `\n\nDetected URLs: ${context.extractedComponents.urls.join(
        ", "
      )}`;
    }

    return {
      prompt: context.cleanedInput || context.originalInput,
      format: "json",
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt,
    };
  }

  private parseJsonResponse(response: string): LoadTestSpec {
    try {
      const cleanedResponse = response
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      return JSON.parse(cleanedResponse);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response: ${(error as Error).message}`
      );
    }
  }

  private validateLoadTestSpec(
    spec: any,
    context: ParseContext
  ): {
    isValid: boolean;
    errors: string[];
    correctedSpec?: LoadTestSpec;
  } {
    const errors: string[] = [];

    if (!spec.id) errors.push("Missing required field: id");
    if (!spec.name) errors.push("Missing required field: name");
    if (!spec.description) errors.push("Missing required field: description");
    if (!spec.testType) errors.push("Missing required field: testType");
    if (!spec.requests || !Array.isArray(spec.requests)) {
      errors.push("Missing or invalid requests array");
    }
    if (!spec.loadPattern) errors.push("Missing required field: loadPattern");
    if (!spec.duration) errors.push("Missing required field: duration");

    if (spec.requests && Array.isArray(spec.requests)) {
      spec.requests.forEach((request: any, index: number) => {
        if (!request.method) errors.push(`Request ${index}: missing method`);
        if (!request.url) errors.push(`Request ${index}: missing url`);
      });
    }

    let correctedSpec: LoadTestSpec | undefined;
    if (errors.length > 0 && errors.length <= 3) {
      correctedSpec = this.attemptSpecCorrection(spec, context, errors);
      if (correctedSpec) {
        return { isValid: true, errors: [], correctedSpec };
      }
    }

    return { isValid: errors.length === 0, errors, correctedSpec };
  }

  private attemptSpecCorrection(
    spec: any,
    context: ParseContext,
    errors: string[]
  ): LoadTestSpec | undefined {
    try {
      const corrected = { ...spec };

      if (!corrected.id) corrected.id = `test_${Date.now()}`;
      if (!corrected.name) corrected.name = "Load Test";
      if (!corrected.description) corrected.description = context.originalInput;
      if (!corrected.testType)
        corrected.testType = context.inferredFields.testType || "baseline";

      if (!corrected.requests || !Array.isArray(corrected.requests)) {
        corrected.requests = [
          {
            method: context.extractedComponents.methods[0] || "GET",
            url: context.extractedComponents.urls[0] || "http://localhost:8080",
          },
        ];
      }

      if (!corrected.loadPattern) {
        corrected.loadPattern = {
          type: context.inferredFields.loadPattern || "constant",
          virtualUsers: context.extractedComponents.counts[0] || 10,
        };
      }

      if (!corrected.duration) {
        const durationStr = context.inferredFields.duration || "30s";
        const match = durationStr.match(/(\d+)([smh])/);
        if (match) {
          corrected.duration = {
            value: parseInt(match[1], 10),
            unit:
              match[2] === "s"
                ? "seconds"
                : match[2] === "m"
                ? "minutes"
                : "hours",
          };
        } else {
          corrected.duration = { value: 30, unit: "seconds" };
        }
      }

      return corrected as LoadTestSpec;
    } catch (error) {
      return undefined;
    }
  }

  private async correctResponse(
    response: string,
    errors: string[],
    context: ParseContext
  ): Promise<string> {
    const correctionPrompt = `The previous JSON response had validation errors: ${errors.join(
      ", "
    )}

Please fix these issues and return a corrected JSON response that matches the LoadTestSpec interface.

Original response:
${response}

Return only the corrected JSON, no explanations.`;

    const correctionRequest: CompletionRequest = {
      prompt: correctionPrompt,
      format: "json",
      temperature: 0.1,
      maxTokens: 2000,
    };

    const correctionResponse = await this.generateCompletion(correctionRequest);
    return correctionResponse.response;
  }

  private fixCommonJsonIssues(response: string): string {
    return response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"')
      .trim();
  }

  private calculateParsingConfidence(
    spec: LoadTestSpec,
    context: ParseContext,
    response: CompletionResponse
  ): number {
    let confidence = context.confidence;

    if (
      spec.requests.length > 0 &&
      spec.requests[0].method &&
      spec.requests[0].url
    ) {
      confidence += 0.2;
    }

    if (spec.loadPattern.virtualUsers && spec.loadPattern.virtualUsers > 0) {
      confidence += 0.1;
    }

    if (spec.testType === "baseline" && !context.inferredFields.testType) {
      confidence -= 0.1;
    }

    confidence -= context.ambiguities.length * 0.05;

    return Math.max(Math.min(confidence, 1.0), 0.3);
  }

  private extractAssumptions(
    spec: LoadTestSpec,
    context: ParseContext
  ): Assumption[] {
    const assumptions: Assumption[] = [];

    if (
      spec.requests[0]?.method &&
      context.extractedComponents.methods.length === 0
    ) {
      assumptions.push({
        field: "method",
        assumedValue: spec.requests[0].method,
        reason: "No HTTP method specified in input",
        alternatives: ["GET", "POST", "PUT", "DELETE"],
      });
    }

    if (
      spec.requests[0]?.url &&
      context.extractedComponents.urls.length === 0
    ) {
      assumptions.push({
        field: "url",
        assumedValue: spec.requests[0].url,
        reason: "No URL specified in input",
        alternatives: ["http://localhost:8080", "https://api.example.com"],
      });
    }

    return assumptions;
  }

  private generateWarnings(
    spec: LoadTestSpec,
    context: ParseContext
  ): string[] {
    const warnings: string[] = [];

    if (context.confidence < 0.5) {
      warnings.push(
        "Input had low confidence - please verify the generated test specification"
      );
    }

    if (context.ambiguities.length > 0) {
      warnings.push(
        `${context.ambiguities.length} ambiguities were resolved with defaults`
      );
    }

    return warnings;
  }

  private generateSuggestions(
    spec: LoadTestSpec,
    context: ParseContext
  ): string[] {
    const suggestions: string[] = [];

    if (
      spec.requests[0]?.method === "POST" &&
      !spec.requests[0]?.headers?.["Content-Type"]
    ) {
      suggestions.push("Consider adding Content-Type header for POST requests");
    }

    return suggestions;
  }
}

/**
 * Claude Provider - Supports Anthropic Claude models
 */
export class ClaudeProvider extends BaseAIProvider implements SmartAIProvider {
  private static readonly DEFAULT_ENDPOINT = "https://api.anthropic.com/v1";
  private static readonly OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";
  private static readonly DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
  private static readonly API_VERSION = "2023-06-01";
  private useOpenRouter: boolean = false;

  constructor(config: AIProviderConfig) {
    super({
      endpoint: ClaudeProvider.DEFAULT_ENDPOINT,
      ...config,
      model: config.model || ClaudeProvider.DEFAULT_MODEL,
    });

    // Check if using OpenRouter (API key starts with sk-or-)
    this.useOpenRouter = config.apiKey?.startsWith("sk-or-") || false;
    // Only show debug info in development mode
    if (process.env.NODE_ENV === "development") {
      console.log(
        `🔍 Claude provider: useOpenRouter = ${
          this.useOpenRouter
        }, apiKey starts with: ${config.apiKey?.substring(0, 10)}...`
      );
    }
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error(
        "Anthropic API key is required. Set AI_API_KEY environment variable."
      );
    }

    try {
      await this.healthCheck();
      this.isInitialized = true;
      console.log(
        `Claude Provider initialized with model: ${this.config.model}`
      );
    } catch (error) {
      throw new Error(`Failed to initialize Claude provider: ${error}`);
    }
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const startTime = Date.now();

    return this.retryOperation(async () => {
      const systemPrompt = PromptBuilder.getSystemPrompt();

      if (this.useOpenRouter) {
        // Use OpenRouter API
        const response = await fetch(
          `${ClaudeProvider.OPENROUTER_ENDPOINT}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://stressmaster.local",
              "X-Title": "StressMaster Load Testing",
            },
            body: JSON.stringify({
              model: `anthropic/${request.model || this.config.model}`,
              max_tokens: request.maxTokens || 2000,
              temperature: request.temperature || 0.1,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: request.prompt },
              ],
            }),
          }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as any;
          throw new Error(
            `OpenRouter API error: ${response.status} - ${
              errorData.error?.message || response.statusText
            }`
          );
        }

        const data = (await response.json()) as any;
        const duration = Date.now() - startTime;

        return {
          response: data.choices[0].message.content,
          model: data.model,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            totalTokens: data.usage?.total_tokens,
          },
          metadata: {
            provider: "claude-openrouter",
            duration,
          },
        };
      } else {
        // Use direct Anthropic API
        const response = await fetch(`${this.config.endpoint}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": this.config.apiKey!,
            "Content-Type": "application/json",
            "anthropic-version": ClaudeProvider.API_VERSION,
          },
          body: JSON.stringify({
            model: request.model || this.config.model,
            max_tokens: request.maxTokens || 2000,
            temperature: request.temperature || 0.1,
            system: systemPrompt,
            messages: [{ role: "user", content: request.prompt }],
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as any;
          throw new Error(
            `Claude API error: ${response.status} - ${
              errorData.error?.message || response.statusText
            }`
          );
        }

        const data = (await response.json()) as any;
        const duration = Date.now() - startTime;

        return {
          response: data.content[0].text,
          model: data.model,
          usage: {
            promptTokens: data.usage?.input_tokens,
            completionTokens: data.usage?.output_tokens,
            totalTokens:
              (data.usage?.input_tokens || 0) +
              (data.usage?.output_tokens || 0),
          },
          metadata: {
            provider: "claude",
            duration,
          },
        };
      }
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.config.apiKey!,
          "Content-Type": "application/json",
          "anthropic-version": ClaudeProvider.API_VERSION,
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  getProviderName(): string {
    return "Anthropic Claude";
  }

  // SmartAIProvider interface implementation
  async parseWithContext(context: ParseContext): Promise<SmartParseResponse> {
    const enhancedPrompt = PromptBuilder.buildPrompt(context);
    const systemPrompt = enhancedPrompt.systemPrompt;

    const request: CompletionRequest = {
      prompt: context.originalInput,
      systemPrompt,
      model: this.config.model,
      maxTokens: 2000,
      temperature: 0.1,
      format: "json",
    };

    const response = await this.generateCompletion(request);

    return {
      spec: JSON.parse(response.response),
      confidence: this.calculateConfidence(context),
      assumptions: [],
      warnings: [],
      suggestions: this.generateSuggestions(
        JSON.parse(response.response),
        context
      ),
    };
  }

  async validateAndCorrect(
    response: string,
    context: ParseContext
  ): Promise<LoadTestSpec> {
    const correctionPrompt = `The following load test specification has errors. Please correct the JSON specification: ${response}`;

    const request: CompletionRequest = {
      prompt: correctionPrompt,
      model: this.config.model,
      maxTokens: 2000,
      temperature: 0.1,
      format: "json",
    };

    const apiResponse = await this.generateCompletion(request);
    return JSON.parse(apiResponse.response);
  }

  async parseWithRecovery(context: ParseContext): Promise<SmartParseResponse> {
    try {
      return await this.parseWithContext(context);
    } catch (error) {
      // Fallback to basic parsing
      const request: CompletionRequest = {
        prompt: context.originalInput,
        model: this.config.model,
        maxTokens: 2000,
        temperature: 0.1,
        format: "json",
      };

      const response = await this.generateCompletion(request);

      return {
        spec: JSON.parse(response.response),
        confidence: 0.5, // Lower confidence for fallback
        assumptions: [],
        warnings: [],
        suggestions: ["Consider rephrasing your request for better parsing"],
      };
    }
  }

  private calculateConfidence(context: ParseContext): number {
    // Simple confidence calculation based on input clarity
    let confidence = 0.7; // Base confidence

    if (context.extractedComponents.methods.length > 0) confidence += 0.1;
    if (context.extractedComponents.urls.length > 0) confidence += 0.1;
    if (context.extractedComponents.counts.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private generateSuggestions(
    spec: LoadTestSpec,
    context: ParseContext
  ): string[] {
    const suggestions: string[] = [];

    if (!spec.requests[0]?.payload && spec.requests[0]?.method === "POST") {
      suggestions.push("Consider adding a request payload for POST requests");
    }

    if (spec.loadPattern.virtualUsers && spec.loadPattern.virtualUsers > 1000) {
      suggestions.push(
        "High load detected - consider starting with fewer users"
      );
    }

    return suggestions;
  }
}

/**
 * Gemini Provider - Supports Google Gemini models
 */
export class GeminiProvider extends BaseAIProvider {
  private static readonly DEFAULT_ENDPOINT =
    "https://generativelanguage.googleapis.com/v1beta";
  private static readonly DEFAULT_MODEL = "gemini-pro";

  constructor(config: AIProviderConfig) {
    super({
      endpoint: GeminiProvider.DEFAULT_ENDPOINT,
      ...config,
      model: config.model || GeminiProvider.DEFAULT_MODEL,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error(
        "Google AI API key is required. Set AI_API_KEY environment variable."
      );
    }

    try {
      await this.healthCheck();
      this.isInitialized = true;
      console.log(
        `Gemini Provider initialized with model: ${this.config.model}`
      );
    } catch (error) {
      throw new Error(`Failed to initialize Gemini provider: ${error}`);
    }
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const startTime = Date.now();

    return this.retryOperation(async () => {
      const model = request.model || this.config.model;
      const url = `${this.config.endpoint}/models/${model}:generateContent?key=${this.config.apiKey}`;

      const systemInstruction =
        "You are a helpful assistant that converts natural language into structured load test specifications. Always respond with valid JSON when requested.";
      const fullPrompt = `${systemInstruction}\n\nUser request: ${request.prompt}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: request.temperature || 0.1,
            maxOutputTokens: request.maxTokens || 2000,
            topP: 0.8,
            topK: 10,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        throw new Error(
          `Gemini API error: ${response.status} - ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const data = (await response.json()) as any;
      const duration = Date.now() - startTime;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response generated by Gemini");
      }

      const candidate = data.candidates[0];
      if (candidate.finishReason === "SAFETY") {
        throw new Error("Response blocked by Gemini safety filters");
      }

      return {
        response: candidate.content.parts[0].text,
        model: model,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
        metadata: {
          provider: "gemini",
          duration,
        },
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.config.model;
      const url = `${this.config.endpoint}/models/${model}?key=${this.config.apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  getProviderName(): string {
    return "Google Gemini";
  }
}

// ============================================================================
// Integrated Factory Logic
// ============================================================================

/**
 * AI Provider Factory - Creates appropriate provider instances with integrated logic
 */
export class AIProviderFactory {
  /**
   * Create an AI provider instance based on configuration
   */
  static create(config: AIConfig): AIProvider {
    const providerConfig: AIProviderConfig = {
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      model: config.model,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
      options: config.options || {},
    };

    switch (config.provider) {
      case "ollama":
        return new OllamaProvider(providerConfig);

      case "openai":
        if (!config.apiKey) {
          throw new Error(
            "OpenAI API key is required. Set AI_API_KEY environment variable."
          );
        }
        return new OpenAIProvider(providerConfig);

      case "claude":
        if (!config.apiKey) {
          throw new Error(
            "Anthropic API key is required. Set AI_API_KEY environment variable."
          );
        }
        return new ClaudeProvider(providerConfig);

      case "gemini":
        if (!config.apiKey) {
          throw new Error(
            "Google AI API key is required. Set AI_API_KEY environment variable."
          );
        }
        return new GeminiProvider(providerConfig);

      default:
        throw new Error(
          `Unsupported AI provider: ${config.provider}. Supported providers: ollama, openai, claude, gemini`
        );
    }
  }

  /**
   * Get default configuration for a provider
   */
  static getDefaultConfig(provider: AIProviderType): Partial<AIConfig> {
    switch (provider) {
      case "ollama":
        return {
          provider: "ollama",
          endpoint: "http://localhost:11434",
          model: "llama3.2:1b",
        };

      case "openai":
        return {
          provider: "openai",
          endpoint: "https://api.openai.com/v1",
          model: "gpt-3.5-turbo",
        };

      case "claude":
        return {
          provider: "claude",
          endpoint: "https://api.anthropic.com/v1",
          model: "claude-3-sonnet-20240229",
        };

      case "gemini":
        return {
          provider: "gemini",
          endpoint: "https://generativelanguage.googleapis.com/v1beta",
          model: "gemini-pro",
        };

      default:
        throw new Error(
          `No default configuration available for provider: ${provider}`
        );
    }
  }

  /**
   * Create provider from environment variables
   */
  static createFromEnv(): AIProvider {
    const provider = (process.env.AI_PROVIDER || "ollama") as AIProviderType;
    const apiKey = process.env.AI_API_KEY;
    const endpoint = process.env.AI_ENDPOINT;
    const model = process.env.AI_MODEL;

    const defaultConfig = this.getDefaultConfig(provider);

    const config: AIConfig = {
      ...defaultConfig,
      provider,
      apiKey,
      endpoint: endpoint || defaultConfig.endpoint,
      model: model || defaultConfig.model!,
    };

    return this.create(config);
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): AIProviderType[] {
    return ["ollama", "openai", "claude", "gemini"];
  }

  /**
   * Check if a provider is supported
   */
  static isProviderSupported(provider: string): provider is AIProviderType {
    return this.getSupportedProviders().includes(provider as AIProviderType);
  }

  /**
   * Get provider information
   */
  static getProviderInfo(provider: AIProviderType): {
    name: string;
    description: string;
    requiresApiKey: boolean;
    defaultModel: string;
  } {
    switch (provider) {
      case "ollama":
        return {
          name: "Ollama",
          description: "Local AI models (LLaMA, Mistral, CodeLlama, etc.)",
          requiresApiKey: false,
          defaultModel: "llama3.2:1b",
        };

      case "openai":
        return {
          name: "OpenAI",
          description: "GPT-3.5, GPT-4, and other OpenAI models",
          requiresApiKey: true,
          defaultModel: "gpt-3.5-turbo",
        };

      case "claude":
        return {
          name: "Anthropic Claude",
          description: "Claude 3 models (Haiku, Sonnet, Opus)",
          requiresApiKey: true,
          defaultModel: "claude-3-sonnet-20240229",
        };

      case "gemini":
        return {
          name: "Google Gemini",
          description: "Gemini Pro and other Google AI models",
          requiresApiKey: true,
          defaultModel: "gemini-pro",
        };

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Create a smart provider (if supported)
   */
  static createSmartProvider(config: AIConfig): SmartAIProvider {
    const provider = this.create(config);

    if ("parseWithContext" in provider) {
      return provider as SmartAIProvider;
    }

    throw new Error(
      `Provider ${config.provider} does not support smart parsing capabilities`
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Helper function to create a provider with minimal configuration
 */
export function createProvider(
  providerType: AIProviderType,
  model?: string,
  apiKey?: string,
  endpoint?: string
): AIProvider {
  const defaultConfig = AIProviderFactory.getDefaultConfig(providerType);

  const config: AIConfig = {
    ...defaultConfig,
    provider: providerType,
    model: model || defaultConfig.model!,
    apiKey: apiKey,
    endpoint: endpoint || defaultConfig.endpoint,
  };

  return AIProviderFactory.create(config);
}

/**
 * Helper function to check if a provider supports smart parsing
 */
export function isSmartProvider(
  provider: AIProvider
): provider is SmartAIProvider {
  return "parseWithContext" in provider;
}

/**
 * Helper function to get all available provider types
 */
export function getAvailableProviders(): Array<{
  type: AIProviderType;
  info: ReturnType<typeof AIProviderFactory.getProviderInfo>;
}> {
  return AIProviderFactory.getSupportedProviders().map((type) => ({
    type,
    info: AIProviderFactory.getProviderInfo(type),
  }));
}
