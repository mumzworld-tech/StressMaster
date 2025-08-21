import { describe, it, expect } from "vitest";
import {
  validateLoadTestSpec,
  validateRequestSpec,
  validateLoadPattern,
  validatePayloadSpec,
  validateDuration,
} from "../../../src/types/validation.js";
import {
  LoadTestSpec,
  RequestSpec,
  LoadPattern,
  PayloadSpec,
  Duration,
} from "../../../src/types/index.js";

describe("Validation Functions", () => {
  describe("validateDuration", () => {
    it("should validate valid duration", () => {
      const duration: Duration = { value: 30, unit: "seconds" };
      const result = validateDuration(duration);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject negative duration value", () => {
      const duration: Duration = { value: -5, unit: "minutes" };
      const result = validateDuration(duration);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('"value" must be a positive number');
    });

    it("should reject invalid unit", () => {
      const duration = { value: 10, unit: "days" } as unknown as Duration;
      const result = validateDuration(duration);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('"unit" must be one of'))
      ).toBe(true);
    });
  });

  describe("validatePayloadSpec", () => {
    it("should validate valid payload spec", () => {
      const payloadSpec: PayloadSpec = {
        template: '{"userId": "{{userId}}", "timestamp": "{{timestamp}}"}',
        variables: [
          { name: "userId", type: "random_id" },
          { name: "timestamp", type: "timestamp" },
        ],
      };

      const result = validatePayloadSpec(payloadSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject payload spec without template", () => {
      const payloadSpec = {
        variables: [{ name: "userId", type: "random_id" }],
      } as PayloadSpec;

      const result = validatePayloadSpec(payloadSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('"template" is required');
    });

    it("should reject invalid variable type", () => {
      const payloadSpec = {
        template: '{"userId": "{{userId}}"}',
        variables: [{ name: "userId", type: "invalid_type" }],
      } as unknown as PayloadSpec;

      const result = validatePayloadSpec(payloadSpec);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes("must be one of"))
      ).toBe(true);
    });
  });

  describe("validateRequestSpec", () => {
    it("should validate valid request spec", () => {
      const requestSpec: RequestSpec = {
        method: "POST",
        url: "https://api.example.com/users",
        headers: { "Content-Type": "application/json" },
        payload: {
          template: '{"name": "{{name}}"}',
          variables: [{ name: "name", type: "random_string" }],
        },
      };

      const result = validateRequestSpec(requestSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid HTTP method", () => {
      const requestSpec = {
        method: "INVALID",
        url: "https://api.example.com/users",
      } as unknown as RequestSpec;

      const result = validateRequestSpec(requestSpec);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('"method" must be one of'))
      ).toBe(true);
    });

    it("should reject invalid URL", () => {
      const requestSpec = {
        method: "GET",
        url: "not-a-valid-url",
      } as RequestSpec;

      const result = validateRequestSpec(requestSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('"url" must be a valid uri');
    });
  });

  describe("validateLoadPattern", () => {
    it("should validate constant load pattern with virtual users", () => {
      const loadPattern: LoadPattern = {
        type: "constant",
        virtualUsers: 10,
      };

      const result = validateLoadPattern(loadPattern);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate ramp-up pattern with RPS", () => {
      const loadPattern: LoadPattern = {
        type: "ramp-up",
        requestsPerSecond: 50,
        rampUpTime: { value: 2, unit: "minutes" },
      };

      const result = validateLoadPattern(loadPattern);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject pattern without virtualUsers or requestsPerSecond", () => {
      const loadPattern = {
        type: "constant",
      } as LoadPattern;

      const result = validateLoadPattern(loadPattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Either virtualUsers or requestsPerSecond must be specified"
      );
    });

    it("should reject invalid pattern type", () => {
      const loadPattern = {
        type: "invalid",
        virtualUsers: 10,
      } as unknown as LoadPattern;

      const result = validateLoadPattern(loadPattern);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('"type" must be one of'))
      ).toBe(true);
    });
  });

  describe("validateLoadTestSpec", () => {
    it("should validate complete load test spec", () => {
      const loadTestSpec: LoadTestSpec = {
        id: "test-1",
        name: "API Load Test",
        description: "Test API performance under load",
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

      const result = validateLoadTestSpec(loadTestSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject spec without requests", () => {
      const loadTestSpec = {
        id: "test-1",
        name: "API Load Test",
        description: "Test API performance under load",
        testType: "stress",
        requests: [],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: { value: 5, unit: "minutes" },
      } as LoadTestSpec;

      const result = validateLoadTestSpec(loadTestSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '"requests" must contain at least 1 items'
      );
    });

    it("should validate workflow with correlation rules", () => {
      const loadTestSpec: LoadTestSpec = {
        id: "test-1",
        name: "Workflow Test",
        description: "Test with workflow steps",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/health",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 5,
        },
        duration: { value: 2, unit: "minutes" },
        workflow: [
          {
            id: "step1",
            name: "Login",
            request: {
              method: "POST",
              url: "https://api.example.com/login",
            },
          },
          {
            id: "step2",
            name: "Get Data",
            request: {
              method: "GET",
              url: "https://api.example.com/data",
            },
          },
        ],
        dataCorrelation: [
          {
            sourceStep: "step1",
            sourceField: "token",
            targetStep: "step2",
            targetField: "authorization",
          },
        ],
      };

      const result = validateLoadTestSpec(loadTestSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject correlation rule with invalid step reference", () => {
      const loadTestSpec: LoadTestSpec = {
        id: "test-1",
        name: "Workflow Test",
        description: "Test with invalid workflow",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/health",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 5,
        },
        duration: { value: 2, unit: "minutes" },
        workflow: [
          {
            id: "step1",
            name: "Login",
            request: {
              method: "POST",
              url: "https://api.example.com/login",
            },
          },
        ],
        dataCorrelation: [
          {
            sourceStep: "step1",
            sourceField: "token",
            targetStep: "invalid_step",
            targetField: "authorization",
          },
        ],
      };

      const result = validateLoadTestSpec(loadTestSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Target step "invalid_step" not found in workflow'
      );
    });
  });
});
