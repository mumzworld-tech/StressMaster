/**
 * Unified prompt building system that combines smart prompt construction with template management
 * Merges functionality from smart-prompt-builder.ts and prompt-templates.ts
 */

import { LoadTestSpec } from "../../types";

export interface PromptExample {
  input: string;
  output: LoadTestSpec;
  description: string;
  relevanceScore?: number;
}

export interface EnhancedPrompt {
  systemPrompt: string;
  contextualExamples: PromptExample[];
  clarifications: string[];
  parsingInstructions: string[];
  fallbackInstructions: string[];
}

export interface ParseContext {
  originalInput: string;
  confidence: number;
  ambiguities: any[];
  extractedComponents: {
    methods: string[];
    urls: string[];
    counts: number[];
    bodies: string[];
  };
  inferredFields: {
    testType?: string;
    loadPattern?: string;
  };
}

export interface InputFormat {
  natural_language: string;
  mixed_structured: string;
  curl_command: string;
  http_raw: string;
  json_with_text: string;
  concatenated_requests: string;
}

export class PromptBuilder {
  private static readonly SYSTEM_PROMPT = `You are StressMaster's AI assistant that converts natural language descriptions into structured load test specifications. 

CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no extra text.

Your task is to parse user commands and extract:
- HTTP method (GET, POST, PUT, DELETE, etc.)
- Target URL
- Request payload template and variables
- Load pattern (constant, ramp-up, spike, step)
- Test duration and virtual users or RPS
- Test type (spike, stress, endurance, volume, baseline)

CRITICAL RULES FOR JSON HANDLING:
1. When the command contains a complete JSON object (like {"requestId": "seller-req1", "payload": [...]}), use that EXACT JSON as the request body
2. Do NOT create template variables from literal values in the JSON
3. Do NOT extract individual fields from complete JSON objects
4. Use the exact URL specified in the command
5. Use the exact HTTP method specified in the command
6. If the command says "increment order_id and increment_id", create template variables ONLY for those specific fields
7. Preserve the complete JSON structure as-is
8. Respond with ONLY the JSON object, no other text

Key guidelines:
1. Generate unique IDs using timestamp-based approach
2. Infer test type from the language used (e.g., "spike test" = spike, "gradually increase" = stress)
3. Default to POST for requests with payloads, GET otherwise
4. Use reasonable defaults for missing parameters
5. Extract variable definitions from payload descriptions
6. Set appropriate load patterns based on the test description

EXAMPLE: If command is "send 2 POST requests to http://backbone.mumz.io/magento/qcomm-order with body {"requestId": "seller-req1", "payload": [{"order_id": "5783136"}]} increment order_id"
- Use URL: http://backbone.mumz.io/magento/qcomm-order
- Use method: POST
- Use body: {"requestId": "seller-req1", "payload": [{"order_id": "{{order_id}}"}]}
- Create variable: order_id with type "incremental"

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "id": "test_1234567890",
  "name": "Load Test",
  "description": "Parsed from user command",
  "testType": "baseline",
  "requests": [
    {
      "method": "POST",
      "url": "http://backbone.mumz.io/magento/qcomm-order",
      "payload": {
        "template": "{\\"requestId\\": \\"seller-req1\\", \\"payload\\": [{\\"order_id\\": \\"{{order_id}}\\"}]}",
        "variables": [
          {
            "name": "order_id",
            "type": "incremental",
            "startValue": "5783136"
          }
        ]
      }
    }
  ],
  "loadPattern": {
    "type": "constant",
    "virtualUsers": 2
  },
  "duration": {
    "value": 30,
    "unit": "seconds"
  }
}`;

  private static readonly USER_PROMPT_TEMPLATE = `Parse this StressMaster command and convert it to a LoadTestSpec JSON:

Command: "{input}"

Respond with only valid JSON, no additional text or explanation.`;

