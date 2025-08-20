import { LoadTestSpec } from "../../types/load-test-spec";
import { PatternLearner } from "./pattern-learner";

export interface ClarificationQuestion {
  id: string;
  type:
    | "missing_url"
    | "missing_method"
    | "ambiguous_json"
    | "missing_headers"
    | "variable_confusion"
    | "count_confusion";
  question: string;
  suggestions: string[];
  context: string;
  priority: number;
}

export interface ClarificationResponse {
  questionId: string;
  answer: string;
  confidence: number;
}

export class ClarificationEngine {
  private static instance: ClarificationEngine;
  private patternLearner: PatternLearner;

  private constructor() {
    this.patternLearner = PatternLearner.getInstance();
  }

  static getInstance(): ClarificationEngine {
    if (!ClarificationEngine.instance) {
      ClarificationEngine.instance = new ClarificationEngine();
    }
    return ClarificationEngine.instance;
  }

  /**
   * Analyze input and generate clarification questions
   */
  generateQuestions(
    input: string,
    partialSpec: LoadTestSpec,
    userId?: string
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];
    const lowerInput = input.toLowerCase();

    // Check for missing URL
    if (!partialSpec.requests[0]?.url) {
      questions.push({
        id: "missing_url",
        type: "missing_url",
        question: "What URL should I send requests to?",
        suggestions: this.extractPotentialUrls(input),
        context: "No URL found in your request",
        priority: 10,
      });
    }

    // Check for missing HTTP method
    if (!partialSpec.requests[0]?.method) {
      questions.push({
        id: "missing_method",
        type: "missing_method",
        question: "What HTTP method should I use?",
        suggestions: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        context: "No HTTP method specified",
        priority: 8,
      });
    }

    // Check for ambiguous JSON
    if (this.hasAmbiguousJson(input)) {
      questions.push({
        id: "ambiguous_json",
        type: "ambiguous_json",
        question: "I found some JSON but it might be incomplete. Should I:",
        suggestions: [
          "Use the JSON as-is",
          "Try to fix and complete it",
          "Ask you to provide complete JSON",
        ],
        context: "JSON appears to be incomplete or malformed",
        priority: 7,
      });
    }

    // Check for missing headers
    if (this.mentionsHeadersButNoneFound(input)) {
      questions.push({
        id: "missing_headers",
        type: "missing_headers",
        question:
          "You mentioned headers but I couldn't extract them. What headers do you need?",
        suggestions: [
          "Content-Type: application/json",
          "Authorization: Bearer token",
          "x-api-key: your-key",
        ],
        context: "Headers mentioned but not found",
        priority: 6,
      });
    }

    // Check for variable confusion
    if (this.hasVariableConfusion(input)) {
      questions.push({
        id: "variable_confusion",
        type: "variable_confusion",
        question:
          "I found some variables that might need incrementing. Which ones should I increment?",
        suggestions: this.extractPotentialVariables(input),
        context: "Multiple variables found, unclear which to increment",
        priority: 5,
      });
    }

    // Check for count confusion
    if (this.hasCountConfusion(input)) {
      questions.push({
        id: "count_confusion",
        type: "count_confusion",
        question: "How many requests should I send?",
        suggestions: ["1", "5", "10", "100", "1000"],
        context: "Request count unclear",
        priority: 9,
      });
    }

    // Add suggestions from pattern learner
    const suggestions = this.patternLearner.getSuggestions(input, userId);
    if (suggestions.length > 0) {
      questions.push({
        id: "pattern_suggestions",
        type: "missing_url", // Generic type
        question:
          "Based on similar successful patterns, you might want to try:",
        suggestions,
        context: "Pattern-based suggestions",
        priority: 3,
      });
    }

    return questions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Process user response to clarification question
   */
  processResponse(
    question: ClarificationQuestion,
    response: string,
    currentSpec: LoadTestSpec
  ): LoadTestSpec {
    const updatedSpec = { ...currentSpec };

    switch (question.type) {
      case "missing_url":
        updatedSpec.requests[0] = {
          ...updatedSpec.requests[0],
          url: response.trim(),
        };
        break;

      case "missing_method":
        const method = response.toUpperCase().trim() as any;
        updatedSpec.requests[0] = {
          ...updatedSpec.requests[0],
          method,
        };
        break;

      case "ambiguous_json":
        if (response.includes("fix")) {
          // Try to fix the JSON
          const fixedJson = this.attemptJsonFix(
            currentSpec.requests[0]?.body || "{}"
          );
          updatedSpec.requests[0] = {
            ...updatedSpec.requests[0],
            body: fixedJson,
          };
        }
        break;

      case "missing_headers":
        const headers = this.parseHeadersFromResponse(response);
        updatedSpec.requests[0] = {
          ...updatedSpec.requests[0],
          headers: { ...updatedSpec.requests[0]?.headers, ...headers },
        };
        break;

      case "variable_confusion":
        const variables = response
          .split(/[,;\s]+/)
          .map((v) => v.trim())
          .filter(Boolean);
        // This would need to be integrated with the variable incrementing system
        break;

      case "count_confusion":
        const count = parseInt(response);
        if (!isNaN(count)) {
          updatedSpec.loadPattern = {
            ...updatedSpec.loadPattern,
            virtualUsers: count,
          };
        }
        break;
    }

    return updatedSpec;
  }

