/**
 * Syntax Flexibility Engine - Understands any kind of human input
 * Makes StressMaster understand slang, abbreviations, and random syntax
 */

export interface SyntaxPattern {
  pattern: RegExp;
  replacement: string;
  priority: number;
  description: string;
}

export interface CommandIntent {
  action: string;
  target: string;
  method?: string;
  count?: number;
  duration?: string;
  confidence: number;
}

export class SyntaxFlexibilityEngine {
  private static readonly SYNTAX_PATTERNS: SyntaxPattern[] = [
    // Action verbs - any way humans say "send"
    {
      pattern:
        /\b(blast|fire|spam|hit|pound|hammer|nuke|bomb|shoot|launch|trigger|execute|run|test|perform|do|make|send|post|put|get|delete|patch)\b/gi,
      replacement: "send",
      priority: 1,
      description: "Action verbs",
    },

    // Request counts - any way humans say numbers
    {
      pattern:
        /\b(\d+)\s*(requests?|calls?|times?|attempts?|shots?|hits?|blasts?|fires?|spams?|runs?|tests?|iterations?|rounds?|cycles?)\b/gi,
      replacement: "$1 requests",
      priority: 1,
      description: "Request counts",
    },

    // Duration patterns
    {
      pattern:
        /\b(?:for|over|during|in)\s+(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)\b/gi,
      replacement: "for $1 $2",
      priority: 2,
      description: "Duration patterns",
    },

    // URL patterns - any way humans specify URLs
    {
      pattern:
        /\b(?:to|at|on|hit|call|ping|reach|access|visit)\s+(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)\b/gi,
      replacement: "to $1",
      priority: 1,
      description: "URL patterns",
    },

    // Method patterns - any way humans specify HTTP methods
    {
      pattern:
        /\b(get|post|put|delete|patch|fetch|grab|pull|push|update|remove|create|add|insert)\b/gi,
      replacement: "$1",
      priority: 1,
      description: "HTTP methods",
    },

    // Header patterns - any way humans specify headers
    {
      pattern:
        /\b(?:with|and|include|add|set)\s+(?:header|headers?|auth|key|token)\s+([^,\s]+)\s*[:=]\s*([^\s,]+)/gi,
      replacement: "with header $1: $2",
      priority: 2,
      description: "Header patterns",
    },

    // Body patterns - any way humans specify request bodies
    {
      pattern:
        /\b(?:with|and|include|add|set)\s+(?:body|data|payload|content|json|data)\s*(\{[^}]*\})/gi,
      replacement: "with body $1",
      priority: 2,
      description: "Body patterns",
    },

    // Increment patterns - any way humans say "increment"
    {
      pattern:
        /\b(increment|increase|bump|up|raise|add|plus|next|auto|auto-increment|auto-increase)\s+(\w+)/gi,
      replacement: "increment $2",
      priority: 2,
      description: "Increment patterns",
    },

    // Load pattern variations
    {
      pattern:
        /\b(\d+)\s*(users?|virtual\s*users?|concurrent|parallel|simultaneous|at\s*once|together)\b/gi,
      replacement: "$1 users",
      priority: 2,
      description: "Load patterns",
    },

    // RPS patterns
    {
      pattern:
        /\b(\d+)\s*(rps|requests?\s*per\s*second|req\/s|reqs\/s|calls?\s*per\s*second)\b/gi,
      replacement: "$1 rps",
      priority: 2,
      description: "RPS patterns",
    },

    // Slang and abbreviations
    {
      pattern:
        /\b(pls|please|thx|thanks|ty|tysm|tia|asap|rn|right\s*now|now|immediately)\b/gi,
      replacement: "",
      priority: 3,
      description: "Slang removal",
    },

    // Filler words
    {
      pattern:
        /\b(like|um|uh|well|so|basically|actually|literally|you\s*know|i\s*mean)\b/gi,
      replacement: "",
      priority: 3,
      description: "Filler words",
    },