  private static readonly EXAMPLES: PromptExample[] = [
    {
      input:
        'send 2 POST requests to http://backbone.mumz.io/magento/qcomm-order with header x-api-key 2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9 and body {"requestId": "seller-req1", "payload": [{"externalId": "Seller#1", "order_id": "5783136", "increment_id": "1202500044"}]} increment order_id and increment_id',
      output: {
        id: "test_" + Date.now(),
        name: "Magento Order Test",
        description:
          'send 2 POST requests to http://backbone.mumz.io/magento/qcomm-order with header x-api-key 2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9 and body {"requestId": "seller-req1", "payload": [{"externalId": "Seller#1", "order_id": "5783136", "increment_id": "1202500044"}]} increment order_id and increment_id',
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "http://backbone.mumz.io/magento/qcomm-order",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9",
            },
            payload: {
              template:
                '{"requestId": "seller-req1", "payload": [{"externalId": "Seller#1", "order_id": "{{order_id}}", "increment_id": "{{increment_id}}"}]}',
              variables: [
                {
                  name: "order_id",
                  type: "incremental",
                  parameters: {
                    baseValue: "5783136",
                  },
                },
                {
                  name: "increment_id",
                  type: "incremental",
                  parameters: {
                    baseValue: "1202500044",
                  },
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 2,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      },
      description: "Complex JSON payload with variable incrementing",
    },
    {
      input:
        "Send 100 POST requests to https://api.example.com/orders with random orderIds",
      output: {
        id: "test_" + Date.now(),
        name: "POST Orders Test",
        description:
          "Send 100 POST requests to https://api.example.com/orders with random orderIds",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/orders",
            headers: {
              "Content-Type": "application/json",
            },
            payload: {
              template: '{"orderId": "{{orderId}}"}',
              variables: [
                {
                  name: "orderId",
                  type: "random_id",
                  parameters: {},
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 100,
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      },
      description: "Simple POST request with concurrent users",
    },
    {
      input: "Spike test with 1000 requests in 10 seconds to GET /api/users",
      output: {
        id: "test_" + Date.now(),
        name: "Spike Test Users API",
        description:
          "Spike test with 1000 requests in 10 seconds to GET /api/users",
        testType: "spike",
        requests: [
          {
            method: "GET",
            url: "/api/users",
          },
        ],
        loadPattern: {
          type: "spike",
          virtualUsers: 1000,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
      },
      description: "Spike test with high load in short duration",
    },
    {
      input:
        "Stress test gradually increasing from 10 to 100 users over 5 minutes for POST /api/login",
      output: {
        id: "test_" + Date.now(),
        name: "Stress Test Login API",
        description:
          "Stress test gradually increasing from 10 to 100 users over 5 minutes for POST /api/login",
        testType: "stress",
        requests: [
          {
            method: "POST",
            url: "/api/login",
            headers: {
              "Content-Type": "application/json",
            },
            payload: {
              template:
                '{"username": "{{username}}", "password": "{{password}}"}',
              variables: [
                {
                  name: "username",
                  type: "random_string",
                  parameters: { length: 8 },
                },
                {
                  name: "password",
                  type: "random_string",
                  parameters: { length: 12 },
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "ramp-up",
          virtualUsers: 100,
          rampUpTime: {
            value: 5,
            unit: "minutes",
          },
        },
        duration: {
          value: 10,
          unit: "minutes",
        },
      },
      description: "Gradual ramp-up stress test",
    },
    {
      input:
        'send 3 POST requests to https://api.example.com/orders with header x-api-key abc123 {"requestId": "order-123", "payload": [{"externalId": "ORD#1"}]}',
      output: {
        id: "test_" + Date.now(),
        name: "Load Test API",
        description:
          "Send 3 POST requests to API endpoint with specific JSON payload",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/orders",
            headers: {
              "x-api-key": "abc123",
              "Content-Type": "application/json",
            },
            body: {
              requestId: "order-123",
              payload: [{ externalId: "ORD#1" }],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 3,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      },
      description: "Curl command with JSON payload",
    },
  ];

  private static readonly CONTEXTUAL_INSTRUCTIONS = {
    natural_language:
      "Focus on extracting intent from natural language descriptions. Infer technical details from context clues.",
    mixed_structured:
      "Parse both structured data and natural language. Prioritize explicit structured data over inferred values.",
    curl_command:
      "Extract all parameters from the curl command. Pay attention to headers, method, and data flags.",
    http_raw:
      "Parse the raw HTTP request format. Extract method, path, headers, and body from the HTTP structure.",
    json_with_text:
      "Extract JSON blocks as request bodies. Use surrounding text for context and configuration.",
    concatenated_requests:
      "Identify and separate multiple requests. Create appropriate test scenarios for each.",
  };

  static buildPrompt(context: ParseContext): EnhancedPrompt {
    const formatInstructions = this.getFormatInstructions(context);
    const systemPrompt = this.buildSystemPrompt(context, formatInstructions);
    const contextualExamples = this.selectRelevantExamples(context);
    const clarifications = this.addClarifications(context);
    const parsingInstructions = this.createParsingInstructions(context);
    const fallbackInstructions = this.createFallbackInstructions(context);

    return {
      systemPrompt,
      contextualExamples,
      clarifications,
      parsingInstructions,
      fallbackInstructions,
    };
  }

  static getSystemPrompt(): string {
    return this.SYSTEM_PROMPT;
  }

  static getUserPrompt(input: string): string {
    return this.USER_PROMPT_TEMPLATE.replace("{input}", input);
  }

  static getExamples(): PromptExample[] {
    return this.EXAMPLES;
  }

  static buildFullPrompt(input: string): string {
    const examples = this.EXAMPLES.map(
      (example) =>
        `Input: "${example.input}"\nOutput: ${JSON.stringify(
          example.output,
          null,
          2
        )}`
    ).join("\n\n");

    return `${this.SYSTEM_PROMPT}

Here are some examples:

${examples}

Now parse this command:
${this.getUserPrompt(input)}`;
  }

  private static selectRelevantExamples(
    context: ParseContext
  ): PromptExample[] {
    const selectedExamples: PromptExample[] = [];

    // Score examples based on relevance
    const scoredExamples = this.EXAMPLES.map((example) => ({
      ...example,
      relevanceScore: this.calculateRelevanceScore(example, context),
    }));

    // Sort by relevance and select top examples
    scoredExamples
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 3)
      .forEach((example) => selectedExamples.push(example));

    return selectedExamples;
  }

  private static calculateRelevanceScore(
    example: PromptExample,
    context: ParseContext
  ): number {
    let score = 0;

    // Method matching
    if (
      example.output.requests[0]?.method &&
      context.extractedComponents.methods.includes(
        example.output.requests[0].method
      )
    ) {
      score += 0.3;
    }

    // Test type matching
    if (example.output.testType === context.inferredFields.testType) {
      score += 0.3;
    }

    // Load pattern matching
    if (
      example.output.loadPattern.type === context.inferredFields.loadPattern
    ) {
      score += 0.2;
    }

    // URL pattern matching
    const exampleUrl = example.output.requests[0]?.url || "";
    const hasMatchingUrlPattern = context.extractedComponents.urls.some(
      (url) =>
        url.includes(exampleUrl.split("/").pop() || "") ||
        exampleUrl.includes(url.split("/").pop() || "")
    );
    if (hasMatchingUrlPattern) {
      score += 0.2;
    }

    return score;
  }

  private static addClarifications(context: ParseContext): string[] {
    const clarifications: string[] = [];

    // Add clarifications for each ambiguity
    context.ambiguities.forEach((ambiguity) => {
      const clarification = this.generateClarificationForAmbiguity(ambiguity);
      if (clarification) {
        clarifications.push(clarification);
      }
    });

    // Add format-specific clarifications
    const formatClarifications = this.getFormatSpecificClarifications(context);
    clarifications.push(...formatClarifications);

    // Add confidence-based clarifications
    if (context.confidence < 0.6) {
      clarifications.push(
        "Input appears ambiguous or incomplete. Make reasonable assumptions and document them clearly."
      );
    }

    return clarifications;
  }

  private static generateClarificationForAmbiguity(
    ambiguity: any
  ): string | null {
    switch (ambiguity.field) {
      case "method":
        return `HTTP method not specified. Will default to ${ambiguity.possibleValues[0]} based on context.`;
      case "url":
        return `URL incomplete or missing. ${ambiguity.reason}`;
      case "userCount":
        return `User count not specified. Will use default of ${ambiguity.possibleValues[0]} concurrent users.`;
      case "duration":
        return `Test duration not specified. Will use default of ${ambiguity.possibleValues[0]}.`;
      case "content-type":
        return `Content-Type header missing for request with body. Will default to ${ambiguity.possibleValues[0]}.`;
      default:
        return `${ambiguity.field}: ${ambiguity.reason}`;
    }
  }

  private static getFormatInstructions(context: ParseContext): string {
    const format = this.inferInputFormat(context);
    return (
      this.CONTEXTUAL_INSTRUCTIONS[format] ||
      this.CONTEXTUAL_INSTRUCTIONS.natural_language
    );
  }

  private static inferInputFormat(
    context: ParseContext
  ): keyof typeof PromptBuilder.CONTEXTUAL_INSTRUCTIONS {
    const input = context.originalInput.toLowerCase();

    if (input.includes("curl")) return "curl_command";
    if (input.match(/^(get|post|put|delete)\s+\/\S*\s+http\/\d\.\d/m))
      return "http_raw";
    if (context.extractedComponents.bodies.length > 0 && input.length > 100)
      return "json_with_text";
    if (
      context.extractedComponents.urls.length > 1 ||
      context.extractedComponents.methods.length > 1
    )
      return "concatenated_requests";
    if (
      context.extractedComponents.urls.length > 0 ||
      context.extractedComponents.methods.length > 0
    )
      return "mixed_structured";

    return "natural_language";
  }

  private static buildSystemPrompt(
    context: ParseContext,
    formatInstructions: string
  ): string {
    let systemPrompt = this.SYSTEM_PROMPT;

    // Add format-specific instructions
    systemPrompt += `\n\nFormat-specific instructions: ${formatInstructions}`;

    // Add confidence-based instructions
    if (context.confidence < 0.5) {
      systemPrompt +=
        "\n\nNote: Input appears to have low confidence. Make conservative assumptions and clearly document them.";
    }

    // Add ambiguity handling instructions
    if (context.ambiguities.length > 0) {
      systemPrompt +=
        "\n\nAmbiguity handling: When multiple values are possible, choose the most common or reasonable default. Document all assumptions made during parsing.";
    }

    return systemPrompt;
  }

  private static getFormatSpecificClarifications(
    context: ParseContext
  ): string[] {
    const clarifications: string[] = [];
    const format = this.inferInputFormat(context);

    switch (format) {
      case "curl_command":
        clarifications.push(
          "Parsing curl command - extracting all flags and parameters."
        );
        break;
      case "http_raw":
        clarifications.push(
          "Parsing raw HTTP request format - extracting method, headers, and body."
        );
        break;
      case "concatenated_requests":
        clarifications.push(
          "Multiple requests detected - will create separate test scenarios."
        );
        break;
      case "json_with_text":
        clarifications.push(
          "JSON data found with descriptive text - using JSON as request body."
        );
        break;
      case "mixed_structured":
        clarifications.push(
          "Mixed structured and natural language input - prioritizing structured data."
        );
        break;
    }

    return clarifications;
  }

  private static createParsingInstructions(context: ParseContext): string[] {
    const instructions: string[] = [];

    // Add instructions based on extracted components
    if (context.extractedComponents.methods.length > 0) {
      instructions.push(
        `Use HTTP method: ${context.extractedComponents.methods[0]}`
      );
    }

    if (context.extractedComponents.urls.length > 0) {
      instructions.push(`Target URL: ${context.extractedComponents.urls[0]}`);
    }

    if (context.extractedComponents.counts.length > 0) {
      instructions.push(`User count: ${context.extractedComponents.counts[0]}`);
    }

    // Add instructions based on inferred fields
    if (context.inferredFields.testType) {
      instructions.push(`Test type: ${context.inferredFields.testType}`);
    }

    if (context.inferredFields.loadPattern) {
      instructions.push(`Load pattern: ${context.inferredFields.loadPattern}`);
    }

    return instructions;
  }

  private static createFallbackInstructions(context: ParseContext): string[] {
    const instructions = [
      "If parsing fails, extract whatever components are clearly identifiable",
      "Use reasonable defaults for missing required fields",
      "Maintain valid JSON structure even with incomplete data",
      "Provide helpful error messages in the response",
    ];

    // Add context-specific fallback instructions
    if (context.confidence < 0.3) {
      instructions.push(
        "Very low confidence input - use minimal viable test configuration"
      );
    }

    if (context.ambiguities.length > 3) {
      instructions.push(
        "High ambiguity input - prioritize most critical components (method, URL)"
      );
    }

    return instructions;
  }

  // Utility methods from prompt-templates.ts
  static extractVariablesFromPayload(
    payloadDescription: string
  ): Array<{ name: string; type: string; parameters?: any }> {
    const variables: Array<{ name: string; type: string; parameters?: any }> =
      [];

    // Common patterns for variable extraction
    const patterns = [
      { regex: /random\s+(\w+)/gi, type: "random_string" },
      { regex: /(\w+)Id/gi, type: "random_id" },
      { regex: /uuid/gi, type: "uuid" },
      { regex: /timestamp/gi, type: "timestamp" },
      { regex: /sequence/gi, type: "sequence" },
    ];

    patterns.forEach((pattern) => {
      const matches = payloadDescription.matchAll(pattern.regex);
      for (const match of matches) {
        const name = match[1] || match[0];
        if (!variables.some((v) => v.name === name)) {
          variables.push({
            name: name.toLowerCase(),
            type: pattern.type as any,
            parameters: pattern.type === "random_string" ? { length: 10 } : {},
          });
        }
      }
    });

    return variables;
  }

  static inferTestType(input: string): string {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes("spike")) return "spike";
    if (
      lowerInput.includes("stress") ||
      lowerInput.includes("gradually") ||
      lowerInput.includes("ramp")
    )
      return "stress";
    if (
      lowerInput.includes("endurance") ||
      lowerInput.includes("sustained") ||
      lowerInput.includes("long")
    )
      return "endurance";
    if (
      lowerInput.includes("volume") ||
      lowerInput.includes("high volume") ||
      lowerInput.includes("many users")
    )
      return "volume";
    if (lowerInput.includes("baseline") || lowerInput.includes("benchmark"))
      return "baseline";

    return "baseline"; // default
  }

  static inferHttpMethod(input: string): string {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes("post") ||
      lowerInput.includes("create") ||
      lowerInput.includes("submit")
    )
      return "POST";
    if (lowerInput.includes("put") || lowerInput.includes("update"))
      return "PUT";
    if (lowerInput.includes("delete") || lowerInput.includes("remove"))
      return "DELETE";
    if (lowerInput.includes("patch") || lowerInput.includes("modify"))
      return "PATCH";
    if (
      lowerInput.includes("get") ||
      lowerInput.includes("fetch") ||
      lowerInput.includes("retrieve")
    )
      return "GET";

    // If payload is mentioned, likely POST
    if (
      lowerInput.includes("payload") ||
      lowerInput.includes("data") ||
      lowerInput.includes("body")
    )
      return "POST";

    return "GET"; // default
  }

  static extractDuration(input: string): {
    value: number;
    unit: "seconds" | "minutes" | "hours";
  } {
    const patterns = [
      { regex: /(\d+)\s*seconds?/i, unit: "seconds" as const },
      { regex: /(\d+)\s*minutes?/i, unit: "minutes" as const },
      { regex: /(\d+)\s*hours?/i, unit: "hours" as const },
      { regex: /(\d+)\s*secs?/i, unit: "seconds" as const },
      { regex: /(\d+)\s*mins?/i, unit: "minutes" as const },
      { regex: /(\d+)\s*hrs?/i, unit: "hours" as const },
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern.regex);
      if (match) {
        return {
          value: parseInt(match[1]),
          unit: pattern.unit,
        };
      }
    }

    // Default duration
    return { value: 1, unit: "minutes" };
  }

  static extractRequestCount(input: string): number {
    const patterns = [
      /send\s+(\d+)\s+(?:POST|GET|PUT|DELETE|PATCH)\s+requests?/i,
      /(\d+)\s*requests?/i,
      /(\d+)\s*calls?/i,
      /(\d+)\s*times?/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return 1; // default to 1 instead of 100
  }

  static extractRPS(input: string): number | undefined {
    const patterns = [
      /(\d+)\s*rps/i,
      /(\d+)\s*requests?\s*per\s*second/i,
      /(\d+)\s*req\/s/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return undefined;
  }
}

// ============================================================================
// SMART PROMPT BUILDER (Legacy compatibility)
// ============================================================================

export interface SmartPromptBuilder {
  buildPrompt(context: ParseContext): Promise<EnhancedPrompt>;
}

export class DefaultSmartPromptBuilder implements SmartPromptBuilder {
  async buildPrompt(context: ParseContext): Promise<EnhancedPrompt> {
    return PromptBuilder.buildPrompt(context);
  }
}

// ============================================================================
// PROMPT TEMPLATE MANAGER (Legacy compatibility)
// ============================================================================

export class PromptTemplateManager {
  static getSystemPrompt(): string {
    return PromptBuilder.getSystemPrompt();
  }

  static buildPrompt(input: string): string {
    return PromptBuilder.buildFullPrompt(input);
  }
}
