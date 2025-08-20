/**
 * Unit tests for context enhancement engine
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DefaultContextEnhancer,
  ParseContext,
  Ambiguity,
} from "../../../src/core/parser/utils";
import { StructuredData, ParsingHint } from "../../../src/core/parser/utils";

describe("DefaultContextEnhancer", () => {
  let enhancer: DefaultContextEnhancer;

  beforeEach(() => {
    enhancer = new DefaultContextEnhancer();
  });

  describe("buildContext", () => {
    it("should build basic context from structured data and hints", () => {
      const input =
        "Test POST request to https://api.example.com with 10 users";
      const structuredData: StructuredData = {
        jsonBlocks: ['{"key": "value"}'],
        urls: ["https://api.example.com"],
        headers: { "Content-Type": "application/json" },
        methods: ["POST"],
        keyValuePairs: { users: "10" },
      };
      const hints: ParsingHint[] = [
        {
          type: "method",
          value: "POST",
          confidence: 0.9,
          position: { start: 5, end: 9 },
        },
        {
          type: "count",
          value: "10",
          confidence: 0.8,
          position: { start: 45, end: 47 },
        },
      ];

      const context = enhancer.buildContext(input, structuredData, hints);

      expect(context.originalInput).toBe(input);
      expect(context.cleanedInput).toBe(
        "Test POST request to https://api.example.com with 10 users"
      );
      expect(context.extractedComponents.methods).toEqual(["POST"]);
      expect(context.extractedComponents.urls).toEqual([
        "https://api.example.com",
      ]);
      expect(context.extractedComponents.counts).toEqual([10]);
      expect(context.extractedComponents.bodies).toEqual(['{"key": "value"}']);
      expect(context.confidence).toBeGreaterThan(0.3);
    });

    it("should handle empty structured data", () => {
      const input = "Simple load test request";
      const structuredData: StructuredData = {
        jsonBlocks: [],
        urls: [],
        headers: {},
        methods: [],
        keyValuePairs: {},
      };
      const hints: ParsingHint[] = [];

      const context = enhancer.buildContext(input, structuredData, hints);

      expect(context.extractedComponents.methods).toEqual([]);
      expect(context.extractedComponents.urls).toEqual([]);
      expect(context.extractedComponents.counts).toEqual([]);
      expect(context.confidence).toBe(0.3); // Base confidence
    });

    it("should remove duplicates from extracted components", () => {
      const input = "POST POST request";
      const structuredData: StructuredData = {
        jsonBlocks: [],
        urls: ["https://api.example.com"],
        headers: {},
        methods: ["POST"],
        keyValuePairs: {},
      };
      const hints: ParsingHint[] = [
        {
          type: "method",
          value: "POST",
          confidence: 0.9,
          position: { start: 0, end: 4 },
        },
        {
          type: "url",
          value: "https://api.example.com",
          confidence: 0.95,
          position: { start: 20, end: 43 },
        },
      ];

      const context = enhancer.buildContext(input, structuredData, hints);

      expect(context.extractedComponents.methods).toEqual(["POST"]);
      expect(context.extractedComponents.urls).toEqual([
        "https://api.example.com",
      ]);
    });
  });

  describe("inferMissingFields", () => {
    it("should infer test type from keywords", () => {
      const context: ParseContext = {
        originalInput: "Create a stress test for the API",
        cleanedInput: "create a stress test for the api",
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
        confidence: 0.5,
      };

      const result = enhancer.inferMissingFields(context);

      expect(result.inferredFields.testType).toBe("stress");
    });

    it("should infer duration from explicit patterns", () => {
      const context: ParseContext = {
        originalInput: "Run test for 5 minutes",
        cleanedInput: "run test for 5 minutes",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "",
          loadPattern: "",
        },
        ambiguities: [],
        confidence: 0.5,
      };

      const result = enhancer.inferMissingFields(context);

      expect(result.inferredFields.duration).toBe("5m");
    });

    it("should infer load pattern from keywords", () => {
      const context: ParseContext = {
        originalInput: "Gradually ramp up the load",
        cleanedInput: "gradually ramp up the load",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "",
        },
        ambiguities: [],
        confidence: 0.5,
      };

      const result = enhancer.inferMissingFields(context);

      expect(result.inferredFields.loadPattern).toBe("ramp");
    });

    it("should use defaults when no patterns found", () => {
      const context: ParseContext = {
        originalInput: "Test the endpoint",
        cleanedInput: "test the endpoint",
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
        confidence: 0.5,
      };

      const result = enhancer.inferMissingFields(context);

      expect(result.inferredFields.testType).toBe("load");
      expect(result.inferredFields.duration).toBe("30s");
      expect(result.inferredFields.loadPattern).toBe("constant");
    });

    it("should adjust confidence based on inference quality", () => {
      const context: ParseContext = {
        originalInput: "Test the endpoint",
        cleanedInput: "test the endpoint",
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
        confidence: 0.8,
      };

      const result = enhancer.inferMissingFields(context);

      // Confidence should be reduced due to using all defaults
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.confidence).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("resolveAmbiguities", () => {
    it("should identify method ambiguities when no method specified", () => {
      const context: ParseContext = {
        originalInput: "Test the API",
        cleanedInput: "test the api",
        extractedComponents: {
          methods: [],
          urls: ["https://api.example.com"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const result = enhancer.resolveAmbiguities(context);

      const methodAmbiguity = result.ambiguities.find(
        (a) => a.field === "method"
      );
      expect(methodAmbiguity).toBeDefined();
      expect(methodAmbiguity?.possibleValues).toEqual(["GET", "POST"]);
      expect(methodAmbiguity?.reason).toContain("No HTTP method specified");
    });

    it("should identify method ambiguities when multiple methods found", () => {
      const context: ParseContext = {
        originalInput: "Test GET and POST requests",
        cleanedInput: "test get and post requests",
        extractedComponents: {
          methods: ["GET", "POST"],
          urls: ["https://api.example.com"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const result = enhancer.resolveAmbiguities(context);

      const methodAmbiguity = result.ambiguities.find(
        (a) => a.field === "method"
      );
      expect(methodAmbiguity).toBeDefined();
      expect(methodAmbiguity?.possibleValues).toEqual(["GET", "POST"]);
      expect(methodAmbiguity?.reason).toContain("Multiple HTTP methods found");
    });

    it("should identify URL ambiguities when no URL specified", () => {
      const context: ParseContext = {
        originalInput: "Load test with 10 users",
        cleanedInput: "load test with 10 users",
        extractedComponents: {
          methods: ["GET"],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [10],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const result = enhancer.resolveAmbiguities(context);

      const urlAmbiguity = result.ambiguities.find((a) => a.field === "url");
      expect(urlAmbiguity).toBeDefined();
      expect(urlAmbiguity?.possibleValues).toContain("http://localhost:8080");
      expect(urlAmbiguity?.reason).toContain("No URL specified");
    });

    it("should identify relative URL ambiguities", () => {
      const context: ParseContext = {
        originalInput: "Test /api/users endpoint",
        cleanedInput: "test /api/users endpoint",
        extractedComponents: {
          methods: ["GET"],
          urls: ["/api/users"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const result = enhancer.resolveAmbiguities(context);

      const urlAmbiguity = result.ambiguities.find((a) => a.field === "url");
      expect(urlAmbiguity).toBeDefined();
      expect(urlAmbiguity?.possibleValues).toContain(
        "http://localhost/api/users"
      );
      expect(urlAmbiguity?.reason).toContain("Relative URL found");
    });

    it("should identify count ambiguities", () => {
      const context: ParseContext = {
        originalInput: "Test the API endpoint",
        cleanedInput: "test the api endpoint",
        extractedComponents: {
          methods: ["GET"],
          urls: ["https://api.example.com"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const result = enhancer.resolveAmbiguities(context);

      const countAmbiguity = result.ambiguities.find(
        (a) => a.field === "userCount"
      );
      expect(countAmbiguity).toBeDefined();
      expect(countAmbiguity?.possibleValues).toEqual(["1", "10", "100"]);
      expect(countAmbiguity?.reason).toContain("No user count specified");
    });

    it("should identify authentication header ambiguities", () => {
      const context: ParseContext = {
        originalInput: "Test with auth headers",
        cleanedInput: "test with auth headers",
        extractedComponents: {
          methods: ["GET"],
          urls: ["https://api.example.com"],
          headers: [
            {
              Authorization: "Bearer token1",
              "X-Auth-Token": "token2",
            },
          ],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const result = enhancer.resolveAmbiguities(context);

      const authAmbiguity = result.ambiguities.find(
        (a) => a.field === "authentication"
      );
      expect(authAmbiguity).toBeDefined();
      expect(authAmbiguity?.possibleValues).toContain("Authorization");
      expect(authAmbiguity?.possibleValues).toContain("X-Auth-Token");
    });

    it("should identify content-type ambiguities when body present without content-type", () => {
      const context: ParseContext = {
        originalInput: "POST with JSON body",
        cleanedInput: "post with json body",
        extractedComponents: {
          methods: ["POST"],
          urls: ["https://api.example.com"],
          headers: [{}],
          bodies: ['{"key": "value"}'],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.7,
      };

      const result = enhancer.resolveAmbiguities(context);

      const contentTypeAmbiguity = result.ambiguities.find(
        (a) => a.field === "content-type"
      );
      expect(contentTypeAmbiguity).toBeDefined();
      expect(contentTypeAmbiguity?.possibleValues).toContain(
        "application/json"
      );
    });

    it("should adjust confidence based on ambiguities", () => {
      const context: ParseContext = {
        originalInput: "Test something",
        cleanedInput: "test something",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const result = enhancer.resolveAmbiguities(context);

      // Should have critical ambiguities (method, url) which significantly reduce confidence
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it("should maintain minimum confidence level", () => {
      const context: ParseContext = {
        originalInput: "Ambiguous test",
        cleanedInput: "ambiguous test",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "load",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.2,
      };

      const result = enhancer.resolveAmbiguities(context);

      expect(result.confidence).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("integration tests", () => {
    it("should handle complete context enhancement workflow", () => {
      const input =
        "Create a stress test for POST https://api.example.com/users with 100 users for 2 minutes";
      const structuredData: StructuredData = {
        jsonBlocks: [],
        urls: ["https://api.example.com/users"],
        headers: {},
        methods: ["POST"],
        keyValuePairs: { users: "100" },
      };
      const hints: ParsingHint[] = [
        {
          type: "method",
          value: "POST",
          confidence: 0.9,
          position: { start: 25, end: 29 },
        },
        {
          type: "url",
          value: "https://api.example.com/users",
          confidence: 0.95,
          position: { start: 30, end: 59 },
        },
        {
          type: "count",
          value: "100",
          confidence: 0.8,
          position: { start: 65, end: 68 },
        },
      ];

      // Build initial context
      let context = enhancer.buildContext(input, structuredData, hints);
      expect(context.extractedComponents.methods).toEqual(["POST"]);
      expect(context.extractedComponents.urls).toEqual([
        "https://api.example.com/users",
      ]);
      expect(context.extractedComponents.counts).toEqual([100]);

      // Infer missing fields
      context = enhancer.inferMissingFields(context);
      expect(context.inferredFields.testType).toBe("stress");
      expect(context.inferredFields.duration).toBe("2m");
      expect(context.inferredFields.loadPattern).toBe("ramp"); // stress test implies ramp

      // Resolve ambiguities
      context = enhancer.resolveAmbiguities(context);

      // Should have minimal ambiguities since most info is provided
      const criticalAmbiguities = context.ambiguities.filter((a) =>
        ["method", "url"].includes(a.field)
      );
      expect(criticalAmbiguities).toHaveLength(0);

      expect(context.confidence).toBeGreaterThan(0.7);
    });
  });
});
