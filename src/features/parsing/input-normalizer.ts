/**
 * Input Normalizer - Handles any kind of human input variations
 * Makes StressMaster bulletproof against random human syntax
 */

export class InputNormalizer {
  /**
   * Normalize any kind of quotes to standard JSON quotes
   */
  static normalizeQuotes(input: string): string {
    return (
      input
        // Smart quotes and curly quotes
        .replace(/[""]/g, '"') // Smart double quotes
        .replace(/['']/g, "'") // Smart single quotes
        .replace(/['']/g, "'") // Curly single quotes
        .replace(/[""]/g, '"') // Curly double quotes
        // Backticks and other variations
        .replace(/`/g, '"') // Backticks to double quotes
        .replace(/'/g, '"') // Single quotes to double quotes
        // Fix common quote issues
        .replace(/""/g, '"') // Double double quotes
        .replace(/''/g, "'")
    ); // Double single quotes
  }

  /**
   * Normalize common syntax variations to standard commands
   */
  static normalizeSyntax(input: string): string {
    let normalized = input.toLowerCase();

    // Common request verbs
    const requestVerbs = [
      "send",
      "run",
      "test",
      "hit",
      "fire",
      "blast",
      "spam",
      "execute",
      "perform",
      "trigger",
      "launch",
      "start",
      "initiate",
      "dispatch",
      "submit",
      "push",
    ];

    // Common request nouns
    const requestNouns = [
      "requests",
      "request",
      "calls",
      "call",
      "times",
      "time",
      "attempts",
      "attempt",
    ];

    // Common HTTP methods
    const httpMethods = {
      get: "GET",
      post: "POST",
      put: "PUT",
      delete: "DELETE",
      patch: "PATCH",
    };

    // Normalize HTTP methods
    Object.entries(httpMethods).forEach(([method, standard]) => {
      const regex = new RegExp(`\\b${method}\\b`, "gi");
      normalized = normalized.replace(regex, standard);
    });

    return normalized;
  }

  /**
   * Extract and normalize numbers from various formats
   */
  static extractNumbers(input: string): number[] {
    const numbers: number[] = [];

    // Match various number formats
    const patterns = [
      /\b(\d+)\b/g, // Plain numbers
      /\b(\d+)\s*(?:requests?|calls?|times?|users?)/gi, // Numbers with context
      /\b(?:send|run|test|hit|fire|blast|spam)\s+(\d+)/gi, // Numbers after verbs
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const num = parseInt(match[1]);
        if (num > 0 && num <= 10000) {
          // Reasonable range
          numbers.push(num);
        }
      }
    });

    return [...new Set(numbers)]; // Remove duplicates
  }

  /**
   * Extract URLs from various formats
   */
  static extractUrls(input: string): string[] {
    const urls: string[] = [];

    // Match various URL formats
    const patterns = [
      /(https?:\/\/[^\s]+)/gi, // Full URLs
      /(www\.[^\s]+)/gi, // www URLs
      /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi, // Domain names with optional paths
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        let url = match[1];

        // Normalize URL
        if (!url.startsWith("http")) {
          url = "https://" + url;
        }

        if (this.isValidUrl(url)) {
          urls.push(url);
        }
      }
    });

    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Extract JSON-like structures from input
   */
  static extractJsonStructures(input: string): string[] {
    const jsonStructures: string[] = [];

    // Try to find JSON in various contexts
    const patterns = [
      /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g, // Basic JSON objects
      /\[(?:[^\[\]]|(?:\{[^{}]*\}))*\]/g, // JSON arrays
      /body\s*(\{[^}]*\})/gi, // JSON after "body"
      /payload\s*(\{[^}]*\})/gi, // JSON after "payload"
      /with\s*(\{[^}]*\})/gi, // JSON after "with"
      /containing\s*(\{[^}]*\})/gi, // JSON after "containing"
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const jsonStr = match[1] || match[0];
        const normalized = this.normalizeQuotes(jsonStr);

        if (this.isValidJson(normalized)) {
          jsonStructures.push(normalized);
        }
      }
    });

    return jsonStructures;
  }

  /**
   * Extract headers from various formats
   */
  static extractHeaders(input: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // Common header patterns
    const patterns = [
      /(?:header|headers?)\s+([^:]+):\s*([^\s]+)/gi,
      /(?:with|and)\s+header\s+([^:]+):\s*([^\s]+)/gi,
      /x-api-key\s+([^\s]+)/gi,
      /authorization\s+(?:bearer\s+)?([^\s]+)/gi,
      /content-type\s+([^\s]+)/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const key = match[1]?.toLowerCase() || "x-api-key";
        const value = match[2] || match[1];

        if (key && value) {
          headers[key] = value;
        }
      }
    });

    return headers;
  }

  /**
   * Extract increment instructions
   */
  static extractIncrementInstructions(input: string): string[] {
    const instructions: string[] = [];

    const patterns = [
      /increment\s+(\w+)/gi,
      /(\w+)\s+should\s+increment/gi,
      /(\w+)\s+needs\s+to\s+increment/gi,
      /(\w+)\s+must\s+increment/gi,
      /(\w+)\s+increment/gi,
      /increment\s+the\s+(\w+)/gi,
      /make\s+(\w+)\s+increment/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const field = match[1];
        if (field && !instructions.includes(field.toLowerCase())) {
          instructions.push(field.toLowerCase());
        }
      }
    });

    return instructions;
  }

  /**
   * Comprehensive input normalization
   */
  static normalizeInput(input: string): NormalizedInput {
    const normalized = this.normalizeQuotes(input);
    const syntaxNormalized = this.normalizeSyntax(normalized);

    return {
      original: input,
      normalized: syntaxNormalized,
      numbers: this.extractNumbers(input),
      urls: this.extractUrls(input),
      jsonStructures: this.extractJsonStructures(input),
      headers: this.extractHeaders(input),
      incrementInstructions: this.extractIncrementInstructions(input),
    };
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate JSON format
   */
  private static isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }
}

export interface NormalizedInput {
  original: string;
  normalized: string;
  numbers: number[];
  urls: string[];
  jsonStructures: string[];
  headers: Record<string, string>;
  incrementInstructions: string[];
}
