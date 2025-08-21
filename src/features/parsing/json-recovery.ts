/**
 * JSON Recovery - Handles any kind of malformed JSON from human input
 * Makes StressMaster bulletproof against random JSON formatting
 */

export class JsonRecovery {
  /**
   * Try multiple strategies to recover valid JSON
   */
  static recoverJson(input: string): string | null {
    const strategies = [
      this.tryDirectParse,
      this.fixSmartQuotes,
      this.fixTrailingCommas,
      this.fixMissingQuotes,
      this.fixWhitespace,
      this.extractPartialJson,
      this.constructFromKeywords,
      this.combineFixes,
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy(input);
        if (result && this.isValidJson(result)) {
          return result;
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    return null;
  }

  /**
   * Strategy 1: Try direct parse
   */
  private static tryDirectParse(input: string): string | null {
    JSON.parse(input);
    return input;
  }

  /**
   * Strategy 2: Fix smart quotes and curly quotes
   */
  private static fixSmartQuotes(input: string): string {
    return input
      .replace(/[""]/g, '"') // Smart double quotes
      .replace(/['']/g, "'") // Smart single quotes
      .replace(/['']/g, "'") // Curly single quotes
      .replace(/[""]/g, '"') // Curly double quotes
      .replace(/`/g, '"') // Backticks
      .replace(/'/g, '"'); // Single quotes
  }

  /**
   * Strategy 3: Fix trailing commas
   */
  private static fixTrailingCommas(input: string): string {
    return input
      .replace(/,\s*}/g, "}") // Trailing commas in objects
      .replace(/,\s*]/g, "]") // Trailing commas in arrays
      .replace(/,\s*,/g, ","); // Double commas
  }

  /**
   * Strategy 4: Fix missing quotes around keys
   */
  private static fixMissingQuotes(input: string): string {
    return (
      input
        // Fix unquoted keys in objects
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix unquoted string values
        .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2')
        // Fix unquoted string values at end
        .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/g, ':"$1"')
    );
  }

  /**
   * Strategy 5: Fix whitespace issues
   */
  private static fixWhitespace(input: string): string {
    return input
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\s*:\s*/g, ": ") // Fix spacing around colons
      .replace(/\s*,\s*/g, ", ") // Fix spacing around commas
      .replace(/\s*{\s*/g, "{") // Fix spacing around braces
      .replace(/\s*}\s*/g, "}") // Fix spacing around braces
      .replace(/\s*\[\s*/g, "[") // Fix spacing around brackets
      .replace(/\s*\]\s*/g, "]") // Fix spacing around brackets
      .trim();
  }

  /**
   * Strategy 6: Extract partial JSON
   */
  private static extractPartialJson(input: string): string | null {
    // Try to find the largest valid JSON structure
    const patterns = [
      /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g, // Nested objects
      /\[(?:[^\[\]]|(?:\{[^{}]*\}))*\]/g, // Arrays with objects
      /\{[^{}]*\}/g, // Simple objects
      /\[[^\[\]]*\]/g, // Simple arrays
    ];

    let bestMatch = "";
    let bestLength = 0;

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const jsonStr = match[0];
        if (jsonStr.length > bestLength) {
          try {
            JSON.parse(jsonStr);
            bestMatch = jsonStr;
            bestLength = jsonStr.length;
          } catch {
            // Try to fix this specific match
            const fixed = this.combineFixes(jsonStr);
            if (fixed && this.isValidJson(fixed)) {
              bestMatch = fixed;
              bestLength = fixed.length;
            }
          }
        }
      }
    });

    return bestMatch || null;
  }

  /**
   * Strategy 7: Construct JSON from keywords
   */
  private static constructFromKeywords(input: string): string | null {
    const jsonParts: Record<string, any> = {};

    // Extract common patterns
    const patterns = [
      // requestId patterns
      { regex: /requestId\s+([a-zA-Z0-9-_]+)/i, key: "requestId" },
      { regex: /requestid\s+([a-zA-Z0-9-_]+)/i, key: "requestId" },

      // externalId patterns
      { regex: /externalId\s+([a-zA-Z0-9-_#]+)/i, key: "externalId" },
      { regex: /externalid\s+([a-zA-Z0-9-_#]+)/i, key: "externalId" },

      // type patterns
      { regex: /type\s+([a-zA-Z0-9-_]+)/i, key: "type" },

      // payload patterns
      {
        regex:
          /payload\s+as\s+array\s+with\s+one\s+object\s+having\s+externalId\s+([a-zA-Z0-9-_#]+)/i,
        key: "payload",
        value: (match: string) => [{ externalId: match }],
      },
    ];

    patterns.forEach((pattern) => {
      const match = input.match(pattern.regex);
      if (match) {
        const value = pattern.value ? pattern.value(match[1]) : match[1];
        jsonParts[pattern.key] = value;
      }
    });

    // Only return if we found something
    if (Object.keys(jsonParts).length > 0) {
      return JSON.stringify(jsonParts, null, 2);
    }

    return null;
  }

  /**
   * Strategy 8: Combine multiple fixes
   */
  private static combineFixes(input: string): string {
    let fixed = input;

    // Apply all fixes in sequence
    fixed = this.fixSmartQuotes(fixed);
    fixed = this.fixTrailingCommas(fixed);
    fixed = this.fixMissingQuotes(fixed);
    fixed = this.fixWhitespace(fixed);

    return fixed;
  }

  /**
   * Extract all possible JSON structures from input
   */
  static extractAllJsonStructures(input: string): string[] {
    const structures: string[] = [];

    // Try to find JSON in various contexts
    const contexts = [
      /body\s*(\{[^}]*\})/gi,
      /payload\s*(\{[^}]*\})/gi,
      /with\s*(\{[^}]*\})/gi,
      /containing\s*(\{[^}]*\})/gi,
      /that\s+has\s*(\{[^}]*\})/gi,
      /including\s*(\{[^}]*\})/gi,
    ];

    contexts.forEach((context) => {
      let match;
      while ((match = context.exec(input)) !== null) {
        const jsonStr = match[1];
        const recovered = this.recoverJson(jsonStr);
        if (recovered) {
          structures.push(recovered);
        }
      }
    });

    // Also try to find standalone JSON
    const standalone = this.recoverJson(input);
    if (standalone) {
      structures.push(standalone);
    }

    return [...new Set(structures)]; // Remove duplicates
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

  /**
   * Get the best JSON structure from input
   */
  static getBestJsonStructure(input: string): string | null {
    const structures = this.extractAllJsonStructures(input);

    if (structures.length === 0) {
      return null;
    }

    // Return the most complete structure (longest)
    return structures.reduce((best, current) =>
      current.length > best.length ? current : best
    );
  }
}
