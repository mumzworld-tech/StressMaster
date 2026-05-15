import { LoadTestSpec } from "../../../types";
import { PromptBuilder } from "../prompt-builder";
import {
  Assumption,
  CompletionRequest,
  CompletionResponse,
  ParseContext,
  SmartAIProvider,
  SmartParseResponse,
} from "./types";
import { BaseAIProvider } from "./base";

/**
 * OpenAI Provider - Supports GPT models with smart parsing capabilities
 */
export class OpenAIProvider extends BaseAIProvider implements SmartAIProvider {
  private static readonly DEFAULT_ENDPOINT = "https://api.openai.com/v1";
  private static readonly DEFAULT_MODEL = "gpt-3.5-turbo";

  constructor(config: import("./types").AIProviderConfig) {
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
    } catch {
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
    } catch {
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
    _response: CompletionResponse
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
    _spec: LoadTestSpec,
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
    _context: ParseContext
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
