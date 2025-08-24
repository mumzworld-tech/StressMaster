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
import { generateTestId } from "../../../features/common/string-utils";
import {
  CommandParser,
  ParserConfig,
  ParseResult,
  ParserMetrics,
} from "./interfaces";

// Add rate limiting and caching imports
import { RateLimiter } from "../rate-limiter";
import { ParseCache } from "../parse-cache";
import * as path from "path";

export class UnifiedCommandParser implements CommandParser {
  private aiProvider!: AIProvider;
  private fallbackParser: FallbackParser;
  private promptBuilder: PromptBuilder;
  private responseHandler: ResponseHandler;
  private config: ParserConfig;
  private isReady: boolean = false;
  private rateLimiter: RateLimiter;
  private parseCache: ParseCache;

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

    // Initialize rate limiting and caching
    this.rateLimiter = new RateLimiter({
      maxRequestsPerMinute: 60, // Limit AI calls
      maxRequestsPerHour: 1000,
      burstSize: 10,
    });

    this.parseCache = new ParseCache({
      maxSize: 1000,
      ttlMinutes: 60,
      persistent: true, // Enable persistent storage
      cacheFile: path.join(process.cwd(), "cache", "parse-cache.json"),
    });
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

      // Prioritize constructor config over file config
      const aiConfig: AIConfig = {
        provider:
          this.config.aiProvider || aiConfigFromFile.provider || "ollama",
        model:
          this.config.modelName ||
          aiConfigFromFile.ollama?.model ||
          aiConfigFromFile.model ||
          "llama3.2:1b",
        apiKey: this.config.apiKey || aiConfigFromFile.apiKey,
        endpoint:
          this.config.ollamaEndpoint ||
          aiConfigFromFile.ollama?.endpoint ||
          aiConfigFromFile.endpoint ||
          "http://localhost:11434",
        maxRetries: this.config.maxRetries || aiConfigFromFile.maxRetries || 3,
        timeout: this.config.timeout || aiConfigFromFile.timeout || 30000,
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
    // Check cache first with smart semantic matching
    const cacheKey = this.generateCacheKey(input);
    let cachedResult = this.parseCache.get(cacheKey);

    // If no direct match, try variant cache keys
    if (!cachedResult) {
      const variantKeys = this.generateVariantCacheKey(input);
      for (const variantKey of variantKeys) {
        cachedResult = this.parseCache.get(variantKey);
        if (cachedResult) {
          console.log("📋 Using cached parse result (semantic match)");
          console.log(`🔍 Matched variant key: ${variantKey}`);
          console.log(`📊 Cache size: ${this.parseCache.size()}`);

          // Adapt cached result to current command parameters
          const adaptedResult = this.adaptCachedResult(cachedResult, input);
          return adaptedResult;
        }
      }
    } else {
      console.log("📋 Using cached parse result (exact match)");
      console.log(`🔍 Cache key: ${cacheKey}`);
      console.log(`📊 Cache size: ${this.parseCache.size()}`);

      // Adapt cached result to current command parameters
      const adaptedResult = this.adaptCachedResult(cachedResult, input);
      return adaptedResult;
    }

    console.log("🔄 Cache miss, making AI call");
    console.log(`🔍 Cache key: ${cacheKey}`);
    console.log(
      `🔍 Normalized: ${this.normalizeCommand(input.toLowerCase().trim())}`
    );

    const usedCacheKey = cacheKey;

    // Check rate limits
    if (!this.rateLimiter.canMakeRequest()) {
      console.log("⚠️ Rate limit reached, using fallback parser");
      const fallbackResult = await this.fallbackParser.parseCommand(input);
      return fallbackResult.spec;
    }

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
          // Silent validation - only show if there's an issue

          // Use AI result if it's valid (Claude is very capable, so we trust it more)
          if (isAIResultValid) {
            console.log("✅ AI parsing successful!");
            metrics.confidenceScore = aiResult.confidence;
            metrics.parseTime = Date.now() - startTime;

            // Directly enhance the AI result with incrementing support
            try {
              const enhancedSpec = ResponseHandler.enhanceLoadTestSpec(
                aiResult.spec,
                input
              );

              // Cache the successful result
              this.parseCache.set(usedCacheKey, enhancedSpec);

              return enhancedSpec;
            } catch (enhanceError) {
              metrics.errorCount++;
              console.warn(`AI enhancement failed: ${enhanceError}`);
              // Only fall back for major enhancement failures
              if (this.config.aiProvider === "claude") {
                console.log(
                  "🔄 Claude enhancement failed, but result is still usable"
                );
                return aiResult.spec; // Return the original AI result
              } else {
                // For other providers, use fallback
                metrics.fallbackUsed = true;
                const fallbackResult = await this.fallbackParser.parseCommand(
                  input
                );
                metrics.confidenceScore = fallbackResult.confidence;
                metrics.parseTime = Date.now() - startTime;
                return fallbackResult.spec;
              }
            }
          } else {
            console.warn(
              `AI result invalid (${aiResult.confidence}), trying fallback`
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
      let response;

      // For Claude, we trust it to handle complex commands and file references
      if (this.config.aiProvider === "claude") {
        // Use the full prompt builder for Claude
        const prompt = PromptBuilder.buildFullPrompt(input);

        // Get AI response
        response = await this.aiProvider.generateCompletion({
          prompt: input,
          systemPrompt: prompt,
          model: this.config.modelName,
          maxTokens: 2000,
          temperature: 0.1,
          format: "json",
        });
      } else {
        // For other providers, use the original logic
        // Check if command contains file references - use fallback parser for these
        if (input.includes("@") && input.includes(".json")) {
          console.log("🔄 File reference detected - using fallback parser");
          throw new Error("Use fallback parser for file references");
        }

        // Build the prompt for AI parsing using intelligent template selection
        const prompt = selectPromptTemplate(input);

        // If no prompt is returned, it means we should use fallback for complex commands
        if (!prompt) {
          console.log("🔄 Complex command detected - using fallback parser");
          throw new Error("Use fallback parser");
        }

        // Get AI response
        response = await this.aiProvider.generateCompletion({
          prompt,
          format: "json",
          temperature: 0.01, // Very low temperature for consistent parsing
          maxTokens: 4000, // Increase max tokens for complex JSON
        });
      }

      // Parse the response
      try {
        const parsedJson = JSON.parse(response.response);

        // Only show detailed AI response in development mode
        if (process.env.NODE_ENV === "development") {
          // Silent raw response - no need to show technical details
          console.log(
            "🔍 Parsed AI Response:",
            JSON.stringify(parsedJson, null, 2)
          );
        }

        // Validate the AI response structure
        if (!this.isValidAIResponse(parsedJson)) {
          throw new Error("AI response has invalid structure");
        }

        // Convert the AI response to LoadTestSpec
        let spec: LoadTestSpec;

        // Check if AI returned LoadTestSpec format directly
        if (parsedJson.requests && Array.isArray(parsedJson.requests)) {
          // AI returned LoadTestSpec format - use it directly with some defaults
          spec = {
            id: parsedJson.id || `ai_${Date.now()}`,
            name: parsedJson.name || "AI Generated Test",
            description:
              parsedJson.description ||
              "Generated from natural language command",
            testType: parsedJson.testType || "baseline",
            requests: parsedJson.requests,
            loadPattern: parsedJson.loadPattern || {
              type: "constant",
              virtualUsers: 1,
            },
            duration: parsedJson.duration || { value: 60, unit: "seconds" },
          };
        } else {
          // AI returned old format - convert to LoadTestSpec
          spec = {
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
        }

        // Add incrementing support if mentioned in the command
        if (input.toLowerCase().includes("increment")) {
          const incrementFields = this.extractIncrementFields(input);
          if (incrementFields.length > 0) {
            // Only show debug info in development mode
            if (process.env.NODE_ENV === "development") {
              console.log(
                "🔧 AI Parser: Creating payload template for incrementing fields:",
                incrementFields
              );
            }

            // Check if AI already created a proper payload template
            if (spec.requests[0].payload && spec.requests[0].payload.template) {
              if (process.env.NODE_ENV === "development") {
                console.log("🔧 AI Parser: Preserving AI's payload template");
              }
              // AI already created the template, preserve its variables
              if (spec.requests[0].payload.variables) {
                if (process.env.NODE_ENV === "development") {
                  console.log(
                    "🔧 AI Parser: AI provided variables:",
                    spec.requests[0].payload.variables
                  );
                }

                // Fix variable structure to match executor expectations
                spec.requests[0].payload.variables =
                  spec.requests[0].payload.variables.map((variable: any) => {
                    // If variable has startValue directly, move it to parameters
                    if (variable.startValue && !variable.parameters) {
                      // For requestId, create a proper base value
                      let startValue = variable.startValue;
                      if (variable.name === "requestId" && startValue === "1") {
                        startValue = "burst-test-1";
                      }
                      return {
                        name: variable.name,
                        type: variable.type,
                        parameters: {
                          startValue: startValue,
                          ...(variable.prefix && { prefix: variable.prefix }),
                        },
                      };
                    }
                    return variable;
                  });

                // Replace static values in the template with placeholders
                if (spec.requests[0].payload.template) {
                  let template = spec.requests[0].payload.template;
                  spec.requests[0].payload.variables.forEach(
                    (variable: any) => {
                      // Replace the static value with a placeholder
                      if (variable.name === "requestId") {
                        // Find and replace the requestId value in the JSON
                        template = template.replace(
                          /"requestId":\s*"[^"]*"/g,
                          `"requestId": "{{${variable.name}}}"`
                        );
                      }
                    }
                  );
                  spec.requests[0].payload.template = template;
                }

                if (process.env.NODE_ENV === "development") {
                  console.log(
                    "🔧 AI Parser: Fixed variables structure:",
                    spec.requests[0].payload.variables
                  );
                }
              } else {
                // Only create variables if AI didn't provide them
                spec.requests[0].payload.variables = incrementFields.map(
                  (field) => ({
                    name: field,
                    type: "incremental",
                    parameters: {
                      baseValue:
                        this.findFieldValue(
                          spec.requests[0].body || {},
                          field
                        ) || "1",
                    },
                  })
                );
              }
            } else {
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
            }

            if (process.env.NODE_ENV === "development") {
              console.log(
                "🔧 AI Parser: Final payload template:",
                spec.requests[0].payload
              );
            }
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
    // Check if it has the LoadTestSpec format (new format)
    if (
      response.requests &&
      Array.isArray(response.requests) &&
      response.requests.length > 0
    ) {
      const firstRequest = response.requests[0];
      if (firstRequest.method && firstRequest.url) {
        // Check for valid HTTP method
        const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
        if (!validMethods.includes(firstRequest.method.toUpperCase())) {
          return false;
        }

        // Check for valid URL format
        try {
          new URL(firstRequest.url);
          return true;
        } catch {
          return false;
        }
      }
    }

    // Check if it has the old format (direct method and url)
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
    // Silent validation details - no need to show technical details

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

    // Dynamic body/payload validation - GET requests don't need body/payload
    const isGetRequest = firstRequest.method.toUpperCase() === "GET";
    const hasBody = firstRequest.body !== undefined;
    const hasPayload =
      firstRequest.payload && typeof firstRequest.payload === "object";

    if (!isGetRequest && !hasBody && !hasPayload) {
      console.log("❌ Failed: No body or payload for non-GET request");
      return false;
    }

    // Dynamic headers validation - accept any valid headers object
    if (firstRequest.headers && typeof firstRequest.headers !== "object") {
      console.log("❌ Failed: Invalid headers");
      return false;
    }

    // Silent validation success - no need to show technical details
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

  private generateCacheKey(input: string): string {
    // Smart semantic cache key generation
    // Normalize similar commands to use the same cache entry

    const normalized = this.normalizeCommand(input.toLowerCase().trim());

    // Extract HTTP method for cache key differentiation
    const httpMethod = this.extractHttpMethod(input);

    // Simple hash function for the normalized command
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Include HTTP method in cache key to prevent collisions
    return `cmd:${httpMethod}:${hash}`;
  }

  private normalizeCommand(input: string): string {
    // Normalize command for better cache hits
    let normalized = input;

    // Normalize common patterns
    const patterns = [
      // Normalize numbers (but keep the pattern)
      { regex: /\b\d+\b/g, replacement: "NUM" },

      // Normalize URLs to domain only (keep path structure)
      {
        regex: /https?:\/\/([^\/\s]+)(\/[^\s]*)?/g,
        replacement: "PROTOCOL://DOMAIN$2",
      },

      // Normalize common variations
      { regex: /\b(get|GET)\b/g, replacement: "GET" },
      { regex: /\b(post|POST)\b/g, replacement: "POST" },
      { regex: /\b(put|PUT)\b/g, replacement: "PUT" },
      { regex: /\b(delete|DELETE)\b/g, replacement: "DELETE" },

      // Normalize request/requests
      { regex: /\b(request|requests)\b/g, replacement: "requests" },

      // Normalize send/make variations
      { regex: /\b(send|make|execute|run)\b/g, replacement: "send" },

      // Normalize time units
      { regex: /\b(second|seconds|sec|s)\b/g, replacement: "seconds" },
      { regex: /\b(minute|minutes|min|m)\b/g, replacement: "minutes" },

      // Normalize spacing and punctuation
      { regex: /\s+/g, replacement: " " },
      { regex: /[,;.!?]/g, replacement: "" },
    ];

    patterns.forEach((pattern) => {
      normalized = normalized.replace(pattern.regex, pattern.replacement);
    });

    return normalized.trim();
  }

  private generateVariantCacheKey(input: string): string[] {
    // Generate multiple cache keys for different variations
    const baseNormalized = this.normalizeCommand(input.toLowerCase().trim());
    const variants = [baseNormalized];

    // Add variants for common patterns
    const commonVariants = [
      // Remove specific numbers but keep structure
      baseNormalized.replace(/NUM/g, "X"),

      // Remove protocol/domain specifics
      baseNormalized.replace(/PROTOCOL:\/\/DOMAIN/g, "URL"),

      // Ultra-generic version (method + endpoint pattern)
      this.extractCommandPattern(baseNormalized),
    ];

    variants.push(...commonVariants.filter((v) => v !== baseNormalized));

    // Generate hashes for all variants
    return variants.map((variant) => {
      let hash = 0;
      for (let i = 0; i < variant.length; i++) {
        hash = variant.charCodeAt(i) + ((hash << 5) - hash);
      }
      return `cmd:${hash}`;
    });
  }

  private extractCommandPattern(normalized: string): string {
    // Extract the essential pattern: METHOD + endpoint structure
    const patterns = [
      // "send NUM GET requests to URL" → "send GET requests to URL"
      /send\s+NUM\s+(GET|POST|PUT|DELETE)\s+requests\s+to\s+URL/,
      // "NUM GET requests to URL" → "GET requests to URL"
      /NUM\s+(GET|POST|PUT|DELETE)\s+requests\s+to\s+URL/,
      // Generic fallback
      /(GET|POST|PUT|DELETE)\s+requests/,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return normalized;
  }

  private adaptCachedResult(
    cachedResult: LoadTestSpec,
    input: string
  ): LoadTestSpec {
    // Adapt cached result to current command parameters
    const newSpec = JSON.parse(JSON.stringify(cachedResult)); // Deep clone

    // Extract request count from current input
    const requestCount = this.extractRequestCount(input);
    if (requestCount !== null) {
      // Update virtual users to match request count
      if (newSpec.loadPattern) {
        newSpec.loadPattern.virtualUsers = requestCount;
      }
    }

    // Generate new ID for this adapted result
    newSpec.id = generateTestId(newSpec);

    console.log(
      `🔧 Adapted cache result: ${cachedResult.loadPattern?.virtualUsers} → ${newSpec.loadPattern?.virtualUsers} requests`
    );

    return newSpec;
  }

  private extractHttpMethod(input: string): string {
    // Extract HTTP method from command
    const methods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ];

    for (const method of methods) {
      if (input.toUpperCase().includes(method)) {
        return method;
      }
    }

    // Default to GET if no method specified
    return "GET";
  }

  private extractRequestCount(input: string): number | null {
    // Extract number from patterns like "send 7 requests", "make 10 GET requests"
    const patterns = [
      /(\d+)\s+(requests|request)/i,
      /send\s+(\d+)/i,
      /make\s+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > 0) {
          return count;
        }
      }
    }
    return null;
  }
}
