/**
 * Unified response handling system that combines response parsing with validation
 * Merges functionality from response-parser.ts and command-validator.ts
 */

import {
  LoadTestSpec,
  RequestSpec,
  LoadPattern,
  PayloadSpec,
  VariableDefinition,
} from "../../types";
import { ValidationResult } from "../../types/common";
import { PromptBuilder } from "./prompt-builder";
import {
  cleanJsonResponse,
  attemptJsonFix,
  generateTestId,
} from "../../features/common/string-utils";
import { isValidJson } from "../../features/common/validation-utils";

export interface ParsedResponse {
  spec: LoadTestSpec;
  confidence: number;
  ambiguities: string[];
  suggestions: string[];
}

export interface ValidationContext {
  originalInput: string;
  confidence: number;
  ambiguities: string[];
}

export interface ValidationIssue {
  type: "error" | "warning" | "suggestion";
  field: string;
  message: string;
  suggestion?: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface EnhancedValidationResult extends ValidationResult {
  issues: ValidationIssue[];
  suggestions: string[];
  canProceed: boolean;
  confidence: number;
}

export class ResponseHandler {
  private static readonly CONFIDENCE_THRESHOLDS = {
    HIGH: 0.8,
    MEDIUM: 0.6,
    LOW: 0.4,
  };

  static parseResponse(
    response: string,
    originalInput: string
  ): ParsedResponse {
    try {
      // Clean the response - remove any markdown formatting or extra text
      const cleanedResponse = cleanJsonResponse(response);

      // Parse JSON
      let parsedSpec: LoadTestSpec;

      try {
        // Parse as JSON - should always be LoadTestSpec format now
        const parsedJson = JSON.parse(cleanedResponse);

        // Validate it's LoadTestSpec format (has required fields)
        if (
          parsedJson.requests &&
          Array.isArray(parsedJson.requests) &&
          parsedJson.requests.length > 0
        ) {
          // Valid LoadTestSpec format
          parsedSpec = parsedJson as LoadTestSpec;
        } else if (
          parsedJson.method &&
          parsedJson.url &&
          !parsedJson.requests
        ) {
          // Legacy simple format - convert for backward compatibility
          // This should rarely happen now that all prompts use LoadTestSpec
          parsedSpec = this.convertSimpleFormatToLoadTestSpec(
            parsedJson,
            originalInput
          );
        } else {
          throw new Error("Invalid response format - missing required fields");
        }
      } catch (error) {
        console.warn("AI response JSON parsing failed:", error);
        // If JSON parsing fails, attempt fallback parsing
        return this.fallbackParsing(response, originalInput);
      }

      // Simplified validation and enhancement
      const enhancedSpec = this.enhanceLoadTestSpec(parsedSpec, originalInput);

      // Simplified confidence calculation
      const confidence = this.calculateConfidence(enhancedSpec, originalInput);
      const ambiguities: string[] = []; // Simplified - no complex ambiguity detection
      const suggestions: string[] = []; // Simplified - no complex suggestions

      return {
        spec: enhancedSpec,
        confidence,
        ambiguities,
        suggestions,
      };
    } catch (error) {
      // If JSON parsing fails, attempt fallback parsing
      return this.fallbackParsing(response, originalInput);
    }
  }

  static validateLoadTestSpec(
    spec: LoadTestSpec,
    context: ValidationContext
  ): EnhancedValidationResult {
    const issues: ValidationIssue[] = [];

    // Run all validation rules
    issues.push(...this.validateRequiredFields(spec, context));
    issues.push(...this.validateUrlFormat(spec, context));
    issues.push(...this.validateLoadParameters(spec, context));
    issues.push(...this.validatePayloadStructure(spec, context));
    issues.push(...this.validateComplexJsonStructure(spec, context)); // Add complex JSON validation
    issues.push(...this.validateDuration(spec, context));
    issues.push(...this.validateTestTypeConsistency(spec, context));
    issues.push(...this.validateWorkflowIntegrity(spec, context));

    // Categorize issues
    const errors = issues.filter((issue) => issue.type === "error");
    const warnings = issues.filter((issue) => issue.type === "warning");
    const suggestions = issues.filter((issue) => issue.type === "suggestion");

    // Generate actionable suggestions
    const actionableSuggestions = this.generateActionableSuggestions(
      issues,
      context
    );

    // Determine if we can proceed
    const criticalErrors = errors.filter(
      (error) => error.severity === "critical"
    );
    const canProceed = criticalErrors.length === 0;

    // Adjust confidence based on issues
    let adjustedConfidence = context.confidence;
    adjustedConfidence -= errors.length * 0.2;
    adjustedConfidence -= warnings.length * 0.1;
    adjustedConfidence = Math.max(0, Math.min(1, adjustedConfidence));

    return {
      isValid: errors.length === 0,
      errors: errors.map((e) => e.message),
      warnings: warnings.map((w) => w.message),
      issues,
      suggestions: actionableSuggestions,
      canProceed,
      confidence: adjustedConfidence,
    };
  }