    // Multiple spaces and formatting
    {
      pattern: /\s+/g,
      replacement: " ",
      priority: 4,
      description: "Whitespace normalization",
    },
    {
      pattern: /^\s+|\s+$/g,
      replacement: "",
      priority: 4,
      description: "Trim whitespace",
    },
  ];

  /**
   * Normalize any kind of human input to standard command format
   */
  static normalizeInput(input: string): string {
    let normalized = input.toLowerCase();

    // Apply patterns in priority order
    const sortedPatterns = [...this.SYNTAX_PATTERNS].sort(
      (a, b) => a.priority - b.priority
    );

    for (const pattern of sortedPatterns) {
      normalized = normalized.replace(pattern.pattern, pattern.replacement);
    }

    return normalized;
  }

  /**
   * Extract command intent from any kind of input
   */
  static extractIntent(input: string): CommandIntent {
    const normalized = this.normalizeInput(input);
    const intent: CommandIntent = {
      action: "send",
      target: "",
      confidence: 0.5,
    };

    // Extract action
    const actionMatch = normalized.match(
      /\b(send|get|post|put|delete|patch|test|run|execute)\b/
    );
    if (actionMatch) {
      intent.action = actionMatch[1];
      intent.confidence += 0.2;
    }

    // Extract target URL
    const urlMatch = normalized.match(
      /(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/
    );
    if (urlMatch) {
      intent.target = urlMatch[1];
      intent.confidence += 0.3;
    }

    // Extract method
    const methodMatch = normalized.match(/\b(get|post|put|delete|patch)\b/);
    if (methodMatch) {
      intent.method = methodMatch[1].toUpperCase();
      intent.confidence += 0.1;
    }

    // Extract count
    const countMatch = normalized.match(/(\d+)\s*requests?/);
    if (countMatch) {
      intent.count = parseInt(countMatch[1]);
      intent.confidence += 0.1;
    }

    // Extract duration
    const durationMatch = normalized.match(
      /for\s+(\d+)\s*(seconds?|minutes?|hours?)/
    );
    if (durationMatch) {
      intent.duration = `${durationMatch[1]} ${durationMatch[2]}`;
      intent.confidence += 0.1;
    }

    return intent;
  }

  /**
   * Understand and fix common human mistakes
   */
  static fixCommonMistakes(input: string): string {
    let fixed = input;

    // Fix common URL mistakes
    fixed = fixed.replace(
      /\b(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
      (match, www, domain) => {
        if (!match.startsWith("http")) {
          return `https://${domain}`;
        }
        return match;
      }
    );

    // Fix common JSON mistakes
    fixed = fixed.replace(
      /(\w+):\s*([^,\s}]+)(?=[,\s}])/g,
      (match, key, value) => {
        // Add quotes around unquoted string values
        if (
          !value.startsWith('"') &&
          !value.startsWith("'") &&
          !/^\d+$/.test(value) &&
          value !== "true" &&
          value !== "false" &&
          value !== "null"
        ) {
          return `${key}: "${value}"`;
        }
        return match;
      }
    );

    // Fix common header mistakes
    fixed = fixed.replace(/(\w+)\s*=\s*([^\s,]+)/g, (match, key, value) => {
      if (
        key.toLowerCase().includes("header") ||
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("auth")
      ) {
        return `${key}: ${value}`;
      }
      return match;
    });

    return fixed;
  }

  /**
   * Suggest corrections for unclear input
   */
  static suggestCorrections(input: string): string[] {
    const suggestions: string[] = [];
    const normalized = this.normalizeInput(input);

    // Check for missing URL
    if (
      !normalized.includes("http") &&
      !normalized.match(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    ) {
      suggestions.push('Add a target URL (e.g., "to http://example.com")');
    }

    // Check for missing count - but only if input seems incomplete
    if (
      !normalized.match(/\d+\s*requests?/) &&
      this.isInputIncomplete(normalized)
    ) {
      suggestions.push('Specify number of requests (e.g., "5 requests")');
    }

    // Check for missing method - but only if input seems incomplete
    if (
      !normalized.match(/\b(get|post|put|delete|patch)\b/) &&
      this.isInputIncomplete(normalized)
    ) {
      suggestions.push('Specify HTTP method (e.g., "POST requests")');
    }

    // Check for missing body
    if (
      normalized.includes("post") ||
      normalized.includes("put") ||
      normalized.includes("patch")
    ) {
      if (!normalized.includes("body") && !normalized.includes("{")) {
        suggestions.push(
          'Add request body for POST/PUT/PATCH (e.g., "with body {...}")'
        );
      }
    }

    return suggestions;
  }

  private static isInputIncomplete(normalized: string): boolean {
    // Check if input has all essential components - be more flexible
    const hasMethod = /\b(get|post|put|delete|patch|send)\b/i.test(normalized);
    const hasUrl = /https?:\/\/[^\s]+/.test(normalized);
    const hasCount = /\d+\s+(requests?|send)/i.test(normalized);
    const hasBody = /\{.*\}/.test(normalized); // Has JSON body
    const hasHeaders = /header/i.test(normalized); // Has headers

    // If it has method, URL, count, and additional context (body/headers), it's complete
    if (hasMethod && hasUrl && hasCount && (hasBody || hasHeaders)) {
      return false;
    }

    // If it's missing key components, it's incomplete
    return !hasMethod || !hasUrl || !hasCount;
  }

  /**
   * Understand context and infer missing information
   */
  static inferContext(input: string): Record<string, any> {
    const context: Record<string, any> = {};
    const normalized = this.normalizeInput(input);

    // Infer HTTP method from context
    if (
      normalized.includes("get") ||
      normalized.includes("fetch") ||
      normalized.includes("grab")
    ) {
      context.inferredMethod = "GET";
    } else if (
      normalized.includes("post") ||
      normalized.includes("create") ||
      normalized.includes("add")
    ) {
      context.inferredMethod = "POST";
    } else if (normalized.includes("put") || normalized.includes("update")) {
      context.inferredMethod = "PUT";
    } else if (normalized.includes("delete") || normalized.includes("remove")) {
      context.inferredMethod = "DELETE";
    }

    // Infer test type from context
    if (
      normalized.includes("spike") ||
      normalized.includes("burst") ||
      normalized.includes("blast")
    ) {
      context.inferredTestType = "spike";
    } else if (
      normalized.includes("stress") ||
      normalized.includes("pressure") ||
      normalized.includes("load")
    ) {
      context.inferredTestType = "stress";
    } else if (
      normalized.includes("endurance") ||
      normalized.includes("long") ||
      normalized.includes("duration")
    ) {
      context.inferredTestType = "endurance";
    } else if (
      normalized.includes("volume") ||
      normalized.includes("many") ||
      normalized.includes("lots")
    ) {
      context.inferredTestType = "volume";
    }

    // Infer load pattern from context
    if (
      normalized.includes("users") ||
      normalized.includes("concurrent") ||
      normalized.includes("parallel")
    ) {
      context.inferredLoadPattern = "concurrent";
    } else if (
      normalized.includes("rps") ||
      normalized.includes("per second")
    ) {
      context.inferredLoadPattern = "rps";
    } else if (
      normalized.includes("total") ||
      normalized.includes("requests")
    ) {
      context.inferredLoadPattern = "total";
    }

    return context;
  }

  /**
   * Comprehensive input processing
   */
  static processInput(input: string): {
    normalized: string;
    intent: CommandIntent;
    context: Record<string, any>;
    suggestions: string[];
    fixed: string;
  } {
    const fixed = this.fixCommonMistakes(input);
    const normalized = this.normalizeInput(fixed);
    const intent = this.extractIntent(normalized);
    const context = this.inferContext(normalized);
    const suggestions = this.suggestCorrections(normalized);

    return {
      normalized,
      intent,
      context,
      suggestions,
      fixed,
    };
  }
}