  /**
   * Check if input needs clarification
   */
  needsClarification(input: string, spec: LoadTestSpec): boolean {
    return (
      !spec.requests[0]?.url ||
      !spec.requests[0]?.method ||
      this.hasAmbiguousJson(input) ||
      this.mentionsHeadersButNoneFound(input) ||
      this.hasVariableConfusion(input) ||
      this.hasCountConfusion(input)
    );
  }

  /**
   * Get contextual suggestions based on partial input
   */
  getContextualSuggestions(input: string, userId?: string): string[] {
    const suggestions: string[] = [];
    const lowerInput = input.toLowerCase();

    // URL suggestions
    if (!lowerInput.includes("http") && !lowerInput.includes("://")) {
      suggestions.push('Add a URL like: "http://api.example.com/endpoint"');
    }

    // Method suggestions
    if (
      !lowerInput.includes("get") &&
      !lowerInput.includes("post") &&
      !lowerInput.includes("put") &&
      !lowerInput.includes("delete")
    ) {
      suggestions.push(
        'Specify HTTP method: "POST requests" or "GET requests"'
      );
    }

    // Count suggestions
    if (!/\d+\s+requests?/.test(lowerInput)) {
      suggestions.push('Specify count: "5 requests" or "10 requests"');
    }

    // Header suggestions
    if (lowerInput.includes("header") || lowerInput.includes("api-key")) {
      suggestions.push('Format headers: "with header x-api-key: your-key"');
    }

    // Variable suggestions
    if (lowerInput.includes("increment")) {
      suggestions.push(
        'Format variables: "increment order_id and increment_id"'
      );
    }

    return suggestions;
  }

  private extractPotentialUrls(input: string): string[] {
    const urls: string[] = [];

    // Look for domain-like patterns
    const domainPattern = /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
    let match;
    while ((match = domainPattern.exec(input)) !== null) {
      urls.push(`http://${match[1]}`);
    }

    // Look for paths
    const pathPattern = /(\/[^\s]+)/g;
    while ((match = pathPattern.exec(input)) !== null) {
      urls.push(`http://localhost${match[1]}`);
    }

    return urls.slice(0, 3);
  }

  private extractPotentialVariables(input: string): string[] {
    const variables: string[] = [];
    const idPattern = /(\w+_?id|requestId|externalId|orderId)/gi;
    let match;
    while ((match = idPattern.exec(input)) !== null) {
      variables.push(match[1]);
    }
    return variables.slice(0, 5);
  }

  private hasAmbiguousJson(input: string): boolean {
    const jsonPattern = /\{[^}]*$/;
    return (
      jsonPattern.test(input) || (input.includes("{") && !input.includes("}"))
    );
  }

  private mentionsHeadersButNoneFound(input: string): boolean {
    const headerKeywords = [
      "header",
      "api-key",
      "authorization",
      "content-type",
    ];
    return headerKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword)
    );
  }

  private hasVariableConfusion(input: string): boolean {
    const idPattern = /(\w+_?id|requestId|externalId|orderId)/gi;
    const matches = input.match(idPattern);
    return Boolean(matches && matches.length > 2);
  }

  private hasCountConfusion(input: string): boolean {
    const countPattern = /\d+/g;
    const matches = input.match(countPattern);
    return !matches || matches.length > 3;
  }

  private attemptJsonFix(jsonString: string): string {
    // Simple JSON fixing
    let fixed = jsonString;

    // Add missing closing brace
    if (fixed.includes("{") && !fixed.includes("}")) {
      fixed += "}";
    }

    // Fix common issues
    fixed = fixed.replace(/,\s*}/g, "}"); // Remove trailing commas
    fixed = fixed.replace(/,\s*]/g, "]"); // Remove trailing commas in arrays

    return fixed;
  }

  private parseHeadersFromResponse(response: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // Parse "key: value" format
    const headerPattern = /([a-zA-Z-]+):\s*([^\s,;]+)/g;
    let match;
    while ((match = headerPattern.exec(response)) !== null) {
      headers[match[1]] = match[2];
    }

    return headers;
  }
}
