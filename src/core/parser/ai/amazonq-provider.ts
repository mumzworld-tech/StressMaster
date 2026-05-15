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
 * Amazon Q Provider - Supports Amazon Q Developer models via API
 */
export class AmazonQProvider extends BaseAIProvider implements SmartAIProvider {
  private static readonly DEFAULT_ENDPOINT =
    "https://q.us-east-1.amazonaws.com";
  private static readonly DEFAULT_MODEL = "amazon.q-developer";

  constructor(config: import("./types").AIProviderConfig) {
    super({
      endpoint: AmazonQProvider.DEFAULT_ENDPOINT,
      ...config,
      model: config.model || AmazonQProvider.DEFAULT_MODEL,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error("Amazon Q API key is required");
    }
    this.isInitialized = true;
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const startTime = Date.now();

    return this.retryOperation(async () => {
      const systemPrompt = PromptBuilder.getSystemPrompt();

      // Amazon Q uses a different API structure
      // Note: This is a simplified implementation - actual Amazon Q API may vary
      const response = await fetch(`${this.config.endpoint}/v1/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model || this.config.model,
          prompt: `${systemPrompt}\n\n${request.prompt}`,
          max_tokens: request.maxTokens || 2000,
          temperature: request.temperature || 0.1,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        throw new Error(
          `Amazon Q API error: ${response.status} - ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const data = (await response.json()) as any;
      const duration = Date.now() - startTime;

      return {
        response: data.choices?.[0]?.text || data.text || data.content || "",
        model: data.model || this.config.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        metadata: {
          provider: "amazonq",
          duration,
        },
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Amazon Q health check - adjust endpoint as needed
      const response = await fetch(`${this.config.endpoint}/health`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      // If health check endpoint doesn't exist, consider it healthy if initialized
      return this.isInitialized;
    }
  }

  getProviderName(): string {
    return "Amazon Q";
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
        .replace(/```\n?/g, "")
        .trim();
      try {
        return JSON.parse(cleaned) as LoadTestSpec;
      } catch {
        throw new Error("Invalid JSON response from Amazon Q");
      }
    }
  }

  async parseWithRecovery(context: ParseContext): Promise<SmartParseResponse> {
    try {
      const response = await this.generateCompletion({
        prompt: context.originalInput,
        temperature: 0.1,
        maxTokens: 2000,
        format: "json",
      });

      const spec = await this.validateAndCorrect(response.response, context);

      return {
        spec,
        confidence: 0.8,
        assumptions: [],
        warnings: [],
        suggestions: [],
      };
    } catch (error) {
      throw new Error(`Amazon Q parsing failed: ${(error as Error).message}`);
    }
  }
}
