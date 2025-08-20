/**
 * Simplified Command Parser
 *
 * Core command parsing functionality without excessive complexity
 */

import { LoadTestSpec, ValidationResult } from "../../../types";
import { AIProvider, AIProviderFactory, AIConfig } from "../ai-providers";
import { PromptBuilder } from "../prompt-builder";
import { ResponseHandler } from "../response-handler";
import { FallbackParser } from "../fallback";
import { FallbackParseResult } from "../types";
import { ParserUtils } from "../utils";
import {
  CommandParser,
  ParserConfig,
  ParseResult,
  ParserMetrics,
} from "./interfaces";

export class UnifiedCommandParser implements CommandParser {
  private aiProvider!: AIProvider;
  private fallbackParser: FallbackParser;
  private promptBuilder: PromptBuilder;
  private responseHandler: ResponseHandler;
  private config: ParserConfig;
  private isReady: boolean = false;

  constructor(config: ParserConfig = {}) {
    this.config = {
      aiProvider: "ollama",
      modelName: "llama3.2:1b",
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };

    this.fallbackParser = new FallbackParser();
    this.promptBuilder = new PromptBuilder();
    this.responseHandler = new ResponseHandler();
  }

  async initialize(): Promise<void> {
    try {
      // Load AI configuration from config file
      const fs = await import("fs");
      const path = await import("path");

      const configPath = path.join(process.cwd(), "config", "ai-config.json");
      let aiConfigFromFile: any = {};

      try {
        const configContent = fs.readFileSync(configPath, "utf8");
        aiConfigFromFile = JSON.parse(configContent);
      } catch (configError) {
        console.warn(
          `Failed to load AI config from ${configPath}:`,
          configError
        );
      }

      const aiConfig: AIConfig = {
        provider: aiConfigFromFile.provider || this.config.aiProvider!,
        model: aiConfigFromFile.model || this.config.modelName!,
        apiKey: aiConfigFromFile.apiKey || this.config.apiKey,
        endpoint:
          aiConfigFromFile.endpoint ||
          this.config.ollamaEndpoint ||
          "http://localhost:11434",
        maxRetries: aiConfigFromFile.maxRetries || this.config.maxRetries!,
        timeout: aiConfigFromFile.timeout || this.config.timeout!,
        options: aiConfigFromFile.options || {},
      };

      this.aiProvider = AIProviderFactory.create(aiConfig);
      await this.aiProvider.initialize();
      this.isReady = true;
    } catch (error) {
      console.warn(`Failed to initialize AI provider: ${error}`);
      this.isReady = false;
    }
  }

