/**
 * Fallback Parser - Core Implementation
 *
 * Simplified fallback parser that uses rule-based parsing when AI parsing fails.
 */

import { LoadTestSpec, RequestSpec, LoadPattern } from "../../../types";
import { FallbackParseResult } from "../types";
import {
  InputNormalizer,
  JsonRecovery,
  SyntaxFlexibilityEngine,
  NaturalJsonBuilder,
} from "../../../features/parsing";
import { IntelligentErrorRecovery } from "../../../features/execution";
import { PatternLearner } from "../../../features/parsing/pattern-learner";
import { ClarificationEngine } from "../../../features/parsing/clarification-engine";
import { AdvancedErrorRecovery } from "../../../features/parsing/advanced-error-recovery";
import { MediaProcessor } from "../../../features/common/media-utils";
import {
  FALLBACK_PARSING_RULES,
  PARSING_PATTERNS,
  KEYWORD_MAPPINGS,
} from "./patterns";
import {
  normalizeTimeUnit,
  normalizeMethod,
  normalizeUrl,
  extractVariablesFromPayload,
  detectIncrementIntent,
  shouldIncrementField,
} from "./utils";
import chalk from "chalk";

export class FallbackParser {
  private patternLearner: PatternLearner;
  private clarificationEngine: ClarificationEngine;
  private advancedErrorRecovery: AdvancedErrorRecovery;
  private rules = FALLBACK_PARSING_RULES;

  constructor() {
    this.patternLearner = PatternLearner.getInstance();
    this.clarificationEngine = ClarificationEngine.getInstance();
    this.advancedErrorRecovery = AdvancedErrorRecovery.getInstance();
  }

