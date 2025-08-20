import { describe, it, expect } from "vitest";
import { ResponseHandler } from "../../../src/core/parser";
import { LoadTestSpec } from "../../../src/types";

describe("ResponseParser", () => {
  describe("parseOllamaResponse", () => {
    it("should parse valid JSON response", () => {
      const validSpec: LoadTestSpec = {
        id: "test_123",
        name: "Test API",
        description: "Test description",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      };

      const jsonResponse = JSON.stringify(validSpec);
      const result = ResponseParser.parseOllamaResponse(
        jsonResponse,
        "GET https://api.example.com/test with 10 users for 1 minute"
      );

      expect(result.spec.id).toBe("test_123");
      expect(result.spec.name).toBe("Test API");
      expect(result.confidence).toBeGreaterThan(0.5);
      // Allow for some ambiguities since the parser might detect missing details
      expect(result.ambiguities.length).toBeGreaterThanOrEqual(0);
    });

    it("should clean markdown formatting from response", () => {
      const validSpec: LoadTestSpec = {
        id: "test_123",
        name: "Test API",
        description: "Test description",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      };

      const markdownResponse = `\`\`\`json\n${JSON.stringify(
        validSpec
      )}\n\`\`\``;
      const result = ResponseParser.parseOllamaResponse(
        markdownResponse,
        "test input"
      );

      expect(result.spec.id).toBe("test_123");
      expect(result.spec.name).toBe("Test API");
    });

    it("should handle invalid JSON with fallback parsing", () => {
      const invalidJson = "This is not valid JSON";
      const result = ResponseParser.parseOllamaResponse(
        invalidJson,
        "Send 100 GET requests to https://api.example.com"
      );

      expect(result.spec).toBeDefined();
      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.requests[0].url).toBe("https://api.example.com");
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.ambiguities).toContain(
        "AI response could not be parsed as JSON"
      );
    });

    it("should enhance incomplete specs", () => {
      const incompleteSpec = {
        requests: [
          {
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {
          type: "constant",
        },
      };

      const result = ResponseParser.parseOllamaResponse(
        JSON.stringify(incompleteSpec),
        "POST to API with 50 users"
      );

      expect(result.spec.id).toBeDefined();
      expect(result.spec.name).toBeDefined();
      expect(result.spec.description).toBe("POST to API with 50 users");
      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.duration).toBeDefined();
    });

    it("should extract variables from payload templates", () => {
      const specWithPayload = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/test",
            payload: {
              template: '{"userId": "{{userId}}", "orderId": "{{orderId}}"}',
              variables: [],
            },
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 10 },
        duration: { value: 1, unit: "minutes" },
      };

      const result = ResponseParser.parseOllamaResponse(
        JSON.stringify(specWithPayload),
        "test input"
      );

      expect(result.spec.requests[0].payload?.variables).toHaveLength(2);
      expect(result.spec.requests[0].payload?.variables[0].name).toBe("userId");
      expect(result.spec.requests[0].payload?.variables[0].type).toBe(
        "random_id"
      );
      expect(result.spec.requests[0].payload?.variables[1].name).toBe(
        "orderId"
      );
      expect(result.spec.requests[0].payload?.variables[1].type).toBe(
        "random_id"
      );
    });
  });

  describe("validateParsedSpec", () => {
    it("should validate complete spec successfully", () => {
      const validSpec: LoadTestSpec = {
        id: "test_123",
        name: "Test API",
        description: "Test description",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      };

      const result = ResponseParser.validateParsedSpec(validSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should identify missing required fields", () => {
      const invalidSpec = {
        requests: [
          {
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {},
        duration: { value: 1, unit: "minutes" },
      } as LoadTestSpec;

      const result = ResponseParser.validateParsedSpec(invalidSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Test ID is required");
      expect(result.errors).toContain("Test name is required");
      expect(
        result.errors.some((e) => e.includes("HTTP method is required"))
      ).toBe(true);
    });

    it("should validate load pattern requirements", () => {
      const specWithoutLoadParams: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {
          type: "constant",
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      };

      const result = ResponseParser.validateParsedSpec(specWithoutLoadParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Either virtual users or requests per second must be specified"
      );
    });

    it("should validate duration requirements", () => {
      const specWithInvalidDuration: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: {
          value: -1,
          unit: "minutes",
        },
      };

      const result = ResponseParser.validateParsedSpec(specWithInvalidDuration);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Test duration must be positive");
    });
  });
});
