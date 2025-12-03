import {
  AIConfig,
  AIProvider,
  AIProviderConfig,
  AIProviderType,
  SmartAIProvider,
} from "./types";
import { OpenAIProvider } from "./openai-provider";
import { ClaudeProvider } from "./claude-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import { AmazonQProvider } from "./amazonq-provider";
import { GeminiProvider } from "./gemini-provider";

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

      case "openrouter":
        if (!config.apiKey) {
          throw new Error(
            "OpenRouter API key is required. Set AI_API_KEY environment variable."
          );
        }
        return new OpenRouterProvider(providerConfig);

      case "amazonq":
        if (!config.apiKey) {
          throw new Error(
            "Amazon Q API key is required. Set AI_API_KEY environment variable."
          );
        }
        return new AmazonQProvider(providerConfig);

      default:
        throw new Error(
          `Unsupported AI provider: ${config.provider}. Supported providers: openai, claude, gemini, openrouter, amazonq`
        );
    }
  }

  /**
   * Get default configuration for a provider
   */
  static getDefaultConfig(provider: AIProviderType): Partial<AIConfig> {
    switch (provider) {
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

      case "openrouter":
        return {
          provider: "openrouter",
          endpoint: "https://openrouter.ai/api/v1",
          model: "anthropic/claude-3.5-sonnet",
        };

      case "amazonq":
        return {
          provider: "amazonq",
          endpoint: "https://q.us-east-1.amazonaws.com",
          model: "amazon.q-developer",
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
    const provider = (process.env.AI_PROVIDER || "claude") as AIProviderType;
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
    return ["openai", "claude", "gemini", "openrouter", "amazonq"];
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

      case "openrouter":
        return {
          name: "OpenRouter",
          description:
            "Access to multiple AI models (Claude, GPT, Gemini) through OpenRouter",
          requiresApiKey: true,
          defaultModel: "anthropic/claude-3.5-sonnet",
        };

      case "amazonq":
        return {
          name: "Amazon Q",
          description: "Amazon Q Developer AI models",
          requiresApiKey: true,
          defaultModel: "amazon.q-developer",
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