  async parseCommand(input: string): Promise<LoadTestSpec> {
    const startTime = Date.now();
    const metrics: ParserMetrics = {
      parseTime: 0,
      aiProviderUsed: this.config.aiProvider || "none",
      confidenceScore: 0,
      fallbackUsed: false,
      errorCount: 0,
      warningCount: 0,
    };

    try {
      // Try AI parsing first
      if (this.isReady) {
        try {
          const aiResult = await this.parseWithAI(input);

          // Check if this is complex JSON - if so, use fallback parser directly
          const hasComplexJson = this.hasComplexJsonInInput(input);

          if (hasComplexJson) {
            console.warn(
              `Complex JSON detected, using fallback parser for better reliability`
            );
            metrics.fallbackUsed = true;
            const fallbackResult = await this.fallbackParser.parseCommand(
              input
            );
            metrics.confidenceScore = fallbackResult.confidence;
            metrics.parseTime = Date.now() - startTime;
            return fallbackResult.spec;
          }

          // For simple JSON, use AI parser with confidence check
          if (aiResult.confidence > 0.5) {
            metrics.confidenceScore = aiResult.confidence;
            metrics.parseTime = Date.now() - startTime;

            // Directly enhance the AI result with incrementing support
            try {
              const enhancedSpec = ResponseHandler.enhanceLoadTestSpec(
                aiResult.spec,
                input
              );
              return enhancedSpec;
            } catch (enhanceError) {
              metrics.errorCount++;
              console.warn(`AI enhancement failed: ${enhanceError}`);
              // Fall back to fallback parser
              metrics.fallbackUsed = true;
              const fallbackResult = await this.fallbackParser.parseCommand(
                input
              );
              metrics.confidenceScore = fallbackResult.confidence;
              metrics.parseTime = Date.now() - startTime;
              return fallbackResult.spec;
            }
          } else {
            console.warn(
              `AI confidence too low (${aiResult.confidence}), trying fallback`
            );
          }
        } catch (error) {
          metrics.errorCount++;
          console.warn(`AI parsing failed: ${error}`);
        }
      }

      // Fallback to rule-based parsing
      metrics.fallbackUsed = true;
      const fallbackResult = await this.fallbackParser.parseCommand(input);
      metrics.confidenceScore = fallbackResult.confidence;
      metrics.parseTime = Date.now() - startTime;

      return fallbackResult.spec;
    } catch (error) {
      metrics.errorCount++;
      metrics.parseTime = Date.now() - startTime;

      // Return a basic spec as last resort
      return {
        id: `error_${Date.now()}`,
        name: "Error Recovery Test",
        description: "Created due to parsing error",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "http://localhost:3000",
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 60, unit: "seconds" },
      };
    }
  }

  private async parseWithAI(input: string): Promise<ParseResult> {
    try {
      // Build the prompt for AI parsing
      const prompt = `Parse this load testing command and return a JSON specification:

Command: "${input}"

Please extract:
1. HTTP method (GET, POST, PUT, DELETE, PATCH)
2. Target URL (extract the exact URL from the command)
3. Headers (especially x-api-key)
4. Number of requests to send (look for "send X requests" or "send X post request")
5. Request body - extract the exact JSON from the command, preserving all nested structures
6. Check if any fields should be incremented (look for "increment" keyword)

CRITICAL RULES:
- Extract the exact request count from the command (e.g., "send 3 requests" = requestCount: 3)
- ONLY include fields that are explicitly mentioned in the command
- DO NOT add any default fields or example fields that aren't in the command
- If there's existing JSON in the command, extract and use it EXACTLY as provided
- Preserve ALL nested objects, arrays, and deep structures exactly as they appear
- Do not truncate or simplify complex JSON structures
- Extract exact URL, don't use placeholder URLs
- If "increment" is mentioned, note which fields should be incremented
- Handle both simple JSON bodies and complex nested structures
- Support various natural language patterns for describing JSON
- DO NOT add any "increment" field to the JSON body - this is not a valid field
- DO NOT modify the structure of the provided JSON - use it exactly as given
- DO NOT add extra fields that weren't in the original command

EXAMPLES:
- "body {"requestId": "test"}" → {"requestId": "test"}
- "JSON body containing requestId qcomm-t1 and payload as array with one object having externalId ORD#1" → {"requestId": "qcomm-t1", "payload": [{"externalId": "ORD#1"}]}
- Complex JSON with nested objects should be preserved exactly as provided

Parse the command and return a JSON object with the extracted information. Include only the fields that are explicitly mentioned in the input command.`;

      // Get AI response
      const response = await this.aiProvider.generateCompletion({
        prompt,
        format: "json",
        temperature: 0.01, // Very low temperature for consistent parsing
        maxTokens: 4000, // Increase max tokens for complex JSON
      });

      // Parse the response
      try {
        const parsedJson = JSON.parse(response.response);

        // Validate the AI response structure
        if (!this.isValidAIResponse(parsedJson)) {
          throw new Error("AI response has invalid structure");
        }

        // Check if it's the simple format (method, url, headers, body directly)
        if (parsedJson.method && parsedJson.url) {
          // Convert simple format to LoadTestSpec
          const spec: LoadTestSpec = {
            id: `ai_${Date.now()}`,
            name: "AI Generated Test",
            description: "Generated from natural language command",
            testType: "baseline",
            requests: [
              {
                method: parsedJson.method,
                url: parsedJson.url,
                headers: parsedJson.headers || {},
                body: parsedJson.body || undefined,
              },
            ],
            loadPattern: {
              type: "constant",
              virtualUsers: parsedJson.requestCount || 1,
            },
            duration: { value: 60, unit: "seconds" },
          };

          return {
            spec,
            confidence: 0.9,
            ambiguities: [],
            suggestions: [],
          };
        } else {
          // It's already in LoadTestSpec format
          return {
            spec: parsedJson as LoadTestSpec,
            confidence: 0.9,
            ambiguities: [],
            suggestions: [],
          };
        }
      } catch (parseError) {
        throw new Error("Invalid JSON response from AI");
      }
    } catch (error) {
      throw error;
    }
  }

  private isValidAIResponse(response: any): boolean {
    // Check for required fields
    if (!response.method || !response.url) {
      return false;
    }

    // Check for invalid fields that AI might add
    if (response.increment !== undefined) {
      return false; // AI shouldn't add increment field to body
    }

    // Check if body is valid JSON structure
    if (response.body && typeof response.body === "object") {
      // Basic validation that body looks like valid JSON
      try {
        JSON.stringify(response.body);
      } catch {
        return false;
      }
    }

    return true;
  }

  private hasComplexJsonInInput(input: string): boolean {
    try {
      // Find the start of JSON in the input
      const bodyIndex = input.indexOf("body {");
      if (bodyIndex === -1) {
        return false;
      }

      // Extract everything after "body {"
      const jsonStart = bodyIndex + 6; // length of "body {"
      const jsonPart = input.substring(jsonStart);

      // Find the matching closing brace by counting braces
      let braceCount = 1;
      let jsonEnd = 0;

      for (let i = 0; i < jsonPart.length; i++) {
        if (jsonPart[i] === "{") {
          braceCount++;
        } else if (jsonPart[i] === "}") {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i;
            break;
          }
        }
      }

      if (braceCount !== 0) {
        return false;
      }

      const jsonString = jsonPart.substring(0, jsonEnd + 1);

      const jsonObj = JSON.parse(jsonString);

      // Analyze JSON complexity dynamically
      const isComplex = this.analyzeJsonComplexity(jsonObj);
      return isComplex;
    } catch (error) {
      // If JSON parsing fails, use fallback heuristics
      return this.fallbackComplexityCheck(input);
    }
  }

  private analyzeJsonComplexity(obj: any, depth: number = 0): boolean {
    // Base case: if we're too deep, it's complex
    if (depth > 3) {
      return true;
    }

    // Check if it's an object
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const keys = Object.keys(obj);

      // Check for nested objects/arrays
      const hasNestedStructures = keys.some((key) => {
        const value = obj[key];
        return value && typeof value === "object";
      });

      // If we have nested structures, check them recursively
      if (hasNestedStructures) {
        return keys.some((key) => {
          const value = obj[key];
          if (value && typeof value === "object") {
            return this.analyzeJsonComplexity(value, depth + 1);
          }
          return false;
        });
      }

      // Check for array with complex objects
      const hasComplexArrays = keys.some((key) => {
        const value = obj[key];
        if (Array.isArray(value) && value.length > 0) {
          return value.some(
            (item) =>
              item &&
              typeof item === "object" &&
              this.analyzeJsonComplexity(item, depth + 1)
          );
        }
        return false;
      });

      return hasComplexArrays;
    }

    // Check if it's an array
    if (Array.isArray(obj)) {
      return obj.some(
        (item) =>
          item &&
          typeof item === "object" &&
          this.analyzeJsonComplexity(item, depth + 1)
      );
    }

    return false;
  }

  private fallbackComplexityCheck(input: string): boolean {
    // Fallback heuristics when JSON parsing fails
    const braceCount = (input.match(/\{/g) || []).length;
    const bracketCount = (input.match(/\[/g) || []).length;

    // Check for deep nesting patterns
    const hasDeepNesting = input.includes('":{"') && input.includes('":{');

    // Check for multiple levels of nesting
    const totalNesting = braceCount + bracketCount;
    const hasMultipleLevels = totalNesting > 6; // Simple JSON usually has 2-4 levels

    // Check for array of objects pattern
    const hasArrayOfObjects = input.includes('":[{"') || input.includes('":[{');

    return hasDeepNesting || hasMultipleLevels || hasArrayOfObjects;
  }

  validateSpec(spec: LoadTestSpec): ValidationResult {
    // Simple validation - can be enhanced later
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  suggestCorrections(input: string, errors: string[]): string[] {
    return [
      "Try rephrasing your command",
      "Check URL format",
      "Verify JSON syntax",
      "Add missing required fields",
    ];
  }

  getMetrics(): ParserMetrics {
    return {
      parseTime: 0,
      aiProviderUsed: this.config.aiProvider || "none",
      confidenceScore: 0,
      fallbackUsed: false,
      errorCount: 0,
      warningCount: 0,
    };
  }
}
