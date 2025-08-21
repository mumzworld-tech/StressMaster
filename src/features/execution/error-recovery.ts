/**
 * Intelligent Error Recovery - Automatically fixes common errors
 * Makes StressMaster resilient to any kind of input or execution errors
 */

export interface ErrorContext {
  originalInput: string;
  errorType: string;
  errorMessage: string;
  currentState: any;
  suggestions: string[];
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  canHandle: (error: Error, context: ErrorContext) => boolean;
  apply: (error: Error, context: ErrorContext) => any;
  priority: number;
}

export class IntelligentErrorRecovery {
  private static readonly RECOVERY_STRATEGIES: RecoveryStrategy[] = [
    // JSON parsing errors
    {
      name: "JSON Quote Fix",
      description: "Fix smart quotes and malformed JSON",
      canHandle: (error: Error) =>
        error.message.includes("Unexpected token") ||
        error.message.includes("JSON"),
      apply: (error: Error, context: ErrorContext) => {
        return context.originalInput
          .replace(/[""]/g, '"')
          .replace(/['']/g, "'")
          .replace(/`/g, '"')
          .replace(/'/g, '"');
      },
      priority: 1,
    },

    // URL errors
    {
      name: "URL Normalization",
      description: "Fix malformed URLs",
      canHandle: (error: Error) =>
        error.message.includes("URL") || error.message.includes("ENOTFOUND"),
      apply: (error: Error, context: ErrorContext) => {
        const urlMatch = context.originalInput.match(
          /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
        );
        if (urlMatch) {
          return context.originalInput.replace(
            urlMatch[1],
            `https://${urlMatch[1]}`
          );
        }
        return context.originalInput;
      },
      priority: 1,
    },

    // Missing fields
    {
      name: "Missing Field Completion",
      description: "Add missing required fields",
      canHandle: (error: Error) =>
        error.message.includes("required") || error.message.includes("missing"),
      apply: (error: Error, context: ErrorContext) => {
        let fixed = context.originalInput;

        // Add common missing fields
        if (
          error.message.includes("requestId") &&
          !fixed.includes("requestId")
        ) {
          fixed += " requestId req-" + Date.now();
        }

        if (
          error.message.includes("externalId") &&
          !fixed.includes("externalId")
        ) {
          fixed += " externalId ext-" + Date.now();
        }

        if (
          error.message.includes("x-api-key") &&
          !fixed.includes("x-api-key")
        ) {
          fixed += " x-api-key default-key";
        }

        return fixed;
      },
      priority: 2,
    },

    // Method inference
    {
      name: "Method Inference",
      description: "Infer HTTP method from context",
      canHandle: (error: Error, context: ErrorContext) => {
        const normalized = context.originalInput.toLowerCase();
        return (
          !normalized.includes("get") &&
          !normalized.includes("post") &&
          !normalized.includes("put") &&
          !normalized.includes("delete")
        );
      },
      apply: (error: Error, context: ErrorContext) => {
        const normalized = context.originalInput.toLowerCase();

        if (
          normalized.includes("create") ||
          normalized.includes("add") ||
          normalized.includes("new")
        ) {
          return context.originalInput.replace(
            /(\d+)\s*requests?/,
            "$1 POST requests"
          );
        }

        if (
          normalized.includes("update") ||
          normalized.includes("modify") ||
          normalized.includes("change")
        ) {
          return context.originalInput.replace(
            /(\d+)\s*requests?/,
            "$1 PUT requests"
          );
        }

        if (normalized.includes("delete") || normalized.includes("remove")) {
          return context.originalInput.replace(
            /(\d+)\s*requests?/,
            "$1 DELETE requests"
          );
        }

        // Default to GET
        return context.originalInput.replace(
          /(\d+)\s*requests?/,
          "$1 GET requests"
        );
      },
      priority: 2,
    },

    // Count inference
    {
      name: "Count Inference",
      description: "Infer request count from context",
      canHandle: (error: Error, context: ErrorContext) => {
        const normalized = context.originalInput.toLowerCase();
        return !normalized.match(/\d+\s*requests?/);
      },
      apply: (error: Error, context: ErrorContext) => {
        const normalized = context.originalInput.toLowerCase();

        if (normalized.includes("spike") || normalized.includes("burst")) {
          return context.originalInput.replace(/(requests?)/, "10 $1");
        }

        if (normalized.includes("stress") || normalized.includes("load")) {
          return context.originalInput.replace(/(requests?)/, "100 $1");
        }

        if (normalized.includes("endurance") || normalized.includes("long")) {
          return context.originalInput.replace(/(requests?)/, "1000 $1");
        }

        // Default to 1 request
        return context.originalInput.replace(/(requests?)/, "1 $1");
      },
      priority: 2,
    },

    // Body completion
    {
      name: "Body Completion",
      description: "Add default request body",
      canHandle: (error: Error, context: ErrorContext) => {
        const normalized = context.originalInput.toLowerCase();
        return (
          (normalized.includes("post") || normalized.includes("put")) &&
          !normalized.includes("body") &&
          !normalized.includes("{")
        );
      },
      apply: (error: Error, context: ErrorContext) => {
        return context.originalInput + ' with body {"test": "data"}';
      },
      priority: 3,
    },