  async parseCommand(input: string): Promise<FallbackParseResult> {
    try {
      // Preprocess input - temporarily simplified
      // const syntaxProcessed = SyntaxFlexibilityEngine.processInput(input);
      // const normalized = InputNormalizer.normalizeInput(syntaxProcessed.normalized);

      // Use raw input for now
      const rawInput = input;

      // Extract basic information
      const urls = this.extractUrls(rawInput);
      const methods = this.extractMethods(rawInput);
      const headers = this.extractHeaders(rawInput);
      const bodies = this.extractBodies(rawInput);
      const loadInfo = this.extractLoadInfo(input);
      const incrementInfo = detectIncrementIntent(input);

      // Extract media files
      const media = MediaProcessor.parseMediaReferences(rawInput);

      // Extract workflow information
      const workflowInfo = this.extractWorkflowInfo(rawInput);

      // Extract OpenAPI information
      const openapiInfo = this.extractOpenAPIInfo(rawInput);

      // Build LoadTestSpec
      const spec: LoadTestSpec = {
        id: `fallback_${Date.now()}`,
        name: "Fallback Parsed Test",
        description: `Parsed from: ${input.substring(0, 100)}...`,
        testType: workflowInfo.isWorkflow
          ? "workflow"
          : ((loadInfo.testType || "baseline") as any),
        requests: [],
        loadPattern: loadInfo.loadPattern,
        duration: {
          value: loadInfo.duration.value,
          unit: loadInfo.duration.unit as "seconds" | "minutes" | "hours",
        },
      };

      // Handle workflow tests
      if (workflowInfo.isWorkflow) {
        spec.workflow = [
          {
            type: workflowInfo.type,
            steps: workflowInfo.steps.map((step) => {
              // Extract media for this specific step
              const stepMedia = this.extractStepMedia(
                input,
                step.method,
                step.url
              );

              return {
                ...step,
                requestCount: 1,
                headers: headers,
                ...(stepMedia && { media: stepMedia }),
                ...(step.body && { body: step.body }),
              };
            }),
          },
        ];
      } else {
        // Create request specification for single requests
        if (urls.length > 0) {
          const request: RequestSpec = {
            method: (methods[0] || "POST") as any,
            url: urls[0],
            headers: headers,
          };

          // Handle media files if present
          if (media) {
            request.media = media;
          }

          // Handle OpenAPI files if present
          if (openapiInfo.hasOpenAPI) {
            request.payload = {
              template: openapiInfo.filePath,
              variables: [],
            };
          }

          // Handle body/payload based on incrementing requirements
          if (bodies[0] && !media && !openapiInfo.hasOpenAPI) {
            // Don't set body if we have media files or OpenAPI
            if (
              incrementInfo.shouldIncrement &&
              incrementInfo.fields.length > 0
            ) {
              // Create payload structure with variables for incrementing
              let template = this.normalizeJsonQuotes(bodies[0]);
              const variables = incrementInfo.fields.map((field) => {
                // Extract the current value from the JSON body (including nested fields)
                let baseValue = "1";
                try {
                  const normalizedTemplate = this.normalizeJsonQuotes(template);
                  const bodyObj = JSON.parse(normalizedTemplate);

                  // Search for the field in the entire JSON structure (including nested objects)
                  const fieldValue = this.findNestedFieldValue(bodyObj, field);

                  if (fieldValue !== undefined) {
                    baseValue = fieldValue;

                    // Replace the literal value with template variable in the template
                    // Handle both "field": "value" and "field":"value" patterns
                    const patterns = [
                      `"${field}": "${baseValue}"`, // with space
                      `"${field}":"${baseValue}"`, // without space
                    ];

                    const newPattern = `"${field}":"{{${field}}}"`;

                    let newTemplate = template;
                    for (const pattern of patterns) {
                      if (template.includes(pattern)) {
                        newTemplate = template.replace(pattern, newPattern);
                        break;
                      }
                    }

                    template = newTemplate;
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

              request.payload = {
                template: template,
                variables: variables,
              };
            } else {
              // Simple body without incrementing
              // Set the body directly - it's already loaded from file or extracted from command
              request.body = this.normalizeJsonQuotes(bodies[0]);
            }
          }

          spec.requests.push(request);
        }
      }

      return {
        spec,
        confidence: 0.7,
        method: "fallback",
        warnings: ["Used fallback parsing - results may be less accurate"],
      };
    } catch (error) {
      return {
        spec: this.createDefaultSpec(),
        confidence: 0.3,
        method: "fallback",
        warnings: [`Fallback parsing failed: ${error}`],
      };
    }
  }

  private extractUrls(input: string): string[] {
    const urls: string[] = [];

    for (const pattern of this.rules.urlPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        urls.push(...matches.map((url) => normalizeUrl(url)));
      }
    }

    return [...new Set(urls)]; // Remove duplicates
  }

  private extractMethods(input: string): string[] {
    const methods: string[] = [];

    for (const pattern of this.rules.methodPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        methods.push(...matches.map((method) => normalizeMethod(method)));
      }
    }

    return [...new Set(methods)];
  }

  private extractHeaders(input: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // First try to extract x-api-key specifically - improved pattern
    const apiKeyMatch = input.match(/x-api-key\s+([a-zA-Z0-9-]+)/i);
    if (apiKeyMatch) {
      headers["x-api-key"] = this.normalizeJsonQuotes(apiKeyMatch[1]);
    }

    // Add Content-Type for POST requests with JSON body
    if (input.toLowerCase().includes("post") && input.includes("{")) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  private extractBodies(input: string): string[] {
    const bodies: string[] = [];

    // Check for file references - both @filename.json and natural language patterns
    const fileMatch = this.extractFileReference(input);
    if (fileMatch) {
      const filename = fileMatch;
      try {
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(process.cwd(), filename);

        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, "utf8");
          console.log(`📁 Loaded JSON from file: ${filename}`);
          bodies.push(fileContent);
          return bodies;
        } else {
          console.warn(`⚠️ File not found: ${filename}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error reading file ${filename}:`, error);
      }
    }

    // Try to find JSON bodies with more specific patterns first
    for (const pattern of this.rules.bodyPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        // Filter out matches that are too short or don't look like JSON
        const validMatches = matches.filter(
          (match) =>
            match.length > 10 &&
            match.includes("{") &&
            match.includes("}") &&
            !match.includes("send") &&
            !match.includes("requests")
        );
        // Normalize smart quotes in each match
        const normalizedMatches = validMatches.map((match) =>
          this.normalizeJsonQuotes(match)
        );
        bodies.push(...normalizedMatches);
      }
    }

    // If no bodies found, try a more aggressive approach
    if (bodies.length === 0) {
      const jsonMatch = input.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const normalizedJson = this.normalizeJsonQuotes(jsonMatch[0]);
        bodies.push(normalizedJson);
      }
    }

    // If still no bodies found, try to construct from natural language description
    if (bodies.length === 0) {
      const bodyDescription = this.extractBodyFromNaturalLanguage(input);
      if (bodyDescription) {
        const normalizedDescription = this.normalizeJsonQuotes(bodyDescription);
        bodies.push(normalizedDescription);
      }
    }

    return bodies;
  }

