import { LoadTestSpec } from "../../../types";
import { PromptBuilder } from "../prompt-builder";
import {
  CompletionRequest,
  CompletionResponse,
  ParseContext,
  SmartAIProvider,
  SmartParseResponse,
} from "./types";
import { BaseAIProvider } from "./base";

/**
 * Claude Provider - Supports Anthropic Claude models
 */
export class ClaudeProvider extends BaseAIProvider implements SmartAIProvider {
  private static readonly DEFAULT_ENDPOINT = "https://api.anthropic.com/v1";
  private static readonly OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";
  private static readonly DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
  private static readonly API_VERSION = "2023-06-01";
  private useOpenRouter: boolean = false;

  constructor(config: import("./types").AIProviderConfig) {
    super({
      ...config,
      endpoint: ClaudeProvider.DEFAULT_ENDPOINT,
      model: config.model || ClaudeProvider.DEFAULT_MODEL,
    });

    // Check if using OpenRouter (API key starts with sk-or-)
    this.useOpenRouter = config.apiKey?.startsWith("sk-or-") || false;
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
    _context: ParseContext
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
    } catch {
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
    _context: ParseContext
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
