/**
 * Unit tests for SmartPromptBuilder
 * Tests dynamic prompt construction, example selection, and clarification generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DefaultSmartPromptBuilder } from "@/core/parser";
import { ParseContext } from "@/core/parser";

describe("DefaultSmartPromptBuilder", () => {
  let promptBuilder: DefaultSmartPromptBuilder;

  beforeEach(() => {
    promptBuilder = new DefaultSmartPromptBuilder();
  });

  describe("buildPrompt", () => {
    it("should build enhanced prompt with all components", () => {
      const context: ParseContext = {
        originalInput: "POST to /api/users with 50 users for 2 minutes",
        cleanedInput: "POST to /api/users with 50 users for 2 minutes",
        extractedComponents: {
          methods: ["POST"],
          urls: ["/api/users"],
          headers: [{}],
          bodies: [],
          counts: [50],
        },
        inferredFields: {
          testType: "baseline",
          duration: "2m",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const result = promptBuilder.buildPrompt(context);

      expect(result.systemPrompt).toContain(
        "StressMaster's enhanced AI assistant"
      );
      expect(result.systemPrompt).toContain(
        "Parse both structured data and natural language"
      );
      expect(result.contextualExamples).toBeInstanceOf(Array);
      expect(result.clarifications).toBeInstanceOf(Array);
      expect(result.parsingInstructions).toBeInstanceOf(Array);
      expect(result.fallbackInstructions).toBeInstanceOf(Array);
    });

    it("should include format-specific instructions for curl commands", () => {
      const context: ParseContext = {
        originalInput: "curl -X POST https://api.example.com/users",
        cleanedInput: "curl -X POST https://api.example.com/users",
        extractedComponents: {
          methods: ["POST"],
          urls: ["https://api.example.com/users"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.9,
      };

      const result = promptBuilder.buildPrompt(context);

      expect(result.systemPrompt).toContain("curl command");
      expect(result.systemPrompt).toContain("Extract all parameters");
    });

    it("should add low confidence instructions for ambiguous input", () => {
      const context: ParseContext = {
        originalInput: "test something",
        cleanedInput: "test something",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [
          {
            field: "method",
            possibleValues: ["GET", "POST"],
            reason: "No method specified",
          },
        ],
        confidence: 0.3,
      };

      const result = promptBuilder.buildPrompt(context);

      expect(result.systemPrompt).toContain("low confidence");
      expect(result.systemPrompt).toContain("conservative assumptions");
      expect(result.systemPrompt).toContain("Ambiguity handling");
    });
  });

  describe("selectRelevantExamples", () => {
    it("should select examples based on POST method", () => {
      const context: ParseContext = {
        originalInput: "POST to /api/users",
        cleanedInput: "POST to /api/users",
        extractedComponents: {
          methods: ["POST"],
          urls: ["/api/users"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const examples = promptBuilder.selectRelevantExamples(context);

      expect(examples.length).toBeGreaterThan(0);
      expect(
        examples.some((ex) => ex.output.requests[0]?.method === "POST")
      ).toBe(true);
    });

    it("should select examples based on test type", () => {
      const context: ParseContext = {
        originalInput: "spike test with 1000 users",
        cleanedInput: "spike test with 1000 users",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [1000],
        },
        inferredFields: {
          testType: "spike",
          duration: "30s",
          loadPattern: "spike",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const examples = promptBuilder.selectRelevantExamples(context);

      expect(examples.length).toBeGreaterThan(0);
      expect(examples.some((ex) => ex.output.testType === "spike")).toBe(true);
    });

    it("should limit number of examples returned", () => {
      const context: ParseContext = {
        originalInput: "POST spike test with 1000 users to /api/test",
        cleanedInput: "POST spike test with 1000 users to /api/test",
        extractedComponents: {
          methods: ["POST"],
          urls: ["/api/test"],
          headers: [{}],
          bodies: [],
          counts: [1000],
        },
        inferredFields: {
          testType: "spike",
          duration: "30s",
          loadPattern: "spike",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const examples = promptBuilder.selectRelevantExamples(context);

      expect(examples.length).toBeLessThanOrEqual(5);
    });

    it("should return empty array when no relevant examples found", () => {
      const context: ParseContext = {
        originalInput: "unknown test format",
        cleanedInput: "unknown test format",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "unknown" as any,
          duration: "30s",
          loadPattern: "unknown" as any,
        },
        ambiguities: [],
        confidence: 0.2,
      };

      const examples = promptBuilder.selectRelevantExamples(context);

      expect(examples).toBeInstanceOf(Array);
      // Should still return some examples even if not perfectly relevant
    });
  });

  describe("addClarifications", () => {
    it("should generate clarifications for method ambiguity", () => {
      const context: ParseContext = {
        originalInput: "test /api/users",
        cleanedInput: "test /api/users",
        extractedComponents: {
          methods: [],
          urls: ["/api/users"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [
          {
            field: "method",
            possibleValues: ["GET", "POST"],
            reason: "No HTTP method specified",
          },
        ],
        confidence: 0.6,
      };

      const clarifications = promptBuilder.addClarifications(context);

      expect(clarifications.length).toBeGreaterThan(0);
      expect(clarifications.some((c) => c.includes("HTTP method"))).toBe(true);
      expect(clarifications.some((c) => c.includes("default"))).toBe(true);
    });

    it("should generate clarifications for URL ambiguity", () => {
      const context: ParseContext = {
        originalInput: "POST request with data",
        cleanedInput: "POST request with data",
        extractedComponents: {
          methods: ["POST"],
          urls: [],
          headers: [{}],
          bodies: ['{"test": "data"}'],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [
          {
            field: "url",
            possibleValues: [
              "http://localhost:8080",
              "https://api.example.com",
            ],
            reason: "No URL specified, need target endpoint for load test",
          },
        ],
        confidence: 0.5,
      };

      const clarifications = promptBuilder.addClarifications(context);

      expect(clarifications.some((c) => c.includes("URL"))).toBe(true);
      expect(
        clarifications.some(
          (c) => c.includes("incomplete") || c.includes("missing")
        )
      ).toBe(true);
    });

    it("should generate clarifications for user count ambiguity", () => {
      const context: ParseContext = {
        originalInput: "GET /api/users for testing",
        cleanedInput: "GET /api/users for testing",
        extractedComponents: {
          methods: ["GET"],
          urls: ["/api/users"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [
          {
            field: "userCount",
            possibleValues: ["1", "10", "100"],
            reason: "No user count specified",
          },
        ],
        confidence: 0.7,
      };

      const clarifications = promptBuilder.addClarifications(context);

      expect(clarifications.some((c) => c.includes("User count"))).toBe(true);
      expect(clarifications.some((c) => c.includes("default"))).toBe(true);
    });

    it("should generate clarifications for content-type ambiguity", () => {
      const context: ParseContext = {
        originalInput: "POST /api/users with JSON data",
        cleanedInput: "POST /api/users with JSON data",
        extractedComponents: {
          methods: ["POST"],
          urls: ["/api/users"],
          headers: [{}],
          bodies: ['{"name": "test"}'],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [
          {
            field: "content-type",
            possibleValues: [
              "application/json",
              "application/x-www-form-urlencoded",
            ],
            reason: "Request body found but no Content-Type header specified",
          },
        ],
        confidence: 0.8,
      };

      const clarifications = promptBuilder.addClarifications(context);

      expect(clarifications.some((c) => c.includes("Content-Type"))).toBe(true);
      expect(clarifications.some((c) => c.includes("missing"))).toBe(true);
    });

    it("should add format-specific clarifications for curl commands", () => {
      const context: ParseContext = {
        originalInput: "curl -X POST https://api.example.com/users",
        cleanedInput: "curl -X POST https://api.example.com/users",
        extractedComponents: {
          methods: ["POST"],
          urls: ["https://api.example.com/users"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.9,
      };

      const clarifications = promptBuilder.addClarifications(context);

      expect(clarifications.some((c) => c.includes("curl command"))).toBe(true);
      expect(
        clarifications.some((c) => c.includes("extracting all flags"))
      ).toBe(true);
    });

    it("should add format-specific clarifications for concatenated requests", () => {
      const context: ParseContext = {
        originalInput: "GET /api/users POST /api/orders",
        cleanedInput: "GET /api/users POST /api/orders",
        extractedComponents: {
          methods: ["GET", "POST"],
          urls: ["/api/users", "/api/orders"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const clarifications = promptBuilder.addClarifications(context);

      expect(clarifications.some((c) => c.includes("Multiple requests"))).toBe(
        true
      );
      expect(
        clarifications.some((c) => c.includes("separate test scenarios"))
      ).toBe(true);
    });

    it("should add low confidence clarification", () => {
      const context: ParseContext = {
        originalInput: "unclear test request",
        cleanedInput: "unclear test request",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.4,
      };

      const clarifications = promptBuilder.addClarifications(context);

      expect(
        clarifications.some(
          (c) => c.includes("ambiguous") || c.includes("incomplete")
        )
      ).toBe(true);
      expect(
        clarifications.some((c) => c.includes("reasonable assumptions"))
      ).toBe(true);
    });

    it("should return empty array when no clarifications needed", () => {
      const context: ParseContext = {
        originalInput: "POST /api/users with 50 users for 2 minutes",
        cleanedInput: "POST /api/users with 50 users for 2 minutes",
        extractedComponents: {
          methods: ["POST"],
          urls: ["/api/users"],
          headers: [{ "Content-Type": "application/json" }],
          bodies: ['{"name": "test"}'],
          counts: [50],
        },
        inferredFields: {
          testType: "baseline",
          duration: "2m",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.9,
      };

      const clarifications = promptBuilder.addClarifications(context);

      // Should still have format-specific clarifications
      expect(clarifications).toBeInstanceOf(Array);
    });
  });

  describe("example relevance scoring", () => {
    it("should score examples higher when methods match", () => {
      const context: ParseContext = {
        originalInput: "POST to /api/users",
        cleanedInput: "POST to /api/users",
        extractedComponents: {
          methods: ["POST"],
          urls: ["/api/users"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const examples = promptBuilder.selectRelevantExamples(context);
      const postExamples = examples.filter(
        (ex) => ex.output.requests[0]?.method === "POST"
      );
      const getExamples = examples.filter(
        (ex) => ex.output.requests[0]?.method === "GET"
      );

      if (postExamples.length > 0 && getExamples.length > 0) {
        // POST examples should generally appear first due to higher relevance
        const firstPostIndex = examples.findIndex(
          (ex) => ex.output.requests[0]?.method === "POST"
        );
        const firstGetIndex = examples.findIndex(
          (ex) => ex.output.requests[0]?.method === "GET"
        );

        if (firstPostIndex !== -1 && firstGetIndex !== -1) {
          expect(firstPostIndex).toBeLessThan(firstGetIndex);
        }
      }
    });

    it("should score examples higher when test types match", () => {
      const context: ParseContext = {
        originalInput: "spike test with high load",
        cleanedInput: "spike test with high load",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [1000],
        },
        inferredFields: {
          testType: "spike",
          duration: "30s",
          loadPattern: "spike",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const examples = promptBuilder.selectRelevantExamples(context);
      const spikeExamples = examples.filter(
        (ex) => ex.output.testType === "spike"
      );

      expect(spikeExamples.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty context gracefully", () => {
      const context: ParseContext = {
        originalInput: "",
        cleanedInput: "",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "",
          duration: "",
          loadPattern: "",
        },
        ambiguities: [],
        confidence: 0,
      };

      const result = promptBuilder.buildPrompt(context);

      expect(result.systemPrompt).toBeTruthy();
      expect(result.contextualExamples).toBeInstanceOf(Array);
      expect(result.clarifications).toBeInstanceOf(Array);
      expect(result.parsingInstructions).toBeInstanceOf(Array);
      expect(result.fallbackInstructions).toBeInstanceOf(Array);
    });

    it("should handle context with many ambiguities", () => {
      const context: ParseContext = {
        originalInput: "test something unclear",
        cleanedInput: "test something unclear",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [
          {
            field: "method",
            possibleValues: ["GET", "POST"],
            reason: "No method",
          },
          {
            field: "url",
            possibleValues: ["localhost", "example.com"],
            reason: "No URL",
          },
          {
            field: "userCount",
            possibleValues: ["1", "10"],
            reason: "No count",
          },
          {
            field: "duration",
            possibleValues: ["30s", "1m"],
            reason: "No duration",
          },
        ],
        confidence: 0.1,
      };

      const result = promptBuilder.buildPrompt(context);

      expect(result.clarifications.length).toBeGreaterThan(3);
      expect(
        result.fallbackInstructions.some((i) => i.includes("High ambiguity"))
      ).toBe(true);
    });
  });
});
