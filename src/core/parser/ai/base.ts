import {
  AIProvider,
  AIProviderConfig,
  CompletionRequest,
  CompletionResponse,
} from "./types";

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
