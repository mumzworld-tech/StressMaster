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
 * OpenRouter Provider - Supports multiple AI models through OpenRouter API
 */
export class OpenRouterProvider
  extends BaseAIProvider
  implements SmartAIProvider
{
  private static readonly DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1";
  private static readonly DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

  constructor(config: import("./types").AIProviderConfig) {
    super({
      endpoint: OpenRouterProvider.DEFAULT_ENDPOINT,
      ...config,
      model: config.model || OpenRouterProvider.DEFAULT_MODEL,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error("OpenRouter API key is required");
    }
    this.isInitialized = true;
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const startTime = Date.now();

    return this.retryOperation(async () => {
      const systemPrompt = PromptBuilder.getSystemPrompt();
      const endpoint =
        this.config.endpoint || OpenRouterProvider.DEFAULT_ENDPOINT;

      let response: Response;
      try {
        response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: request.model || this.config.model,
            max_tokens: request.maxTokens || 2000,
            temperature: request.temperature || 0.1,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: request.prompt },
            ],
          }),
        });
      } catch (fetchError: any) {
        // Handle network errors with better diagnostics
        if (fetchError?.code === "ECONNREFUSED" || fetchError?.cause?.code === "ECONNREFUSED") {
          throw new Error(
            `Cannot connect to OpenRouter API (${endpoint}). ` +
            `This usually means:\n` +
            `  1. No internet connection\n` +
            `  2. Firewall/proxy blocking the connection\n` +
            `  3. DNS resolution issue\n` +
            `  4. OpenRouter service temporarily unavailable\n\n` +
            `The fallback parser will be used instead.`
          );
        }
        if (fetchError?.code === "ENOTFOUND" || fetchError?.cause?.code === "ENOTFOUND") {
          throw new Error(
            `Cannot resolve OpenRouter hostname (${endpoint}). ` +
            `Check your internet connection and DNS settings.`
          );
        }
        throw new Error(
          `Network error connecting to OpenRouter: ${fetchError?.message || fetchError}`
        );
      }

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
          provider: "openrouter",
          duration,
        },
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return "OpenRouter";
  }

  async parseWithContext(context: ParseContext): Promise<SmartParseResponse> {
    return this.parseWithRecovery(context);
  }

  async validateAndCorrect(
    response: string,
    _context: ParseContext
  ): Promise<LoadTestSpec> {
    // Basic validation - ensure it's valid JSON
    try {
      const parsed = JSON.parse(response);
      return parsed as LoadTestSpec;
    } catch {
      // If not valid JSON, try to fix common issues
      const cleaned = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");
      try {
        return JSON.parse(cleaned) as LoadTestSpec;
      } catch {
        throw new Error("Invalid JSON response from OpenRouter");
      }
    }
  }

  async parseWithRecovery(context: ParseContext): Promise<SmartParseResponse> {
    // OpenRouter supports multiple models, so we can try different ones
    const models = [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4",
      "openai/gpt-3.5-turbo",
      "google/gemini-pro",
    ];

    for (const model of models) {
      try {
        const response = await this.generateCompletion({
          prompt: context.originalInput,
          model,
          temperature: 0.1,
          maxTokens: 2000,
        });

        const spec = await this.validateAndCorrect(response.response, context);

        return {
          spec,
          confidence: 0.9,
          assumptions: [],
          warnings: [],
          suggestions: [],
        };
      } catch (error) {
        console.warn(`OpenRouter model ${model} failed: ${error}`);
        continue;
      }
    }

    throw new Error("All OpenRouter models failed");
  }
}
