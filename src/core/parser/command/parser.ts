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
import { requireStressMasterDir } from "../../../utils/require-stressmaster-dir";

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
      // Don't set hardcoded defaults - let the config file determine the provider
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

    const { getParseCachePath } = requireStressMasterDir();
    this.parseCache = new ParseCache({
      maxSize: 1000,
      ttlMinutes: 60,
      persistent: true, // Enable persistent storage
      cacheFile: getParseCachePath(),
    });
  }

  async initialize(): Promise<void> {
    try {
      // Load AI configuration from config file
      const fs = await import("fs");
      const { getAIConfigPath } = requireStressMasterDir();
      const configPath = getAIConfigPath();
      let aiConfigFromFile: any = {};

      try {
        const configContent = fs.readFileSync(configPath, "utf8");
        aiConfigFromFile = JSON.parse(configContent);
      } catch (configError: any) {
        // Silently handle missing config file - this is expected for first-time setup
        if (configError?.code === "ENOENT") {
          // Config file doesn't exist yet - this is normal for setup command
          // Don't log anything, just continue with defaults
        } else {
          // Only log if it's a different error (permissions, invalid JSON, etc.)
          console.warn(
            `Failed to load AI config from ${configPath}:`,
            configError
          );
        }
      }

      // Prioritize: environment variables -> config file -> constructor config -> defaults
      const aiConfig: AIConfig = {
        provider:
          process.env.AI_PROVIDER ||
          aiConfigFromFile.provider ||
          this.config.aiProvider ||
          "ollama",
        model:
          process.env.AI_MODEL ||
          aiConfigFromFile.model ||
          this.config.modelName ||
          "llama3.2:1b",
        apiKey:
          process.env.AI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.OPENAI_API_KEY ||
          aiConfigFromFile.apiKey ||
          this.config.apiKey,
        endpoint:
          process.env.AI_ENDPOINT ||
          aiConfigFromFile.endpoint ||
          this.config.ollamaEndpoint ||
          "http://localhost:11434",
        maxRetries: aiConfigFromFile.maxRetries || this.config.maxRetries || 3,
        timeout: aiConfigFromFile.timeout || this.config.timeout || 30000,
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
          // Using cached result (semantic match)

          // Adapt cached result to current command parameters
          const adaptedResult = this.adaptCachedResult(cachedResult, input);
          return adaptedResult;
        }
      }
    } else {
      // Using cached result (exact match)

      // Adapt cached result to current command parameters
      const adaptedResult = this.adaptCachedResult(cachedResult, input);
      return adaptedResult;
    }

    // Cache miss, making AI call

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
          // Attempting AI parsing...
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
              // Extract OpenAPI file dependencies for cache invalidation
              const fileDependencies = this.extractOpenAPIFilePaths(input);
              this.parseCache.set(usedCacheKey, enhancedSpec, fileDependencies);

              return enhancedSpec;
            } catch (enhanceError) {
              metrics.errorCount++;
              console.warn(`AI enhancement failed: ${enhanceError}`);
              // Unified fallback for all providers
              console.log("🔄 AI enhancement failed, using fallback");
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

      // Enhanced file reference detection - now includes OpenAPI files
      const hasFileReference =
        input.includes("@") &&
        (input.includes(".json") ||
          input.includes(".yaml") ||
          input.includes(".yml"));
      const hasOpenAPIFile = this.detectOpenAPIFile(input);

      // If OpenAPI file is detected, enhance the prompt with OpenAPI context
      let enhancedInput = input;
      if (hasOpenAPIFile) {
        enhancedInput = await this.enhanceWithOpenAPIContext(input);
      }

      // Unified approach for all providers - no special Claude handling
      const prompt = this.buildSimplePrompt(enhancedInput);

      // Get AI response with deterministic temperature for consistent output
      response = await this.aiProvider.generateCompletion({
        prompt,
        format: "json",
        temperature: 0.0, // Deterministic output (0.01 minimum for some models)
        maxTokens: 2000, // Reduced from 4000 for faster responses
      });

      // Parse the response
      try {
        const parsedJson = JSON.parse(response.response);

        // AI response received

        // Validate the AI response structure
        if (!this.isValidAIResponse(parsedJson)) {
          console.log("❌ AI response validation failed");
          throw new Error("AI response has invalid structure");
        }

        // Convert the AI response to LoadTestSpec
        let spec: LoadTestSpec;

        // Check if AI returned batch format
        if (parsedJson.testType === "batch" && parsedJson.batch) {
          // AI returned batch format - use it directly
          spec = {
            id: parsedJson.id || `batch_${Date.now()}`,
            name: parsedJson.name || "AI Generated Batch Test",
            description:
              parsedJson.description ||
              "Generated batch test from natural language command",
            testType: parsedJson.testType || "batch",
            requests: parsedJson.requests || [], // Empty for batch tests
            batch: parsedJson.batch,
            loadPattern: parsedJson.loadPattern || {
              type: "constant",
              virtualUsers: 1,
            },
            duration: parsedJson.duration || { value: 60, unit: "seconds" },
          };
        }
        // Check if AI returned workflow format
        else if (parsedJson.workflow && Array.isArray(parsedJson.workflow)) {
          // AI returned workflow format - use it directly
          spec = {
            id: parsedJson.id || `workflow_${Date.now()}`,
            name: parsedJson.name || "AI Generated Workflow",
            description:
              parsedJson.description ||
              "Generated workflow from natural language command",
            testType: parsedJson.testType || "workflow",
            requests: parsedJson.requests || [], // Empty for workflow tests
            workflow: parsedJson.workflow,
            loadPattern: parsedJson.loadPattern || {
              type: "constant",
              virtualUsers: 1,
            },
            duration: parsedJson.duration || { value: 60, unit: "seconds" },
          };
        }
        // Check if AI returned LoadTestSpec format directly
        else if (parsedJson.requests && Array.isArray(parsedJson.requests)) {
          // AI returned LoadTestSpec format - use it directly
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
          // AI returned simple format - convert to LoadTestSpec
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

        // Handle file references and incrementing fields
        if (spec.requests[0]) {
          const request = spec.requests[0];

          // Check if body contains a file reference
          if (
            request.body &&
            typeof request.body === "string" &&
            request.body.startsWith("@")
          ) {
            // Convert file reference to payload template
            request.payload = {
              template: request.body,
              variables: [],
            };
            delete request.body;
          }

          // Handle incrementing fields if mentioned
          if (input.toLowerCase().includes("increment")) {
            const incrementFields = this.extractIncrementFields(input);
            if (incrementFields.length > 0) {
              // Create payload template if not exists
              if (!request.payload) {
                request.payload = {
                  template: request.body || "{}",
                  variables: [],
                };
                delete request.body;
              }

              // Add variables for incrementing fields - extract base values from file
              if (request.payload.template.startsWith("@")) {
                const { FileResolver } = await import(
                  "../../../utils/file-resolver"
                );
                const fs = await import("fs");

                try {
                  const filePath = request.payload.template.substring(1);
                  const resolved = FileResolver.resolveFile(filePath);

                  if (resolved.exists && resolved.resolvedPath) {
                    const fileContent = fs.readFileSync(
                      resolved.resolvedPath,
                      "utf8"
                    );
                    const jsonData = JSON.parse(fileContent);

                    // Helper to find nested field value (case-insensitive)
                    const findNestedValue = (
                      obj: any,
                      fieldName: string
                    ): any => {
                      if (obj === null || obj === undefined) return undefined;
                      if (typeof obj !== "object") return undefined;

                      // Check direct property (case-insensitive)
                      for (const key in obj) {
                        if (key.toLowerCase() === fieldName.toLowerCase()) {
                          return obj[key];
                        }
                      }

                      // Check nested objects
                      for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                          const nested = findNestedValue(obj[key], fieldName);
                          if (nested !== undefined) {
                            return nested;
                          }
                        }
                      }

                      return undefined;
                    };

                    incrementFields.forEach((field) => {
                      const baseValue = findNestedValue(jsonData, field);
                      request.payload!.variables.push({
                        name: field,
                        type: "incremental",
                        parameters: {
                          baseValue:
                            baseValue !== undefined ? String(baseValue) : "1",
                        },
                      });
                    });
                  } else {
                    // File not found, use defaults
                    incrementFields.forEach((field) => {
                      request.payload!.variables.push({
                        name: field,
                        type: "incremental",
                        parameters: {
                          baseValue: "1",
                        },
                      });
                    });
                  }
                } catch (error) {
                  // Error reading file, use defaults
                  incrementFields.forEach((field) => {
                    request.payload!.variables.push({
                      name: field,
                      type: "incremental",
                      parameters: {
                        baseValue: "1",
                      },
                    });
                  });
                }
              } else {
                // Not a file reference, use defaults
                incrementFields.forEach((field) => {
                  request.payload!.variables.push({
                    name: field,
                    type: "incremental",
                    parameters: {
                      baseValue: "1",
                    },
                  });
                });
              }
            }
          }
        }

        return {
          spec,
          confidence: 0.8, // Simplified confidence calculation
          ambiguities: [],
          suggestions: [],
        };
      } catch (parseError) {
        console.warn("AI response parsing failed:", parseError);
        throw new Error("AI response parsing failed");
      }
    } catch (error) {
      console.warn("AI parsing failed:", error);
      throw error;
    }
  }

  private buildSimplePrompt(input: string): string {
    // Use the proper prompt builder for comprehensive AI parsing
    return PromptBuilder.buildFullPrompt(input);
  }

  private isValidAIResponse(response: any): boolean {
    // Check if it has batch format
    if (response.testType === "batch" && response.batch) {
      const batch = response.batch;

      // Validate batch structure
      if (
        !batch.tests ||
        !Array.isArray(batch.tests) ||
        batch.tests.length === 0
      ) {
        return false;
      }

      if (
        !batch.executionMode ||
        !["parallel", "sequential"].includes(batch.executionMode)
      ) {
        return false;
      }

      // Validate each test in the batch
      for (const test of batch.tests) {
        if (!test.id || !test.name || !test.requests) {
          return false;
        }

        if (!Array.isArray(test.requests) || test.requests.length === 0) {
          return false;
        }

        // Validate first request in each test
        const firstRequest = test.requests[0];
        if (!firstRequest.method || !firstRequest.url) {
          return false;
        }

        // Check for valid HTTP method
        const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
        if (!validMethods.includes(firstRequest.method.toUpperCase())) {
          return false;
        }

        // Check for valid URL format
        try {
          new URL(firstRequest.url);
        } catch {
          return false;
        }
      }
      return true; // Batch format is valid
    }

    // Check if it has workflow format
    if (response.workflow && Array.isArray(response.workflow)) {
      // For workflows, we need to validate the workflow structure
      for (const workflowStep of response.workflow) {
        if (
          workflowStep.type &&
          workflowStep.steps &&
          Array.isArray(workflowStep.steps)
        ) {
          for (const step of workflowStep.steps) {
            if (step.method && step.url) {
              // Check for valid HTTP method
              const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
              if (!validMethods.includes(step.method.toUpperCase())) {
                return false;
              }
              // Check for valid URL format
              try {
                new URL(step.url);
              } catch {
                return false;
              }
            }
          }
        }
      }
      return true; // Workflow format is valid
    }

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

  /**
   * Detect if the input contains an OpenAPI file reference
   */
  /**
   * Extract OpenAPI file paths from input for cache dependency tracking
   */
  private extractOpenAPIFilePaths(input: string): string[] {
    const filePaths: string[] = [];
    const fileMatches = input.matchAll(/@([\w\-_\/]+\.(yaml|yml|json))/gi);

    for (const match of fileMatches) {
      filePaths.push(match[1]);
    }

    return filePaths;
  }

  private detectOpenAPIFile(input: string): boolean {
    // Only detect OpenAPI files if input contains explicit OpenAPI keywords
    // Don't match every .json/.yaml file - only those explicitly mentioned as OpenAPI
    const openAPIPatterns = [
      /openapi/i,
      /swagger/i,
      /api\s+spec/i,
      /api\s+definition/i,
      /@[\w\-_\/]*(openapi|swagger|api[-_]?spec|api[-_]?def)[\w\-_\/]*\.(yaml|yml|json)/i, // Filename contains OpenAPI keywords
    ];

    return openAPIPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Check if a file is actually an OpenAPI specification by validating its structure
   */
  private async isOpenAPIFile(filePath: string): Promise<boolean> {
    try {
      const { FileResolver } = await import("../../../utils/file-resolver");
      const fs = await import("fs");
      const path = await import("path");
      const yaml = await import("js-yaml");

      const resolved = FileResolver.resolveFile(filePath);
      if (!resolved.exists || !resolved.resolvedPath) {
        return false;
      }

      const content = fs.readFileSync(resolved.resolvedPath, "utf8");
      const fileExt = path.extname(resolved.resolvedPath).toLowerCase();

      let parsed: any;
      if (fileExt === ".yaml" || fileExt === ".yml") {
        parsed = yaml.load(content);
      } else if (fileExt === ".json") {
        parsed = JSON.parse(content);
      } else {
        return false;
      }

      // Quick validation: OpenAPI files must have either:
      // 1. openapi field (OpenAPI 3.x)
      // 2. swagger field (Swagger/OpenAPI 2.0)
      // 3. Both info and paths fields (minimal OpenAPI structure)
      if (!parsed || typeof parsed !== "object") {
        return false;
      }

      return (
        parsed.openapi !== undefined ||
        parsed.swagger !== undefined ||
        (parsed.info && parsed.paths)
      );
    } catch (error) {
      // If we can't read/parse the file, assume it's not OpenAPI
      return false;
    }
  }

  /**
   * Enhance input with OpenAPI context by parsing the file and adding schema information
   */
  private async enhanceWithOpenAPIContext(input: string): Promise<string> {
    try {
      // Extract file path from input
      const fileMatch = input.match(/@([\w\-_\/]+\.(yaml|yml|json))/i);
      if (!fileMatch) return input;

      const filePath = fileMatch[1];

      // First, validate that this is actually an OpenAPI file
      const isOpenAPI = await this.isOpenAPIFile(filePath);
      if (!isOpenAPI) {
        // Not an OpenAPI file, skip enhancement silently
        return input;
      }

      // Import OpenAPI parser
      const { OpenAPIParser } = await import(
        "../../../features/openapi/parser"
      );
      const parser = new OpenAPIParser();

      // Parse the OpenAPI file (FileResolver is used internally)
      const result = await parser.parseFromFile(filePath);

      if (!result.success) {
        // Only log warning if we confirmed it's supposed to be an OpenAPI file
        console.warn(`Failed to parse OpenAPI file: ${filePath}`);
        return input;
      }

      // Create enhanced context
      const enhancedContext = this.createOpenAPIContext(result);

      return `${input}\n\nOpenAPI Context:\n${enhancedContext}`;
    } catch (error) {
      // Silently fail - don't log errors for non-OpenAPI files
      return input;
    }
  }

  /**
   * Create OpenAPI context string for AI prompt
   */
  private createOpenAPIContext(result: any): string {
    const { spec, endpoints } = result;

    let context = `API: ${spec.info?.title || "Unknown"} (${
      spec.info?.version || "Unknown"
    })\n`;
    context += `Base URL: ${spec.servers?.[0]?.url || "Not specified"}\n`;
    context += `Endpoints:\n`;

    endpoints.forEach((endpoint: any, index: number) => {
      context += `${index + 1}. ${endpoint.method.toUpperCase()} ${
        endpoint.path
      }\n`;
      if (endpoint.summary) {
        context += `   Summary: ${endpoint.summary}\n`;
      }
      if (endpoint.requestBody) {
        context += `   Request Body Schema: ${JSON.stringify(
          endpoint.requestBody.schema,
          null,
          2
        )}\n`;
        if (endpoint.requestBody.example) {
          context += `   Example: ${JSON.stringify(
            endpoint.requestBody.example,
            null,
            2
          )}\n`;
        }
      }
      if (endpoint.parameters && endpoint.parameters.length > 0) {
        context += `   Parameters: ${endpoint.parameters
          .map((p: any) => `${p.name}(${p.type})`)
          .join(", ")}\n`;
      }
      context += "\n";
    });

    context +=
      "\nIMPORTANT: Use the examples and schema to generate REALISTIC values, not faker templates.";

    return context;
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

    // If body is a string that looks like a file reference, preserve it
    if (typeof body === "string" && body.startsWith("@")) {
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
    const hasLoadPattern =
      spec.loadPattern && typeof spec.loadPattern === "object";

    if (!hasLoadPattern) {
      console.log("❌ Failed: Missing loadPattern");
      return false;
    }

    // Check if it's a batch test
    if (spec.testType === "batch" && spec.batch) {
      // Validate batch structure
      const batch = spec.batch;

      if (
        !batch.tests ||
        !Array.isArray(batch.tests) ||
        batch.tests.length === 0
      ) {
        console.log("❌ Failed: Batch missing tests array");
        return false;
      }

      if (
        !batch.executionMode ||
        !["parallel", "sequential"].includes(batch.executionMode)
      ) {
        console.log("❌ Failed: Invalid batch execution mode");
        return false;
      }

      // Validate each test in the batch
      for (const test of batch.tests) {
        if (!test.id || !test.name || !test.requests) {
          console.log("❌ Failed: Invalid batch test structure");
          return false;
        }

        if (!Array.isArray(test.requests) || test.requests.length === 0) {
          console.log("❌ Failed: Batch test missing requests");
          return false;
        }

        // Validate first request in each test
        const firstRequest = test.requests[0];
        if (!firstRequest.method || !firstRequest.url) {
          console.log("❌ Failed: Invalid request in batch test");
          return false;
        }

        // Check for valid HTTP method
        const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
        if (!validMethods.includes(firstRequest.method.toUpperCase())) {
          console.log("❌ Failed: Invalid method in batch test");
          return false;
        }

        // Check for valid URL format
        try {
          new URL(firstRequest.url);
        } catch (e) {
          console.log("❌ Failed: URL format invalid in batch test");
          return false;
        }
      }
      return true; // Batch is valid
    }

    // Check if it's a workflow test
    if (
      spec.testType === "workflow" &&
      spec.workflow &&
      Array.isArray(spec.workflow)
    ) {
      // Validate workflow structure
      for (const workflowStep of spec.workflow) {
        if (
          workflowStep.type &&
          workflowStep.steps &&
          Array.isArray(workflowStep.steps)
        ) {
          for (const step of workflowStep.steps) {
            // Check if it's a WorkflowRequest (has method and url)
            if ("method" in step && "url" in step && step.method && step.url) {
              // Check for valid HTTP method
              const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
              if (!validMethods.includes(step.method.toUpperCase())) {
                console.log("❌ Failed: Invalid method in workflow");
                return false;
              }
              // Check for valid URL format
              try {
                new URL(step.url);
              } catch (e) {
                console.log("❌ Failed: URL format invalid in workflow");
                return false;
              }
            }
          }
        }
      }
      return true; // Workflow is valid
    }

    // Check if it has the basic required structure for single requests
    const hasRequests =
      Array.isArray(spec.requests) && spec.requests.length > 0;

    if (!hasRequests) {
      console.log("❌ Failed: Missing requests");
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
    const hasMedia =
      firstRequest.media && typeof firstRequest.media === "object";

    if (!isGetRequest && !hasBody && !hasPayload && !hasMedia) {
      console.log("❌ Failed: No body, payload, or media for non-GET request");
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
    // Enhanced cache key generation to prevent collisions
    // Include domain information to differentiate between different endpoints

    const normalized = this.normalizeCommand(input.toLowerCase().trim());

    // Extract HTTP method for cache key differentiation
    const httpMethod = this.extractHttpMethod(input);

    // Extract domain for better cache differentiation
    const domain = this.extractDomain(input);

    // Simple hash function for the normalized command
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Include HTTP method and domain in cache key to prevent collisions
    return `cmd:${httpMethod}:${domain}:${hash}`;
  }

  private extractDomain(input: string): string {
    // Extract domain from URL for cache key differentiation
    const urlMatch = input.match(/https?:\/\/([^\/\s]+)/);

    return urlMatch ? urlMatch[1] : "localhost";
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
