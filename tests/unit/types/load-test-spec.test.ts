import { describe, it, expect } from "vitest";
import {
  LoadTestSpec,
  RequestSpec,
  LoadPattern,
  PayloadSpec,
  VariableDefinition,
  WorkflowStep,
  CorrelationRule,
  ResponseValidation,
  StepCondition,
  DataExtraction,
} from "../../../src/types/load-test-spec.js";

describe("LoadTestSpec Data Models", () => {
  describe("LoadTestSpec", () => {
    it("should create a valid LoadTestSpec", () => {
      const spec: LoadTestSpec = {
        id: "test-1",
        name: "API Load Test",
        description: "Test API performance",
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

      expect(spec.id).toBe("test-1");
      expect(spec.testType).toBe("stress");
      expect(spec.requests).toHaveLength(1);
      expect(spec.loadPattern.type).toBe("constant");
    });

    it("should support workflow steps", () => {
      const workflowStep: WorkflowStep = {
        id: "step-1",
        name: "Login",
        request: {
          method: "POST",
          url: "https://api.example.com/login",
          payload: {
            template:
              '{"username": "{{username}}", "password": "{{password}}"}',
            variables: [
              { name: "username", type: "random_string" },
              { name: "password", type: "random_string" },
            ],
          },
        },
        thinkTime: { value: 2, unit: "seconds" },
        dataExtraction: [
          {
            name: "authToken",
            source: "response_body",
            extractor: "json_path",
            expression: "$.token",
          },
        ],
      };

      const spec: LoadTestSpec = {
        id: "workflow-test",
        name: "Workflow Test",
        description: "Multi-step workflow test",
        testType: "baseline",
        requests: [],
        loadPattern: { type: "constant", virtualUsers: 5 },
        duration: { value: 10, unit: "minutes" },
        workflow: [workflowStep],
      };

      expect(spec.workflow).toHaveLength(1);
      expect(spec.workflow![0].id).toBe("step-1");
      expect(spec.workflow![0].dataExtraction).toHaveLength(1);
    });

    it("should support data correlation rules", () => {
      const correlationRule: CorrelationRule = {
        sourceStep: "login",
        sourceField: "authToken",
        targetStep: "getData",
        targetField: "authorization",
      };

      const spec: LoadTestSpec = {
        id: "correlation-test",
        name: "Correlation Test",
        description: "Test with data correlation",
        testType: "baseline",
        requests: [],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 1, unit: "minutes" },
        dataCorrelation: [correlationRule],
      };

      expect(spec.dataCorrelation).toHaveLength(1);
      expect(spec.dataCorrelation![0].sourceStep).toBe("login");
    });
  });

  describe("RequestSpec", () => {
    it("should create a basic GET request", () => {
      const request: RequestSpec = {
        method: "GET",
        url: "https://api.example.com/users",
      };

      expect(request.method).toBe("GET");
      expect(request.url).toBe("https://api.example.com/users");
      expect(request.headers).toBeUndefined();
      expect(request.payload).toBeUndefined();
    });

    it("should create a POST request with payload", () => {
      const request: RequestSpec = {
        method: "POST",
        url: "https://api.example.com/users",
        headers: { "Content-Type": "application/json" },
        payload: {
          template: '{"name": "{{name}}", "email": "{{email}}"}',
          variables: [
            { name: "name", type: "random_string" },
            { name: "email", type: "random_string" },
          ],
        },
      };

      expect(request.method).toBe("POST");
      expect(request.headers).toEqual({ "Content-Type": "application/json" });
      expect(request.payload?.template).toContain("{{name}}");
      expect(request.payload?.variables).toHaveLength(2);
    });

    it("should support response validation", () => {
      const validation: ResponseValidation = {
        type: "status_code",
        condition: "equals",
        expectedValue: 200,
      };

      const request: RequestSpec = {
        method: "GET",
        url: "https://api.example.com/health",
        validation: [validation],
      };

      expect(request.validation).toHaveLength(1);
      expect(request.validation![0].type).toBe("status_code");
      expect(request.validation![0].expectedValue).toBe(200);
    });
  });

  describe("LoadPattern", () => {
    it("should create a constant load pattern", () => {
      const pattern: LoadPattern = {
        type: "constant",
        virtualUsers: 50,
      };

      expect(pattern.type).toBe("constant");
      expect(pattern.virtualUsers).toBe(50);
      expect(pattern.requestsPerSecond).toBeUndefined();
    });

    it("should create a ramp-up load pattern", () => {
      const pattern: LoadPattern = {
        type: "ramp-up",
        virtualUsers: 100,
        rampUpTime: { value: 5, unit: "minutes" },
        plateauTime: { value: 10, unit: "minutes" },
        rampDownTime: { value: 2, unit: "minutes" },
      };

      expect(pattern.type).toBe("ramp-up");
      expect(pattern.virtualUsers).toBe(100);
      expect(pattern.rampUpTime?.value).toBe(5);
      expect(pattern.plateauTime?.value).toBe(10);
      expect(pattern.rampDownTime?.value).toBe(2);
    });

    it("should create a spike load pattern", () => {
      const pattern: LoadPattern = {
        type: "spike",
        baselineVUs: 10,
        spikeIntensity: 100,
        virtualUsers: 110,
      };

      expect(pattern.type).toBe("spike");
      expect(pattern.baselineVUs).toBe(10);
      expect(pattern.spikeIntensity).toBe(100);
    });

    it("should support K6 stages", () => {
      const pattern: LoadPattern = {
        type: "step",
        stages: [
          { duration: "2m", target: 10 },
          { duration: "5m", target: 50 },
          { duration: "2m", target: 0 },
        ],
      };

      expect(pattern.stages).toHaveLength(3);
      expect(pattern.stages![0].target).toBe(10);
      expect(pattern.stages![1].duration).toBe("5m");
    });
  });

  describe("PayloadSpec", () => {
    it("should create a payload with variables", () => {
      const payload: PayloadSpec = {
        template: '{"userId": "{{userId}}", "timestamp": "{{timestamp}}"}',
        variables: [
          { name: "userId", type: "random_id" },
          { name: "timestamp", type: "timestamp" },
        ],
      };

      expect(payload.template).toContain("{{userId}}");
      expect(payload.variables).toHaveLength(2);
      expect(payload.variables[0].type).toBe("random_id");
      expect(payload.variables[1].type).toBe("timestamp");
    });

    it("should support variable parameters", () => {
      const variable: VariableDefinition = {
        name: "customString",
        type: "random_string",
        parameters: { length: 20, charset: "alphanumeric" },
      };

      const payload: PayloadSpec = {
        template: '{"data": "{{customString}}"}',
        variables: [variable],
      };

      expect(payload.variables[0].parameters?.length).toBe(20);
      expect(payload.variables[0].parameters?.charset).toBe("alphanumeric");
    });
  });

  describe("WorkflowStep", () => {
    it("should create a workflow step with conditions", () => {
      const condition: StepCondition = {
        type: "response_code",
        operator: "equals",
        value: 200,
        action: "continue",
      };

      const step: WorkflowStep = {
        id: "conditional-step",
        name: "Conditional Request",
        request: {
          method: "GET",
          url: "https://api.example.com/data",
        },
        conditions: [condition],
      };

      expect(step.conditions).toHaveLength(1);
      expect(step.conditions![0].type).toBe("response_code");
      expect(step.conditions![0].action).toBe("continue");
    });

    it("should support data extraction", () => {
      const extraction: DataExtraction = {
        name: "userId",
        source: "response_body",
        extractor: "json_path",
        expression: "$.user.id",
      };

      const step: WorkflowStep = {
        id: "extract-step",
        name: "Extract User ID",
        request: {
          method: "GET",
          url: "https://api.example.com/user",
        },
        dataExtraction: [extraction],
      };

      expect(step.dataExtraction).toHaveLength(1);
      expect(step.dataExtraction![0].extractor).toBe("json_path");
      expect(step.dataExtraction![0].expression).toBe("$.user.id");
    });
  });
});
