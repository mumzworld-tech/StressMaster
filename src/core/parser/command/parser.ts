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
import { selectPromptTemplate } from "../prompts/command-parser-prompt";
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
        model:
          aiConfigFromFile.ollama?.model ||
          aiConfigFromFile.model ||
          this.config.modelName!,
        apiKey: aiConfigFromFile.apiKey || this.config.apiKey,
        endpoint:
          aiConfigFromFile.ollama?.endpoint ||
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
          console.log("🤖 Attempting AI parsing...");
          const aiResult = await this.parseWithAI(input);

          // Validate AI result quality
          const isAIResultValid = this.validateAIResult(aiResult.spec, input);
          console.log(
            "🔍 AI Result validation:",
            isAIResultValid,
            "Confidence:",
            aiResult.confidence
          );

          // Use AI result if confidence is good enough AND result is valid
          if (aiResult.confidence > 0.1 && isAIResultValid) {
            console.log("✅ AI parsing successful!");
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
              `AI result invalid or confidence too low (${aiResult.confidence}), trying fallback`
            );
          }
        } catch (error) {
          metrics.errorCount++;
          console.warn(`AI parsing failed: ${error}`);
        }
      }

      // Fallback to rule-based parsing
      console.log("🔄 Falling back to non-AI parser...");
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
      // Build the prompt for AI parsing using intelligent template selection
      const prompt = selectPromptTemplate(input);

      // If no prompt is returned, it means we should use fallback for complex commands
      if (!prompt) {
        console.log("🔄 Complex command detected - using fallback parser");
        throw new Error("Use fallback parser");
      }

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

        console.log("🔍 Raw AI Response:", response.response);
        console.log(
          "🔍 Parsed AI Response:",
          JSON.stringify(parsedJson, null, 2)
        );

        // Validate the AI response structure
        if (!this.isValidAIResponse(parsedJson)) {
          throw new Error("AI response has invalid structure");
        }

        // Convert the new format to LoadTestSpec
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
              body: this.cleanAIBody(parsedJson.body) || undefined,
            },
          ],
          loadPattern: {
            type: parsedJson.loadPattern?.type || "constant",
            virtualUsers:
              parsedJson.requestCount ||
              parsedJson.loadPattern?.virtualUsers ||
              1,
          },
          duration: parsedJson.duration || { value: 60, unit: "seconds" },
        };

        // Add incrementing support if mentioned in the command
        if (input.toLowerCase().includes("increment")) {
          const incrementFields = this.extractIncrementFields(input);
          if (incrementFields.length > 0) {
            console.log(
              "🔧 AI Parser: Creating payload template for incrementing fields:",
              incrementFields
            );

            // Create a clean template without the extra increment fields
            const cleanBody = { ...spec.requests[0].body };

            // Remove any extra increment fields that might have been added
            delete cleanBody.incrementRequestId;
            delete cleanBody.incrementExternalId;
            delete cleanBody.increment;

            // Create template with variable placeholders
            const templateBody = { ...cleanBody };
            incrementFields.forEach((field) => {
              this.replaceFieldWithVariable(
                templateBody,
                field,
                `{{${field}}}`
              );
            });

            spec.requests[0].payload = {
              template: JSON.stringify(templateBody),
              variables: incrementFields.map((field) => ({
                name: field,
                type: "incremental",
                parameters: {
                  baseValue: this.findFieldValue(cleanBody, field) || "1",
                },
              })),
            };
            delete spec.requests[0].body;

            console.log(
              "🔧 AI Parser: Created payload template:",
              spec.requests[0].payload
            );
          }
        }

        return {
          spec,
          confidence: 0.9,
          ambiguities: [],
          suggestions: [],
        };
      } catch (parseError) {
        throw new Error("Invalid JSON response from AI");
      }
    } catch (error) {
      throw error;
    }
  }

  private isValidAIResponse(response: any): boolean {
    // Check if it has the required fields for the new format
    if (response.method && response.url) {
      // Check for valid HTTP method
      const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      if (!validMethods.includes(response.method.toUpperCase())) {
        return false;
      }

      // Check for valid URL format
      try {
        new URL(response.url);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private extractIncrementFields(input: string): string[] {
    const incrementMatch = input.match(/increment\s+([^.]+)/i);
    if (!incrementMatch) return [];

    const fields = incrementMatch[1].split(/\s+and\s+|\s*,\s*/);
    return fields
      .map((field) => field.trim())
      .filter((field) => field.length > 0);
  }

  private findFieldValue(obj: any, fieldName: string): string | null {
    if (!obj || typeof obj !== "object") return null;

    // Direct property
    if (obj[fieldName]) return String(obj[fieldName]);

    // Nested search
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        const result = this.findFieldValue(obj[key], fieldName);
        if (result) return result;
      }
    }

    return null;
  }

  private replaceFieldWithVariable(
    obj: any,
    fieldName: string,
    variableName: string
  ): void {
    if (!obj || typeof obj !== "object") return;

    // Direct property
    if (obj[fieldName]) {
      obj[fieldName] = variableName;
      return;
    }

    // Nested search
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        this.replaceFieldWithVariable(obj[key], fieldName, variableName);
      }
    }
  }

  private cleanAIBody(body: any): any {
    // If body is null or undefined, return as is
    if (body === null || body === undefined) {
      return body;
    }

    // If body is already a proper object, return as is
    if (typeof body === "object" && !Array.isArray(body)) {
      return body;
    }

    // If body is a string that looks like character-by-character encoding, try to fix it
    if (typeof body === "string") {
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(body);
        return parsed;
      } catch {
        // If it's character-by-character encoded, try to reconstruct
        if (body.includes('"0":"') && body.includes('"1":"')) {
          console.log(
            "🔧 Detected character-by-character encoding, attempting to fix..."
          );
          try {
            // This is a simplified fix - in practice, we might need more sophisticated reconstruction
            // For now, let's try to extract the original JSON from the input
            return null; // Return null to trigger fallback
          } catch {
            return null;
          }
        }
        return null;
      }
    }

    return body;
  }

  private validateAIResult(spec: LoadTestSpec, input: string): boolean {
    console.log("🔍 Validating AI result:", JSON.stringify(spec, null, 2));

    // Dynamic validation: accept any valid structure
    if (!spec || typeof spec !== "object") {
      console.log("❌ Failed: Invalid spec structure");
      return false;
    }

    // Check if it has the basic required structure
    const hasRequests =
      Array.isArray(spec.requests) && spec.requests.length > 0;
    const hasLoadPattern =
      spec.loadPattern && typeof spec.loadPattern === "object";

    if (!hasRequests || !hasLoadPattern) {
      console.log("❌ Failed: Missing requests or loadPattern");
      return false;
    }

    const firstRequest = spec.requests[0];

    // Dynamic method validation - accept any valid HTTP method
    if (!firstRequest.method || typeof firstRequest.method !== "string") {
      console.log("❌ Failed: Invalid method");
      return false;
    }

    // Dynamic URL validation - accept any valid URL
    if (!firstRequest.url || typeof firstRequest.url !== "string") {
      console.log("❌ Failed: Invalid URL");
      return false;
    }

    try {
      new URL(firstRequest.url);
    } catch (e) {
      console.log("❌ Failed: URL format invalid");
      return false;
    }

    // Dynamic load pattern validation - accept any valid pattern
    const hasValidVirtualUsers =
      typeof spec.loadPattern.virtualUsers === "number" &&
      spec.loadPattern.virtualUsers > 0;

    const hasValidType =
      spec.loadPattern.type && typeof spec.loadPattern.type === "string";

    if (!hasValidVirtualUsers && !hasValidType) {
      console.log("❌ Failed: Invalid load pattern");
      return false;
    }

    // Dynamic body/payload validation - accept either body or payload
    const hasBody = firstRequest.body !== undefined;
    const hasPayload =
      firstRequest.payload && typeof firstRequest.payload === "object";

    if (!hasBody && !hasPayload) {
      console.log("❌ Failed: No body or payload");
      return false;
    }

    // Dynamic headers validation - accept any valid headers object
    if (firstRequest.headers && typeof firstRequest.headers !== "object") {
      console.log("❌ Failed: Invalid headers");
      return false;
    }

    console.log("✅ AI result validation passed");
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
