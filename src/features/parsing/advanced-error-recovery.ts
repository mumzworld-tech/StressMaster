import { LoadTestSpec } from "../../types/load-test-spec";
import { PatternLearner } from "./pattern-learner";

export interface RecoveryStrategy {
  name: string;
  description: string;
  confidence: number;
  apply: (input: string, currentSpec: LoadTestSpec) => LoadTestSpec;
}

export interface RecoveryResult {
  success: boolean;
  recoveredSpec: LoadTestSpec;
  strategy: string;
  confidence: number;
  improvements: string[];
}

export class AdvancedErrorRecovery {
  private static instance: AdvancedErrorRecovery;
  private patternLearner: PatternLearner;
  private strategies: RecoveryStrategy[] = [];

  private constructor() {
    this.patternLearner = PatternLearner.getInstance();
    this.initializeStrategies();
  }

  static getInstance(): AdvancedErrorRecovery {
    if (!AdvancedErrorRecovery.instance) {
      AdvancedErrorRecovery.instance = new AdvancedErrorRecovery();
    }
    return AdvancedErrorRecovery.instance;
  }

  /**
   * Attempt to recover from parsing errors using multiple strategies
   */
  attemptRecovery(
    input: string,
    failedSpec: LoadTestSpec,
    userId?: string
  ): RecoveryResult {
    const improvements: string[] = [];
    let bestResult: RecoveryResult = {
      success: false,
      recoveredSpec: failedSpec,
      strategy: "none",
      confidence: 0,
      improvements: [],
    };

    // Try each strategy and keep the best result
    for (const strategy of this.strategies) {
      try {
        const recoveredSpec = strategy.apply(input, failedSpec);
        const confidence = this.calculateRecoveryConfidence(
          input,
          recoveredSpec,
          userId
        );

        if (confidence > bestResult.confidence) {
          bestResult = {
            success: confidence > 0.5,
            recoveredSpec,
            strategy: strategy.name,
            confidence,
            improvements: this.identifyImprovements(input, recoveredSpec),
          };
        }
      } catch (error) {
        // Strategy failed, continue to next one
        continue;
      }
    }

    // Record the recovery attempt for learning
    this.patternLearner.recordParsingAttempt(
      input,
      bestResult.success,
      bestResult.confidence,
      this.extractFields(bestResult.recoveredSpec),
      userId
    );

    return bestResult;
  }

  /**
   * Get contextual recovery suggestions
   */
  getRecoverySuggestions(input: string, error: string): string[] {
    const suggestions: string[] = [];
    const lowerInput = input.toLowerCase();

    // URL-related suggestions
    if (error.includes("URL") || error.includes("url")) {
      if (!lowerInput.includes("http")) {
        suggestions.push('Add protocol: "http://" or "https://" to your URL');
      }
      if (!lowerInput.includes("://")) {
        suggestions.push(
          'Make sure your URL includes "://" (e.g., "http://example.com")'
        );
      }
    }

    // JSON-related suggestions
    if (error.includes("JSON") || error.includes("json")) {
      suggestions.push("Check for missing quotes around property names");
      suggestions.push("Ensure all brackets and braces are properly closed");
      suggestions.push("Remove trailing commas in objects and arrays");
    }

    // Method-related suggestions
    if (error.includes("method") || error.includes("HTTP")) {
      suggestions.push('Specify HTTP method: "GET", "POST", "PUT", "DELETE"');
      suggestions.push(
        'Try: "send 5 POST requests" or "blast 10 GET requests"'
      );
    }

    // Count-related suggestions
    if (error.includes("count") || error.includes("number")) {
      suggestions.push('Specify request count: "5 requests" or "10 requests"');
      suggestions.push('Use clear numbers: "send 3 requests"');
    }

    // Header-related suggestions
    if (error.includes("header") || error.includes("api-key")) {
      suggestions.push('Format headers: "with header x-api-key: your-key"');
      suggestions.push('Use colon separator: "header: value"');
    }

    return suggestions;
  }

  /**
   * Analyze what went wrong and provide specific fixes
   */
  analyzeFailure(
    input: string,
    error: string
  ): {
    issue: string;
    severity: "low" | "medium" | "high";
    fix: string;
    examples: string[];
  } {
    const lowerInput = input.toLowerCase();
    const lowerError = error.toLowerCase();

    // URL issues
    if (lowerError.includes("url") || lowerError.includes("invalid url")) {
      return {
        issue: "URL parsing failed",
        severity: "high",
        fix: "Ensure URL has proper protocol and format",
        examples: [
          "http://api.example.com/endpoint",
          "https://backbone.mumz.io/magento/qcomm-order",
        ],
      };
    }

    // JSON issues
    if (lowerError.includes("json") || lowerError.includes("syntax")) {
      return {
        issue: "JSON parsing failed",
        severity: "medium",
        fix: "Fix JSON syntax issues",
        examples: [
          '{"key": "value"}',
          '{"requestId": "test-1", "payload": []}',
        ],
      };
    }

    // Method issues
    if (lowerError.includes("method") || lowerError.includes("http")) {
      return {
        issue: "HTTP method not specified",
        severity: "medium",
        fix: "Specify HTTP method explicitly",
        examples: ["send 5 POST requests", "blast 10 GET requests"],
      };
    }

    // Default
    return {
      issue: "Parsing failed",
      severity: "medium",
      fix: "Check input format and try again",
      examples: [
        'send 3 POST requests to http://example.com with body {"test": "data"}',
      ],
    };
  }

