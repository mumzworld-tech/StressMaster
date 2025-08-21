import { describe, it, expect } from "vitest";
import {
  serializeLoadTestSpec,
  deserializeLoadTestSpec,
  serializeRequestSpec,
  deserializeRequestSpec,
  serializeLoadPattern,
  deserializeLoadPattern,
  serializePayloadSpec,
  deserializePayloadSpec,
  safeJsonParse,
  deepClone,
  parseAndValidateLoadTestSpec,
} from "../../../src/types/serialization.js";
import {
  LoadTestSpec,
  RequestSpec,
  LoadPattern,
  PayloadSpec,
} from "../../../src/types/index.js";

describe("Serialization Functions", () => {
  const sampleLoadTestSpec: LoadTestSpec = {
    id: "test-1",
    name: "Sample Test",
    description: "A sample load test",
    testType: "stress",
    requests: [
      {
        method: "GET",
        url: "https://api.example.com/health",
      },
    ],
    loadPattern: {
      type: "constant",
      virtualUsers: 10,
    },
    duration: { value: 5, unit: "minutes" },
  };

  const sampleRequestSpec: RequestSpec = {
    method: "POST",
    url: "https://api.example.com/users",
    headers: { "Content-Type": "application/json" },
    payload: {
      template: '{"name": "{{name}}"}',
      variables: [{ name: "name", type: "random_string" }],
    },
  };

  const sampleLoadPattern: LoadPattern = {
    type: "ramp-up",
    virtualUsers: 20,
    rampUpTime: { value: 2, unit: "minutes" },
  };

  const samplePayloadSpec: PayloadSpec = {
    template: '{"userId": "{{userId}}", "timestamp": "{{timestamp}}"}',
    variables: [
      { name: "userId", type: "random_id" },
      { name: "timestamp", type: "timestamp" },
    ],
  };

  describe("LoadTestSpec serialization", () => {
    it("should serialize LoadTestSpec to JSON string", () => {
      const json = serializeLoadTestSpec(sampleLoadTestSpec);

      expect(json).toContain('"id": "test-1"');
      expect(json).toContain('"name": "Sample Test"');
      expect(json).toContain('"testType": "stress"');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("should deserialize valid JSON to LoadTestSpec", () => {
      const json = serializeLoadTestSpec(sampleLoadTestSpec);
      const { spec, validation } = deserializeLoadTestSpec(json);

      expect(validation.isValid).toBe(true);
      expect(spec).toEqual(sampleLoadTestSpec);
    });

    it("should handle invalid JSON during deserialization", () => {
      const invalidJson = '{"invalid": json}';
      const { spec, validation } = deserializeLoadTestSpec(invalidJson);

      expect(validation.isValid).toBe(false);
      expect(spec).toBeNull();
      expect(validation.errors[0]).toContain("Invalid JSON format");
    });

    it("should validate deserialized spec", () => {
      const invalidSpec = {
        id: "test-1",
        name: "Invalid Test",
        // missing required fields
      };
      const json = JSON.stringify(invalidSpec);
      const { spec, validation } = deserializeLoadTestSpec(json);

      expect(validation.isValid).toBe(false);
      expect(spec).toBeNull();
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("RequestSpec serialization", () => {
    it("should serialize and deserialize RequestSpec", () => {
      const json = serializeRequestSpec(sampleRequestSpec);
      const deserialized = deserializeRequestSpec(json);

      expect(deserialized).toEqual(sampleRequestSpec);
    });

    it("should throw error for invalid JSON in RequestSpec deserialization", () => {
      expect(() => deserializeRequestSpec("invalid json")).toThrow(
        "Failed to deserialize RequestSpec"
      );
    });
  });

  describe("LoadPattern serialization", () => {
    it("should serialize and deserialize LoadPattern", () => {
      const json = serializeLoadPattern(sampleLoadPattern);
      const deserialized = deserializeLoadPattern(json);

      expect(deserialized).toEqual(sampleLoadPattern);
    });

    it("should throw error for invalid JSON in LoadPattern deserialization", () => {
      expect(() => deserializeLoadPattern("invalid json")).toThrow(
        "Failed to deserialize LoadPattern"
      );
    });
  });

  describe("PayloadSpec serialization", () => {
    it("should serialize and deserialize PayloadSpec", () => {
      const json = serializePayloadSpec(samplePayloadSpec);
      const deserialized = deserializePayloadSpec(json);

      expect(deserialized).toEqual(samplePayloadSpec);
    });

    it("should throw error for invalid JSON in PayloadSpec deserialization", () => {
      expect(() => deserializePayloadSpec("invalid json")).toThrow(
        "Failed to deserialize PayloadSpec"
      );
    });
  });

  describe("Utility functions", () => {
    it("should safely parse valid JSON", () => {
      const obj = { test: "value" };
      const json = JSON.stringify(obj);
      const result = safeJsonParse(json, {});

      expect(result).toEqual(obj);
    });

    it("should return fallback for invalid JSON", () => {
      const fallback = { default: "value" };
      const result = safeJsonParse("invalid json", fallback);

      expect(result).toEqual(fallback);
    });

    it("should create deep clone of object", () => {
      const original = { nested: { value: "test" }, array: [1, 2, 3] };
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.array).not.toBe(original.array);
    });

    it("should throw error for non-serializable object in deepClone", () => {
      const circular: any = {};
      circular.self = circular;

      expect(() => deepClone(circular)).toThrow("Failed to deep clone object");
    });
  });

  describe("parseAndValidateLoadTestSpec", () => {
    it("should parse and validate valid LoadTestSpec JSON", () => {
      const json = serializeLoadTestSpec(sampleLoadTestSpec);
      const result = parseAndValidateLoadTestSpec(json);

      expect(result).toEqual(sampleLoadTestSpec);
    });

    it("should throw error for invalid JSON", () => {
      expect(() => parseAndValidateLoadTestSpec("invalid json")).toThrow(
        "Invalid LoadTestSpec"
      );
    });

    it("should throw error for invalid spec", () => {
      const invalidSpec = { id: "test" }; // missing required fields
      const json = JSON.stringify(invalidSpec);

      expect(() => parseAndValidateLoadTestSpec(json)).toThrow(
        "Invalid LoadTestSpec"
      );
    });
  });
});