  public static enhanceLoadTestSpec(
    spec: LoadTestSpec,
    originalInput: string
  ): LoadTestSpec {
    // Ensure required fields are present
    if (!spec.id) {
      spec.id = generateTestId(spec);
    }

    if (!spec.name) {
      spec.name = this.generateTestName(originalInput);
    }

    if (!spec.description) {
      spec.description = originalInput;
    }

    // Enhance requests
    spec.requests = spec.requests.map((request) =>
      this.enhanceRequestSpec(request, originalInput)
    );

    // Ensure load pattern is valid
    if (!spec.loadPattern) {
      spec.loadPattern = this.inferLoadPattern(originalInput);
    }

    // Ensure duration is set
    if (!spec.duration) {
      spec.duration = PromptBuilder.extractDuration(originalInput);
    }

    // Set test type if not specified
    if (!spec.testType) {
      spec.testType = PromptBuilder.inferTestType(originalInput) as any;
    }

    return spec;
  }

  /**
   * Extract base values from file for incrementing fields
   */
  private static extractBaseValuesFromFile(
    fileReference: string,
    incrementFields: string[]
  ): VariableDefinition[] {
    const { FileResolver } = require("../../utils/file-resolver");
    const fs = require("fs");

    try {
      // Resolve and read the file
      const filePath = fileReference.substring(1); // Remove @
      const resolved = FileResolver.resolveFile(filePath);

      if (resolved.exists && resolved.resolvedPath) {
        const fileContent = fs.readFileSync(resolved.resolvedPath, "utf8");
        const jsonData = JSON.parse(fileContent);

        // Helper to find nested field value
        const findNestedValue = (obj: any, fieldName: string): any => {
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

        // Extract base values for each increment field
        return incrementFields.map((field) => {
          const baseValue = findNestedValue(jsonData, field);
          return {
            name: field,
            type: "incremental" as const,
            parameters: {
              baseValue: baseValue !== undefined ? String(baseValue) : "1",
            },
          };
        });
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not extract base values from file ${fileReference}:`,
        error
      );
    }

    // Fallback: return variables with default values
    return incrementFields.map((field) => ({
      name: field,
      type: "incremental" as const,
      parameters: {
        baseValue: "1",
      },
    }));
  }

  private static enhanceRequestSpec(
    request: RequestSpec,
    originalInput: string
  ): RequestSpec {
    // Ensure method is set
    if (!request.method) {
      request.method = PromptBuilder.inferHttpMethod(originalInput) as any;
    }

    // Check if incrementing is requested
    const hasIncrementKeyword = /increment\s+(\w+)/i.test(originalInput);

    // If we have a body but need incrementing, convert to payload structure
    if (request.body && hasIncrementKeyword && !request.payload) {
      console.log(
        "🔍 DEBUG: Converting body to payload, original body:",
        JSON.stringify(request.body)
      );
      let bodyStr =
        typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body);

      // Extract increment fields from original input
      const incrementMatches = Array.from(
        originalInput.matchAll(/increment\s+(\w+)/gi)
      );
      const incrementFields = incrementMatches.map((match) => match[1]);

      // Handle file references in string body
      if (typeof request.body === "string" && request.body.startsWith("@")) {
        console.log("🔍 DEBUG: File reference detected in body string");

        // Extract base values from the file
        const variables = this.extractBaseValuesFromFile(
          request.body,
          incrementFields
        );

        // Convert string file reference to proper payload structure
        request.payload = {
          template: request.body,
          variables: variables,
        };
        delete request.body;
        return request;
      }
      console.log("🔍 DEBUG: Increment fields:", incrementFields);

      // Create variables for incrementing fields
      const variables: VariableDefinition[] = incrementFields.map((field) => {
        // Try to extract the current value from the body
        let baseValue = "1";
        try {
          const bodyObj =
            typeof request.body === "string"
              ? JSON.parse(request.body)
              : request.body;
          if (bodyObj[field]) {
            baseValue = bodyObj[field];
            console.log(
              `🔍 DEBUG: Found ${field} = ${baseValue}, replacing in template`
            );
            // Replace the literal value with template variable in the template
            bodyStr = bodyStr.replace(
              `"${field}": "${baseValue}"`,
              `"${field}": "{{${field}}}"`
            );
            console.log("🔍 DEBUG: Template after replacement:", bodyStr);
          } else {
            console.log(
              `🔍 DEBUG: Field ${field} not found in body object:`,
              JSON.stringify(bodyObj)
            );
          }
        } catch (e) {
          // If parsing fails, use a default
          baseValue = "req-1";
        }

        return {
          name: field,
          type: "incremental" as const,
          parameters: {
            baseValue: baseValue,
          },
        };
      });

      // Convert body to payload with variables
      request.payload = {
        template: bodyStr,
        variables: variables,
      };

      // Remove the body field since we now have payload
      delete request.body;
    }

    // Add default headers for POST/PUT/PATCH requests with payloads
    if (
      ["POST", "PUT", "PATCH"].includes(request.method) &&
      (request.payload || request.body) &&
      !request.headers
    ) {
      request.headers = {
        "Content-Type": "application/json",
      };
    }

    // Enhance payload if present
    if (request.payload) {
      request.payload = this.enhancePayloadSpec(request.payload, originalInput);
    }

    return request;
  }

  private static enhancePayloadSpec(
    payload: PayloadSpec,
    originalInput: string
  ): PayloadSpec {
    // If variables are missing, try to extract them from the template
    if (!payload.variables || payload.variables.length === 0) {
      payload.variables = this.extractVariablesFromTemplate(payload.template);
    }

    // Enhance variable definitions
    payload.variables = payload.variables.map((variable) =>
      this.enhanceVariableDefinition(variable)
    );

    return payload;
  }

  private static enhanceVariableDefinition(
    variable: VariableDefinition
  ): VariableDefinition {
    // Add default parameters if missing
    if (!variable.parameters) {
      variable.parameters = {};
    }

    // Set default parameters based on variable type
    switch (variable.type) {
      case "random_string":
        if (!variable.parameters.length) {
          variable.parameters.length = 10;
        }
        break;
      case "random_id":
        if (!variable.parameters.min) {
          variable.parameters.min = 1000;
        }
        if (!variable.parameters.max) {
          variable.parameters.max = 999999;
        }
        break;
      case "sequence":
        if (!variable.parameters.start) {
          variable.parameters.start = 1;
        }
        if (!variable.parameters.step) {
          variable.parameters.step = 1;
        }
        break;
    }

    return variable;
  }

  private static extractVariablesFromTemplate(
    template: string
  ): VariableDefinition[] {
    const variables: VariableDefinition[] = [];
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const variableName = match[1];

      // Don't add duplicates
      if (variables.some((v) => v.name === variableName)) {
        continue;
      }

      // Infer variable type from name
      let variableType: VariableDefinition["type"] = "random_string";

      if (variableName.toLowerCase().includes("id")) {
        variableType = "random_id";
      } else if (variableName.toLowerCase().includes("uuid")) {
        variableType = "uuid";
      } else if (
        variableName.toLowerCase().includes("time") ||
        variableName.toLowerCase().includes("date")
      ) {
        variableType = "timestamp";
      }

      variables.push({
        name: variableName,
        type: variableType,
        parameters: {},
      });
    }

    return variables;
  }

  private static generateTestName(input: string): string {
    // Extract key components for a meaningful name
    const method = PromptBuilder.inferHttpMethod(input);
    const testType = PromptBuilder.inferTestType(input);

    // Try to extract endpoint from URL
    const urlMatch = input.match(/https?:\/\/[^\s]+|\/[^\s]*/);
    const endpoint = urlMatch ? urlMatch[0].split("/").pop() || "API" : "API";

    return `${
      testType.charAt(0).toUpperCase() + testType.slice(1)
    } Test - ${method} ${endpoint}`;
  }

  private static inferLoadPattern(input: string): LoadPattern {
    const testType = PromptBuilder.inferTestType(input);
    const requestCount = PromptBuilder.extractRequestCount(input);
    const rps = PromptBuilder.extractRPS(input);

    switch (testType) {
      case "spike":
        return {
          type: "spike",
          virtualUsers: requestCount,
        };
      case "stress":
        return {
          type: "ramp-up",
          virtualUsers: requestCount,
          rampUpTime: { value: 2, unit: "minutes" },
        };
      case "endurance":
        return {
          type: "constant",
          virtualUsers: Math.min(requestCount, 50), // Reasonable default for endurance
        };
      default:
        return {
          type: "constant",
          virtualUsers: rps ? undefined : requestCount,
          requestsPerSecond: rps,
        };
    }
  }

  private static calculateConfidence(
    spec: LoadTestSpec,
    originalInput: string
  ): number {
    let confidence = 1.0;

    // Reduce confidence for missing or default values
    if (!spec.requests || spec.requests.length === 0) {
      confidence -= 0.3;
    }

    if (spec.requests.some((r) => !r.url || r.url === "/")) {
      confidence -= 0.2;
    }

    if (!spec.loadPattern.virtualUsers && !spec.loadPattern.requestsPerSecond) {
      confidence -= 0.1;
    }

    // Increase confidence for specific matches
    const lowerInput = originalInput.toLowerCase();
    if (lowerInput.includes(spec.testType)) {
      confidence += 0.1;
    }

    if (
      spec.requests.some((r) => lowerInput.includes(r.method.toLowerCase()))
    ) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private static identifyAmbiguities(
    spec: LoadTestSpec,
    originalInput: string
  ): string[] {
    const ambiguities: string[] = [];

    // Check for missing URL
    if (
      spec.requests.some((r) => !r.url || r.url === "/" || !r.url.includes("."))
    ) {
      ambiguities.push("URL endpoint is unclear or missing");
    }

    // Check for unclear load parameters
    if (!spec.loadPattern.virtualUsers && !spec.loadPattern.requestsPerSecond) {
      ambiguities.push("Load parameters (users or RPS) are unclear");
    }

    // Check for payload without clear structure
    if (
      spec.requests.some(
        (r) => r.payload && (!r.payload.template || r.payload.template === "{}")
      )
    ) {
      ambiguities.push("Request payload structure is unclear");
    }

    // Check for duration ambiguity
    if (
      spec.duration?.value === 1 &&
      spec.duration?.unit === "minutes" &&
      !originalInput.toLowerCase().includes("minute")
    ) {
      ambiguities.push("Test duration was not specified, using default");
    }

    return ambiguities;
  }

  private static generateSuggestions(
    spec: LoadTestSpec,
    ambiguities: string[]
  ): string[] {
    const suggestions: string[] = [];

    ambiguities.forEach((ambiguity) => {
      switch (true) {
        case ambiguity.includes("URL"):
          suggestions.push("Please specify the complete API endpoint URL");
          break;
        case ambiguity.includes("Load parameters"):
          suggestions.push(
            "Specify either number of virtual users or requests per second"
          );
          break;
        case ambiguity.includes("payload"):
          suggestions.push(
            "Provide more details about the request payload structure"
          );
          break;
        case ambiguity.includes("duration"):
          suggestions.push(
            'Specify how long the test should run (e.g., "for 5 minutes")'
          );
          break;
      }
    });

    return suggestions;
  }

  private static fallbackParsing(
    response: string,
    originalInput: string
  ): ParsedResponse {
    // Create a basic spec using template methods when JSON parsing fails
    const spec: LoadTestSpec = {
      id: generateTestId({
        testType: PromptBuilder.inferTestType(originalInput),
        requests: [
          {
            method: PromptBuilder.inferHttpMethod(originalInput),
            url: this.extractUrlFromInput(originalInput) || "/api/endpoint",
          },
        ],
      }),
      name: this.generateTestName(originalInput),
      description: originalInput,
      testType: PromptBuilder.inferTestType(originalInput) as any,
      requests: [
        {
          method: PromptBuilder.inferHttpMethod(originalInput) as any,
          url: this.extractUrlFromInput(originalInput) || "/api/endpoint",
        },
      ],
      loadPattern: this.inferLoadPattern(originalInput),
      duration: PromptBuilder.extractDuration(originalInput),
    };

    return {
      spec,
      confidence: 0.3, // Low confidence for fallback parsing
      ambiguities: [
        "AI response could not be parsed as JSON",
        "Using fallback parsing with limited accuracy",
      ],
      suggestions: [
        "Try rephrasing your command more clearly",
        "Specify the API endpoint URL explicitly",
        "Include specific load parameters (users, duration, etc.)",
      ],
    };
  }

  private static convertSimpleFormatToLoadTestSpec(
    simpleFormat: any,
    originalInput: string
  ): LoadTestSpec {
    // Convert AI's simple format to LoadTestSpec format
    const request: RequestSpec = {
      method: simpleFormat.method || "GET",
      url: simpleFormat.url || "http://localhost:3000",
    };

    // Add headers if present
    if (simpleFormat.headers) {
      request.headers = simpleFormat.headers;
    }

    // Add body if present
    if (simpleFormat.body) {
      request.body = simpleFormat.body;
    }

    // Add payload if present
    if (simpleFormat.payload) {
      request.payload = simpleFormat.payload;
    }

    // Add variables if present (for file references with incrementing)
    if (simpleFormat.variables && Array.isArray(simpleFormat.variables)) {
      // If we have variables but no payload, create payload structure
      if (!request.payload && request.body) {
        request.payload = {
          template: request.body,
          variables: simpleFormat.variables,
        };
        delete request.body;
      }
    }

    const result: LoadTestSpec = {
      id: generateTestId({
        testType: "baseline",
        requests: [request],
      }),
      name: this.generateTestName(originalInput),
      description: originalInput,
      testType: "baseline" as const,
      requests: [request],
      loadPattern: {
        type: "constant",
        virtualUsers: simpleFormat.requestCount || 1,
      },
      duration: {
        value: 60,
        unit: "seconds",
      },
    };

    return result;
  }

  private static extractUrlFromInput(input: string): string | null {
    const urlPattern = /(https?:\/\/[^\s]+|\/[^\s]*)/;
    const match = input.match(urlPattern);
    return match ? match[0] : null;
  }

  // Validation methods
  private static validateRequiredFields(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!spec.id) {
      issues.push({
        type: "error",
        field: "id",
        message: "Test ID is required",
        severity: "critical",
        suggestion: "A unique test ID will be generated automatically",
      });
    }

    if (!spec.name || spec.name.trim() === "") {
      issues.push({
        type: "error",
        field: "name",
        message: "Test name is required",
        severity: "high",
        suggestion: "Provide a descriptive name for your load test",
      });
    }

    if (!spec.requests || spec.requests.length === 0) {
      issues.push({
        type: "error",
        field: "requests",
        message: "At least one request specification is required",
        severity: "critical",
        suggestion: "Specify the API endpoint and HTTP method you want to test",
      });
    }

    return issues;
  }

  private static validateUrlFormat(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    spec.requests?.forEach((request, index) => {
      if (!request.url) {
        issues.push({
          type: "error",
          field: `requests[${index}].url`,
          message: `Request ${index + 1}: URL is required`,
          severity: "critical",
          suggestion:
            "Provide the complete API endpoint URL (e.g., https://api.example.com/endpoint)",
        });
        return;
      }

      // Check URL format
      if (!this.isValidUrl(request.url)) {
        issues.push({
          type: "warning",
          field: `requests[${index}].url`,
          message: `Request ${index + 1}: URL format may be invalid`,
          severity: "medium",
          suggestion:
            "Ensure URL is complete with protocol (https://) or starts with /",
        });
      }

      // Check for placeholder URLs
      if (
        request.url.includes("example.com") ||
        request.url === "/api/endpoint"
      ) {
        issues.push({
          type: "warning",
          field: `requests[${index}].url`,
          message: `Request ${index + 1}: URL appears to be a placeholder`,
          severity: "high",
          suggestion: "Replace with your actual API endpoint URL",
        });
      }

      // Check for missing HTTP method
      if (!request.method) {
        issues.push({
          type: "error",
          field: `requests[${index}].method`,
          message: `Request ${index + 1}: HTTP method is required`,
          severity: "critical",
          suggestion: "Specify the HTTP method (GET, POST, PUT, DELETE, etc.)",
        });
      }
    });

    return issues;
  }

  private static validateLoadParameters(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!spec.loadPattern) {
      issues.push({
        type: "error",
        field: "loadPattern",
        message: "Load pattern is required",
        severity: "critical",
        suggestion:
          "Specify load parameters like virtual users or requests per second",
      });
      return issues;
    }

    const { loadPattern } = spec;

    // Check if either virtualUsers or requestsPerSecond is specified
    if (!loadPattern.virtualUsers && !loadPattern.requestsPerSecond) {
      issues.push({
        type: "error",
        field: "loadPattern",
        message:
          "Either virtual users or requests per second must be specified",
        severity: "critical",
        suggestion:
          'Add "virtualUsers" or "requestsPerSecond" to your load pattern',
      });
    }

    // Validate virtual users
    if (loadPattern.virtualUsers !== undefined) {
      if (loadPattern.virtualUsers <= 0) {
        issues.push({
          type: "error",
          field: "loadPattern.virtualUsers",
          message: "Virtual users must be greater than 0",
          severity: "high",
          suggestion:
            "Set a positive number of virtual users (e.g., 10, 50, 100)",
        });
      } else if (loadPattern.virtualUsers > 10000) {
        issues.push({
          type: "warning",
          field: "loadPattern.virtualUsers",
          message:
            "Very high number of virtual users may cause resource issues",
          severity: "medium",
          suggestion: "Consider starting with a smaller number and scaling up",
        });
      }
    }

    // Validate requests per second
    if (loadPattern.requestsPerSecond !== undefined) {
      if (loadPattern.requestsPerSecond <= 0) {
        issues.push({
          type: "error",
          field: "loadPattern.requestsPerSecond",
          message: "Requests per second must be greater than 0",
          severity: "high",
          suggestion: "Set a positive RPS value (e.g., 10, 50, 100)",
        });
      } else if (loadPattern.requestsPerSecond > 1000) {
        issues.push({
          type: "warning",
          field: "loadPattern.requestsPerSecond",
          message: "Very high RPS may overwhelm the target system",
          severity: "medium",
          suggestion:
            "Consider starting with a lower RPS and increasing gradually",
        });
      }
    }

    // Validate ramp-up parameters for ramp-up tests
    if (loadPattern.type === "ramp-up" && !loadPattern.rampUpTime) {
      issues.push({
        type: "warning",
        field: "loadPattern.rampUpTime",
        message: "Ramp-up time not specified for ramp-up test",
        severity: "medium",
        suggestion:
          'Specify how long the ramp-up should take (e.g., "2 minutes")',
      });
    }

    return issues;
  }

  private static validatePayloadStructure(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    spec.requests?.forEach((request, index) => {
      if (request.payload) {
        const payload = request.payload;

        // Check if template is valid JSON for JSON payloads
        if (
          request.headers?.["Content-Type"]?.includes("application/json") ||
          !request.headers?.["Content-Type"]
        ) {
          try {
            // Try to parse template with placeholder values
            const testTemplate = payload.template.replace(
              /\{\{(\w+)\}\}/g,
              '"test_value"'
            );
            JSON.parse(testTemplate);
          } catch (error) {
            issues.push({
              type: "error",
              field: `requests[${index}].payload.template`,
              message: `Request ${
                index + 1
              }: Payload template is not valid JSON`,
              severity: "high",
              suggestion:
                "Ensure payload template is valid JSON with {{variable}} placeholders",
            });
          }
        }

        // Check if variables are defined for template placeholders
        const templateVariables = this.extractTemplateVariables(
          payload.template
        );
        const definedVariables = payload.variables?.map((v) => v.name) || [];

        const missingVariables = templateVariables.filter(
          (v) => !definedVariables.includes(v)
        );
        if (missingVariables.length > 0) {
          issues.push({
            type: "warning",
            field: `requests[${index}].payload.variables`,
            message: `Request ${index + 1}: Variables ${missingVariables.join(
              ", "
            )} used in template but not defined`,
            severity: "medium",
            suggestion: "Define variable types for all template placeholders",
          });
        }

        // Check for unused variable definitions
        const unusedVariables = definedVariables.filter(
          (v) => !templateVariables.includes(v)
        );
        if (unusedVariables.length > 0) {
          issues.push({
            type: "suggestion",
            field: `requests[${index}].payload.variables`,
            message: `Request ${index + 1}: Variables ${unusedVariables.join(
              ", "
            )} defined but not used in template`,
            severity: "low",
            suggestion:
              "Remove unused variable definitions or add them to the template",
          });
        }
      }

      // Check if payload is expected but missing
      if (
        ["POST", "PUT", "PATCH"].includes(request.method) &&
        !request.payload
      ) {
        issues.push({
          type: "suggestion",
          field: `requests[${index}].payload`,
          message: `Request ${index + 1}: ${
            request.method
          } request typically includes a payload`,
          severity: "low",
          suggestion: "Consider adding a payload template for this request",
        });
      }
    });

    return issues;
  }

  private static validateComplexJsonStructure(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check each request for malformed JSON structures
    spec.requests.forEach((request, index) => {
      if (request.body && typeof request.body === "object") {
        // Check for invalid fields that AI might add
        if ("increment" in request.body) {
          issues.push({
            type: "error",
            field: `requests[${index}].body`,
            message:
              "Invalid 'increment' field found in JSON body - this field should not be present",
            suggestion: "Remove the 'increment' field from the JSON body",
            severity: "critical",
          });
        }

        // Check for malformed nested structures
        if (this.hasMalformedNestedStructure(request.body)) {
          issues.push({
            type: "error",
            field: `requests[${index}].body`,
            message: "Malformed nested JSON structure detected",
            suggestion:
              "Check for missing or extra brackets, quotes, or commas",
            severity: "critical",
          });
        }

        // Validate that required fields are present in complex structures
        if (request.body.payload && Array.isArray(request.body.payload)) {
          request.body.payload.forEach((item: any, itemIndex: number) => {
            if (item && typeof item === "object") {
              // Check for common required fields in payload items
              if (!item.externalId && !item.requestId) {
                issues.push({
                  type: "warning",
                  field: `requests[${index}].body.payload[${itemIndex}]`,
                  message: "Payload item missing common identifier fields",
                  suggestion:
                    "Consider adding externalId or requestId for better tracking",
                  severity: "medium",
                });
              }
            }
          });
        }
      }
    });

    return issues;
  }

  private static hasMalformedNestedStructure(obj: any): boolean {
    try {
      // Try to stringify and parse back to check for structural issues
      const stringified = JSON.stringify(obj);
      const reparsed = JSON.parse(stringified);

      // Check if the structure is consistent
      return JSON.stringify(reparsed) !== JSON.stringify(obj);
    } catch {
      return true; // If we can't stringify/parse, it's malformed
    }
  }

  private static validateDuration(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!spec.duration) {
      issues.push({
        type: "error",
        field: "duration",
        message: "Test duration is required",
        severity: "critical",
        suggestion:
          'Specify how long the test should run (e.g., "5 minutes", "30 seconds")',
      });
      return issues;
    }

    if (spec.duration.value <= 0) {
      issues.push({
        type: "error",
        field: "duration.value",
        message: "Test duration must be positive",
        severity: "high",
        suggestion: "Set a positive duration value",
      });
    }

    // Check for very short durations
    const durationInSeconds = this.convertToSeconds(spec.duration);
    if (durationInSeconds < 10) {
      issues.push({
        type: "warning",
        field: "duration",
        message: "Very short test duration may not provide meaningful results",
        severity: "medium",
        suggestion: "Consider running the test for at least 30 seconds",
      });
    }

    // Check for very long durations
    if (durationInSeconds > 3600) {
      // 1 hour
      issues.push({
        type: "warning",
        field: "duration",
        message: "Very long test duration may consume significant resources",
        severity: "medium",
        suggestion:
          "Consider starting with shorter tests and increasing duration gradually",
      });
    }

    return issues;
  }

  private static validateTestTypeConsistency(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if test type matches load pattern
    if (spec.testType === "spike" && spec.loadPattern?.type !== "spike") {
      issues.push({
        type: "warning",
        field: "testType",
        message: 'Test type "spike" should use spike load pattern',
        severity: "medium",
        suggestion: 'Change load pattern type to "spike" or adjust test type',
      });
    }

    if (spec.testType === "stress" && spec.loadPattern?.type !== "ramp-up") {
      issues.push({
        type: "suggestion",
        field: "testType",
        message: "Stress tests typically use ramp-up load pattern",
        severity: "low",
        suggestion: 'Consider using "ramp-up" load pattern for stress testing',
      });
    }

    return issues;
  }

  private static validateWorkflowIntegrity(
    spec: LoadTestSpec,
    context: ValidationContext
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (spec.workflow && spec.workflow.length > 0) {
      // Check for circular dependencies
      const stepIds = spec.workflow.map((step) => step.id);
      const duplicateIds = stepIds.filter(
        (id, index) => stepIds.indexOf(id) !== index
      );

      if (duplicateIds.length > 0) {
        issues.push({
          type: "error",
          field: "workflow",
          message: `Duplicate workflow step IDs: ${duplicateIds.join(", ")}`,
          severity: "high",
          suggestion: "Ensure all workflow step IDs are unique",
        });
      }

      // Validate data correlation references
      if (spec.dataCorrelation) {
        spec.dataCorrelation.forEach((rule, index) => {
          if (!stepIds.includes(rule.sourceStep)) {
            issues.push({
              type: "error",
              field: `dataCorrelation[${index}].sourceStep`,
              message: `Data correlation references non-existent step: ${rule.sourceStep}`,
              severity: "high",
              suggestion:
                "Ensure correlation rules reference valid workflow step IDs",
            });
          }

          if (!stepIds.includes(rule.targetStep)) {
            issues.push({
              type: "error",
              field: `dataCorrelation[${index}].targetStep`,
              message: `Data correlation references non-existent step: ${rule.targetStep}`,
              severity: "high",
              suggestion:
                "Ensure correlation rules reference valid workflow step IDs",
            });
          }
        });
      }
    }

    return issues;
  }

  private static generateActionableSuggestions(
    issues: ValidationIssue[],
    context: ValidationContext
  ): string[] {
    const suggestions: string[] = [];

    // Add suggestions from issues
    issues.forEach((issue) => {
      if (issue.suggestion && !suggestions.includes(issue.suggestion)) {
        suggestions.push(issue.suggestion);
      }
    });

    // Add context-based suggestions
    if (context.confidence < 0.5) {
      suggestions.push(
        "Try rephrasing your command with more specific details"
      );
    }

    if (context.ambiguities.length > 0) {
      suggestions.push("Provide more specific information to reduce ambiguity");
    }

    // Add general suggestions based on common patterns
    const input = context.originalInput.toLowerCase();
    if (!input.includes("http") && !input.includes("/")) {
      suggestions.push(
        "Include the complete API endpoint URL you want to test"
      );
    }

    if (!input.match(/\d+/)) {
      suggestions.push(
        "Specify numeric values for load parameters (users, requests, duration)"
      );
    }

    return suggestions;
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      // Check if it's a relative URL
      return url.startsWith("/") && url.length > 1;
    }
  }

  private static extractTemplateVariables(template: string): string[] {
    const variables: string[] = [];
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  private static convertToSeconds(duration: {
    value: number;
    unit: string;
  }): number {
    switch (duration.unit) {
      case "seconds":
        return duration.value;
      case "minutes":
        return duration.value * 60;
      case "hours":
        return duration.value * 3600;
      default:
        return duration.value;
    }
  }
}