  private initializeStrategies(): void {
    this.strategies = [
      {
        name: "URL Protocol Fix",
        description: "Add missing protocol to URLs",
        confidence: 0.8,
        apply: (input, spec) => {
          const updatedSpec = { ...spec };
          if (
            updatedSpec.requests[0]?.url &&
            !updatedSpec.requests[0].url.startsWith("http")
          ) {
            updatedSpec.requests[0].url = `http://${updatedSpec.requests[0].url}`;
          }
          return updatedSpec;
        },
      },
      {
        name: "JSON Cleanup",
        description: "Fix common JSON syntax issues",
        confidence: 0.7,
        apply: (input, spec) => {
          const updatedSpec = { ...spec };
          if (updatedSpec.requests[0]?.body) {
            updatedSpec.requests[0].body = this.cleanupJson(
              updatedSpec.requests[0].body
            );
          }
          return updatedSpec;
        },
      },
      {
        name: "Method Inference",
        description: "Infer HTTP method from context",
        confidence: 0.6,
        apply: (input, spec) => {
          const updatedSpec = { ...spec };
          if (!updatedSpec.requests[0]?.method) {
            const method = this.inferMethod(input);
            if (method) {
              updatedSpec.requests[0] = {
                ...updatedSpec.requests[0],
                method: method as any,
              };
            }
          }
          return updatedSpec;
        },
      },
      {
        name: "Count Extraction",
        description: "Extract request count from input",
        confidence: 0.5,
        apply: (input, spec) => {
          const updatedSpec = { ...spec };
          const count = this.extractCount(input);
          if (count && !updatedSpec.loadPattern?.virtualUsers) {
            updatedSpec.loadPattern = {
              ...updatedSpec.loadPattern,
              virtualUsers: count,
            };
          }
          return updatedSpec;
        },
      },
      {
        name: "Header Extraction",
        description: "Extract headers from input text",
        confidence: 0.4,
        apply: (input, spec) => {
          const updatedSpec = { ...spec };
          const headers = this.extractHeaders(input);
          if (Object.keys(headers).length > 0) {
            updatedSpec.requests[0] = {
              ...updatedSpec.requests[0],
              headers: { ...updatedSpec.requests[0]?.headers, ...headers },
            };
          }
          return updatedSpec;
        },
      },
    ];
  }

  private calculateRecoveryConfidence(
    input: string,
    spec: LoadTestSpec,
    userId?: string
  ): number {
    let confidence = 0;

    // Base confidence from pattern learner
    confidence += this.patternLearner.getConfidenceBoost(input, userId);

    // URL confidence
    if (spec.requests[0]?.url) {
      confidence += 0.2;
      if (spec.requests[0].url.startsWith("http")) {
        confidence += 0.1;
      }
    }

    // Method confidence
    if (spec.requests[0]?.method) {
      confidence += 0.15;
    }

    // Body confidence
    if (spec.requests[0]?.body) {
      confidence += 0.1;
      try {
        JSON.parse(spec.requests[0].body);
        confidence += 0.1;
      } catch {
        // Invalid JSON, no bonus
      }
    }

    // Count confidence
    if (spec.loadPattern?.virtualUsers) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private identifyImprovements(input: string, spec: LoadTestSpec): string[] {
    const improvements: string[] = [];

    if (spec.requests[0]?.url) {
      improvements.push("✅ URL extracted successfully");
    }
    if (spec.requests[0]?.method) {
      improvements.push("✅ HTTP method identified");
    }
    if (spec.requests[0]?.body) {
      improvements.push("✅ Request body parsed");
    }
    if (spec.loadPattern?.virtualUsers) {
      improvements.push("✅ Request count determined");
    }

    return improvements;
  }

  private extractFields(spec: LoadTestSpec): any {
    return {
      urls: spec.requests.map((r) => r.url).filter(Boolean),
      methods: spec.requests.map((r) => r.method).filter(Boolean),
      headers: spec.requests.reduce((acc, r) => ({ ...acc, ...r.headers }), {}),
      bodies: spec.requests.map((r) => r.body || r.payload).filter(Boolean),
      variables: [],
    };
  }

  private cleanupJson(jsonString: string): string {
    let cleaned = jsonString;

    // Fix smart quotes
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/['']/g, "'");

    // Remove trailing commas
    cleaned = cleaned.replace(/,\s*}/g, "}");
    cleaned = cleaned.replace(/,\s*]/g, "]");

    // Fix missing quotes around property names
    cleaned = cleaned.replace(/(\w+):/g, '"$1":');

    return cleaned;
  }

  private inferMethod(input: string): string | null {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes("post") ||
      lowerInput.includes("create") ||
      lowerInput.includes("send")
    ) {
      return "POST";
    }
    if (
      lowerInput.includes("get") ||
      lowerInput.includes("fetch") ||
      lowerInput.includes("retrieve")
    ) {
      return "GET";
    }
    if (lowerInput.includes("put") || lowerInput.includes("update")) {
      return "PUT";
    }
    if (lowerInput.includes("delete") || lowerInput.includes("remove")) {
      return "DELETE";
    }

    return null;
  }

  private extractCount(input: string): number | null {
    const countMatch = input.match(/(\d+)\s+requests?/i);
    if (countMatch) {
      return parseInt(countMatch[1]);
    }

    // Look for numbers that might be counts
    const numbers = input.match(/\b(\d+)\b/g);
    if (numbers && numbers.length === 1) {
      const num = parseInt(numbers[0]);
      if (num > 0 && num <= 100000) {
        return num;
      }
    }

    return null;
  }

  private extractHeaders(input: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // Look for "header key: value" patterns
    const headerPattern = /(?:header|with)\s+([a-zA-Z-]+):\s*([^\s,;]+)/gi;
    let match;
    while ((match = headerPattern.exec(input)) !== null) {
      headers[match[1]] = match[2];
    }

    return headers;
  }
}