    // Header completion
    {
      name: "Header Completion",
      description: "Add default headers",
      canHandle: (error: Error, context: ErrorContext) => {
        const normalized = context.originalInput.toLowerCase();
        return (
          !normalized.includes("header") && !normalized.includes("x-api-key")
        );
      },
      apply: (error: Error, context: ErrorContext) => {
        return (
          context.originalInput + " with header Content-Type: application/json"
        );
      },
      priority: 3,
    },
  ];

  /**
   * Attempt to recover from an error
   */
  static recoverFromError(
    error: Error,
    context: ErrorContext
  ): {
    recovered: boolean;
    fixedInput?: string;
    suggestions: string[];
    appliedStrategies: string[];
  } {
    const result = {
      recovered: false,
      fixedInput: undefined as string | undefined,
      suggestions: [] as string[],
      appliedStrategies: [] as string[],
    };

    // Sort strategies by priority
    const sortedStrategies = [...this.RECOVERY_STRATEGIES].sort(
      (a, b) => a.priority - b.priority
    );

    let currentInput = context.originalInput;

    for (const strategy of sortedStrategies) {
      if (strategy.canHandle(error, context)) {
        try {
          const fixed = strategy.apply(error, context);
          if (fixed && fixed !== currentInput) {
            currentInput = fixed;
            result.appliedStrategies.push(strategy.name);
            result.suggestions.push(`Applied ${strategy.description}`);
          }
        } catch (strategyError) {
          // Strategy failed, continue to next one
          const errorMessage =
            strategyError instanceof Error
              ? strategyError.message
              : String(strategyError);
          result.suggestions.push(
            `Strategy ${strategy.name} failed: ${errorMessage}`
          );
        }
      }
    }

    if (result.appliedStrategies.length > 0) {
      result.recovered = true;
      result.fixedInput = currentInput;
    }

    return result;
  }

  /**
   * Analyze error patterns and suggest improvements
   */
  static analyzeErrorPatterns(errors: Error[]): {
    commonPatterns: string[];
    suggestions: string[];
    preventionTips: string[];
  } {
    const patterns: Record<string, number> = {};
    const suggestions: string[] = [];
    const preventionTips: string[] = [];

    errors.forEach((error) => {
      const errorType = this.categorizeError(error);
      patterns[errorType] = (patterns[errorType] || 0) + 1;
    });

    // Generate suggestions based on patterns
    if (patterns["JSON_PARSE"] > 0) {
      suggestions.push(
        'Use straight quotes (") instead of smart quotes (") in JSON'
      );
      preventionTips.push(
        "Copy-paste JSON from a text editor, not Word/Google Docs"
      );
    }

    if (patterns["URL_ERROR"] > 0) {
      suggestions.push("Include full URLs with protocol (https://)");
      preventionTips.push(
        "Always specify complete URLs including http:// or https://"
      );
    }

    if (patterns["MISSING_FIELDS"] > 0) {
      suggestions.push(
        "Include required fields like requestId, externalId, or x-api-key"
      );
      preventionTips.push(
        'Use templates: "send X requests to URL with header x-api-key: VALUE and body {...}"'
      );
    }

    if (patterns["METHOD_MISSING"] > 0) {
      suggestions.push("Specify HTTP method (GET, POST, PUT, DELETE)");
      preventionTips.push(
        'Use clear verbs: "send X POST requests" or "GET X requests"'
      );
    }

    return {
      commonPatterns: Object.keys(patterns),
      suggestions,
      preventionTips,
    };
  }

  /**
   * Categorize error types
   */
  private static categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("unexpected token") || message.includes("json")) {
      return "JSON_PARSE";
    }

    if (
      message.includes("url") ||
      message.includes("enotfound") ||
      message.includes("dns")
    ) {
      return "URL_ERROR";
    }

    if (message.includes("required") || message.includes("missing")) {
      return "MISSING_FIELDS";
    }

    if (message.includes("method") || message.includes("http")) {
      return "METHOD_MISSING";
    }

    if (message.includes("timeout") || message.includes("connection")) {
      return "NETWORK_ERROR";
    }

    if (
      message.includes("authentication") ||
      message.includes("unauthorized")
    ) {
      return "AUTH_ERROR";
    }

    return "UNKNOWN";
  }

  /**
   * Generate helpful error messages
   */
  static generateHelpfulMessage(error: Error, context: ErrorContext): string {
    const errorType = this.categorizeError(error);

    switch (errorType) {
      case "JSON_PARSE":
        return `JSON parsing error: ${error.message}. Try using straight quotes (") instead of smart quotes (").`;

      case "URL_ERROR":
        return `URL error: ${error.message}. Make sure to include the full URL with protocol (https://).`;

      case "MISSING_FIELDS":
        return `Missing required field: ${error.message}. Add the missing field to your request.`;

      case "METHOD_MISSING":
        return `HTTP method not specified. Try: "send X POST requests" or "GET X requests".`;

      case "NETWORK_ERROR":
        return `Network error: ${error.message}. Check your internet connection and try again.`;

      case "AUTH_ERROR":
        return `Authentication error: ${error.message}. Check your API key or credentials.`;

      default:
        return `Error: ${error.message}. Try rephrasing your command more clearly.`;
    }
  }

  /**
   * Learn from successful recoveries
   */
  static learnFromRecovery(
    originalInput: string,
    fixedInput: string,
    success: boolean
  ): void {
    // This could be used to improve recovery strategies over time
    // For now, we'll just log the learning
    if (success) {
      console.log(`🔧 Learned recovery: "${originalInput}" → "${fixedInput}"`);
    }
  }
}