  /**
   * Extract file references from natural language input
   * Supports both @filename.json and natural language patterns like "from filename.json"
   */
  private extractFileReference(input: string): string | null {
    // First check for @filename.json pattern
    const atPattern = input.match(/@([a-zA-Z0-9._-]+\.json)/);
    if (atPattern) {
      return atPattern[1];
    }

    // Check for natural language patterns
    const naturalPatterns = [
      /(?:from|in|using|with|load|read)\s+([a-zA-Z0-9._-]+\.json)/gi,
      /(?:body|payload|data|json)\s+(?:from|in|using|with)\s+([a-zA-Z0-9._-]+\.json)/gi,
      /(?:JSON\s+)?body\s+from\s+([a-zA-Z0-9._-]+\.json)/gi,
    ];

    for (const pattern of naturalPatterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private normalizeJsonQuotes(jsonString: string): string {
    // First normalize the JSON string itself
    let normalized = jsonString
      .replace(/["""]/g, '"') // Handle all types of smart quotes
      .replace(/[''']/g, "'") // Handle all types of smart apostrophes
      .replace(/…/g, "...") // Handle ellipsis
      .replace(/–/g, "-") // Handle en dash
      .replace(/—/g, "-") // Handle em dash
      .trim();

    // Try to parse and recursively normalize all string values
    try {
      const parsed = JSON.parse(normalized);
      const normalizedParsed = this.normalizeObjectValues(parsed);
      return JSON.stringify(normalizedParsed);
    } catch (error) {
      // If parsing fails, return the normalized string as is
      return normalized;
    }
  }

  private normalizeObjectValues(obj: any): any {
    if (typeof obj === "string") {
      return this.normalizeStringValue(obj);
    } else if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeObjectValues(item));
    } else if (obj !== null && typeof obj === "object") {
      const normalized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        normalized[key] = this.normalizeObjectValues(value);
      }
      return normalized;
    }
    return obj;
  }

  private normalizeStringValue(str: string): string {
    return str
      .replace(/["""]/g, '"') // Handle all types of smart quotes
      .replace(/[''']/g, "'") // Handle all types of smart apostrophes
      .replace(/…/g, "...") // Handle ellipsis
      .replace(/–/g, "-") // Handle en dash
      .replace(/—/g, "-") // Handle em dash
      .replace(/[\u2018\u2019]/g, "'") // Additional smart apostrophes
      .replace(/[\u201C\u201D]/g, '"') // Additional smart quotes
      .replace(/[\u201A\u201B]/g, '"') // Low-9 and low-9 reversed quotes
      .replace(/[\u201E\u201F]/g, '"') // Double low-9 and low-9 reversed quotes
      .replace(/[\u2039\u203A]/g, '"') // Single left-pointing and right-pointing angle quotes
      .replace(/[\u00AB\u00BB]/g, '"') // Left-pointing and right-pointing double angle quotes
      .trim();
  }

  private extractBodyFromNaturalLanguage(input: string): string | null {
    // Look for natural language body descriptions
    const bodyKeywords = [
      /JSON body containing (.+?)(?=\s+and\s+increment|\s+increment|$)/i,
      /body containing (.+?)(?=\s+and\s+increment|\s+increment|$)/i,
      /with body (.+?)(?=\s+and\s+increment|\s+increment|$)/i,
    ];

    for (const pattern of bodyKeywords) {
      const match = input.match(pattern);
      if (match) {
        const description = match[1].trim();
        const json = this.constructJsonFromDescription(description);

        // Check if incrementing is requested
        const hasIncrementKeyword = /increment\s+(\w+)/i.test(input);
        if (hasIncrementKeyword) {
          // Return the JSON as a string that will be processed by the main parser
          // The main parser will detect this and convert it to payload structure
          return json;
        } else {
          return json;
        }
      }
    }

    return null;
  }

  private constructJsonFromDescription(description: string): string {
    const json: any = {};

    // Extract requestId
    const requestIdMatch = description.match(/requestId\s+([a-zA-Z0-9-_]+)/i);
    if (requestIdMatch) {
      json.requestId = this.normalizeStringValue(requestIdMatch[1]);
    }

    // Extract type
    const typeMatch = description.match(/type\s+([a-zA-Z0-9-_]+)/i);
    if (typeMatch) {
      json.type = this.normalizeStringValue(typeMatch[1]);
    }

    // Extract payload array
    if (description.includes("payload as array")) {
      const externalIdMatch = description.match(
        /externalId\s+([a-zA-Z0-9-_#]+)/i
      );
      if (externalIdMatch) {
        json.payload = [
          { externalId: this.normalizeStringValue(externalIdMatch[1]) },
        ];
      }
    }

    // Extract other common fields
    const orderIdMatch = description.match(/order_id\s+([a-zA-Z0-9-_]+)/i);
    if (orderIdMatch) {
      json.order_id = this.normalizeStringValue(orderIdMatch[1]);
    }

    const emailMatch = description.match(
      /customer_email\s+([a-zA-Z0-9@._-]+)/i
    );
    if (emailMatch) {
      json.customer_email = this.normalizeStringValue(emailMatch[1]);
    }

    return JSON.stringify(json);
  }

  private findNestedFieldValue(obj: any, fieldName: string): any {
    // Search recursively through the object for the field
    if (typeof obj !== "object" || obj === null) {
      return undefined;
    }

    // Check if this object has the field
    if (obj.hasOwnProperty(fieldName)) {
      return obj[fieldName];
    }

    // Search through all properties recursively
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        // If it's an object (but not null), search recursively
        if (typeof value === "object" && value !== null) {
          const found = this.findNestedFieldValue(value, fieldName);
          if (found !== undefined) {
            return found;
          }
        }
      }
    }

    return undefined;
  }

  private extractLoadInfo(input: string): {
    loadPattern: LoadPattern;
    duration: { value: number; unit: string };
    testType?: string;
  } {
    // Extract test type
    let testType = "baseline";
    for (const [type, keywords] of Object.entries(KEYWORD_MAPPINGS.testTypes)) {
      if (keywords.some((keyword) => input.toLowerCase().includes(keyword))) {
        testType = type;
        break;
      }
    }

    // Extract request count with multiple patterns
    let requestCount = 1;

    // Pattern 1: "send X requests"
    const sendPattern = input.match(
      /send\s+(\d+)\s+(?:POST|GET|PUT|DELETE|PATCH)\s+requests?/i
    );
    if (sendPattern) {
      requestCount = parseInt(sendPattern[1]);
    }

    // Pattern 2: "X requests" (standalone)
    const standalonePattern = input.match(/(\d+)\s+requests?/i);
    if (standalonePattern && !sendPattern) {
      requestCount = parseInt(standalonePattern[1]);
    }

    // Pattern 3: "spike test with X requests"
    const spikePattern = input.match(
      /spike\s+test\s+(?:with\s+)?(\d+)\s+requests?/i
    );
    if (spikePattern) {
      requestCount = parseInt(spikePattern[1]);
    }

    // Pattern 4: "X requests to"
    const toPattern = input.match(/(\d+)\s+requests?\s+to/i);
    if (toPattern && !sendPattern && !standalonePattern && !spikePattern) {
      requestCount = parseInt(toPattern[1]);
    }

    // Extract load pattern
    let loadPattern: LoadPattern = {
      type: "constant",
      virtualUsers: requestCount,
    };

    // Extract virtual users (if different from request count)
    const userMatch = input.match(/(\d+)\s*(users?|concurrent|parallel)/i);
    if (userMatch) {
      loadPattern.virtualUsers = parseInt(userMatch[1]);
    }

    // Extract duration - handle "over X seconds" pattern
    const durationMatch = input.match(
      /(?:over\s+)?(\d+)\s*(seconds?|minutes?|hours?|s|m|h)/i
    );
    const duration = durationMatch
      ? {
          value: parseInt(durationMatch[1]),
          unit: normalizeTimeUnit(durationMatch[2]),
        }
      : { value: 60, unit: "s" };

    return { testType, loadPattern, duration };
  }

  private extractWorkflowInfo(input: string): {
    isWorkflow: boolean;
    type: "sequential" | "parallel";
    steps: Array<{
      method: string;
      url: string;
      media?: any;
      body?: any;
    }>;
  } {
    const workflowPatterns = this.rules.workflowPatterns;
    let isWorkflow = false;
    let type: "sequential" | "parallel" = "sequential";
    let steps: Array<{ method: string; url: string; media?: any; body?: any }> =
      [];

    // Check for explicit workflow keywords first
    const hasWorkflowKeywords =
      /(?:first|then|next|finally|start|begin|parallel|simultaneously|and\s+(?:then\s+)?(?:GET|POST|PUT|DELETE|PATCH))/i.test(
        input
      );

    if (!hasWorkflowKeywords) {
      return { isWorkflow: false, type: "sequential", steps: [] };
    }

    // Check for workflow patterns
    for (const pattern of workflowPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        isWorkflow = true;

        // Determine workflow type based on pattern
        if (
          pattern.source.includes("parallel") ||
          pattern.source.includes("and")
        ) {
          type = "parallel";
        } else {
          type = "sequential";
        }

        // Extract steps more carefully
        const methodMatches = input.match(/\b(GET|POST|PUT|DELETE|PATCH)\b/gi);
        const urlMatches = input.match(/https?:\/\/[^\s,;"\]]+/gi);

        if (methodMatches && urlMatches && methodMatches.length >= 2) {
          // Only treat as workflow if we have at least 2 steps
          steps = methodMatches
            .map((method, index) => {
              const url = urlMatches[index] || "";
              if (!url) return null; // Skip steps without URLs

              // Extract step-specific media and body
              const stepMedia = this.extractStepMedia(input, method, url);
              const stepBody = this.extractStepBody(input, method, url);

              return {
                method: method.toUpperCase(),
                url: url,
                media: stepMedia,
                body: stepBody,
              };
            })
            .filter((step) => step !== null) as Array<{
            method: string;
            url: string;
            media?: any;
            body?: any;
          }>;

          // Only treat as workflow if we have valid steps
          if (steps.length < 2) {
            isWorkflow = false;
            steps = [];
          }
        }
        break;
      }
    }

    return { isWorkflow, type, steps };
  }

  private extractOpenAPIInfo(input: string): {
    hasOpenAPI: boolean;
    filePath: string;
  } {
    const openapiPatterns = this.rules.openapiPatterns;
    let hasOpenAPI = false;
    let filePath = "";

    // Check for OpenAPI file patterns
    for (const pattern of openapiPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        hasOpenAPI = true;
        filePath = matches[1] || matches[0];
        break;
      }
    }

    return { hasOpenAPI, filePath };
  }

  private extractStepMedia(input: string, method: string, url: string): any {
    // Extract media files that are associated with this specific step
    // Look for media references near this method/url combination
    const stepPattern = new RegExp(
      `${method}\\s+${url.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}[^;]*?(?:with|and)\\s+([^;]+)`,
      "i"
    );
    const match = input.match(stepPattern);

    if (match) {
      const stepContext = match[1];
      return MediaProcessor.parseMediaReferences(stepContext);
    }

    // Fallback: check if there's media in the entire input
    return MediaProcessor.parseMediaReferences(input);
  }

  private extractStepBody(input: string, method: string, url: string): any {
    // Extract body from the entire input if it's a single request
    // This is a simplified approach; a more robust solution would involve
    // finding the body within the context of the method and URL.
    // For now, we'll try to find a body that matches the method and URL.
    // This is a placeholder and needs more sophisticated logic.
    // For now, we'll return undefined, meaning no specific body for this step.
    // A more accurate approach would involve finding the body *within* the
    // context of the method and URL, or if the body is a global one.
    // For example, if the body is "body: { ... }" or "payload: { ... }"
    // and it's not explicitly tied to a step, we might return it.
    // For now, we'll return undefined.
    return undefined;
  }

  private generateSuggestions(spec: LoadTestSpec, input: string): string[] {
    const suggestions: string[] = [];

    if (!spec.requests[0]?.url) {
      suggestions.push("Add a target URL to your command");
    }

    if (!spec.requests[0]?.payload) {
      suggestions.push("Consider adding a request body if needed");
    }

    if (spec.loadPattern.virtualUsers === 1) {
      suggestions.push("Specify number of virtual users for load testing");
    }

    return suggestions;
  }

  private createDefaultSpec(): LoadTestSpec {
    return {
      id: `fallback_default_${Date.now()}`,
      name: "Default Fallback Test",
      description: "Created when parsing failed",
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
