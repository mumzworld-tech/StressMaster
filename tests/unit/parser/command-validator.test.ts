import { describe, it, expect } from "vitest";
import { ResponseHandler, ValidationContext } from "../../../src/core/parser";
import { LoadTestSpec } from "../../../src/types";

describe("CommandValidator", () => {
  const createValidationContext = (
    overrides: Partial<ValidationContext> = {}
  ): ValidationContext => ({
    originalInput: "test input",
    confidence: 0.8,
    ambiguities: [],
    ...overrides,
  });

  describe("validateLoadTestSpec", () => {
    it("should validate a complete and valid spec", () => {
      const validSpec: LoadTestSpec = {
        id: "test_123",
        name: "Valid Test",
        description: "A valid test spec",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/users",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 50,
        },
        duration: {
          value: 5,
          unit: "minutes",
        },
      };

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(validSpec, context);

      expect(result.isValid).toBe(true);
      expect(result.canProceed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should identify missing required fields", () => {
      const invalidSpec = {
        requests: [
          {
            url: "https://api.example.com/test",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: { value: 1, unit: "minutes" },
      } as LoadTestSpec;

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(
        invalidSpec,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(result.errors).toContain("Test ID is required");
      expect(result.errors).toContain("Test name is required");
    });

    it("should validate URL format", () => {
      const specWithBadUrl: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "not-a-valid-url",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(
        specWithBadUrl,
        context
      );

      expect(
        result.warnings.some((w) => w.includes("URL format may be invalid"))
      ).toBe(true);
    });

    it("should validate load parameters", () => {
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
        duration: { value: 1, unit: "minutes" },
      };

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(
        specWithoutLoadParams,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Either virtual users or requests per second must be specified"
      );
    });

    it("should validate payload structure for JSON requests", () => {
      const specWithInvalidPayload: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/test",
            headers: { "Content-Type": "application/json" },
            payload: {
              template: '{"invalid": json}', // Invalid JSON
              variables: [],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(
        specWithInvalidPayload,
        context
      );

      expect(
        result.errors.some((e) =>
          e.includes("Payload template is not valid JSON")
        )
      ).toBe(true);
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

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(
        specWithInvalidDuration,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Test duration must be positive");
    });

    it("should warn about very high load parameters", () => {
      const specWithHighLoad: LoadTestSpec = {
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
          virtualUsers: 15000, // Very high
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(
        specWithHighLoad,
        context
      );

      expect(
        result.warnings.some((w) =>
          w.includes("Very high number of virtual users")
        )
      ).toBe(true);
    });

    it("should adjust confidence based on issues", () => {
      const specWithWarnings: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com", // Placeholder URL
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: { value: 5, unit: "seconds" }, // Very short
      };

      const context = createValidationContext({ confidence: 0.9 });
      const result = CommandValidator.validateLoadTestSpec(
        specWithWarnings,
        context
      );

      expect(result.confidence).toBeLessThan(0.9); // Should be reduced due to warnings
    });

    it("should validate workflow integrity", () => {
      const specWithInvalidWorkflow: LoadTestSpec = {
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
        duration: { value: 1, unit: "minutes" },
        workflow: [
          {
            id: "step1",
            name: "First Step",
            request: { method: "GET", url: "/api/step1" },
          },
          {
            id: "step1", // Duplicate ID
            name: "Second Step",
            request: { method: "POST", url: "/api/step2" },
          },
        ],
      };

      const context = createValidationContext();
      const result = CommandValidator.validateLoadTestSpec(
        specWithInvalidWorkflow,
        context
      );

      expect(
        result.errors.some((e) => e.includes("Duplicate workflow step IDs"))
      ).toBe(true);
    });
  });
});
