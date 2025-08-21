import { describe, it, expect, beforeEach } from "vitest";
import { K6ScriptGenerator } from "@/core/generator";
import {
  LoadTestSpec,
  RequestSpec,
  PayloadSpec,
  VariableDefinition,
} from "@/types";

describe("K6ScriptGenerator", () => {
  let generator: K6ScriptGenerator;

  beforeEach(() => {
    generator = new K6ScriptGenerator();
  });

  describe("generateScript", () => {
    it("should generate a basic HTTP GET script", () => {
      const spec: LoadTestSpec = {
        id: "test-1",
        name: "Basic GET Test",
        description: "Simple GET request test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/users",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      };

      const script = generator.generateScript(spec);

      expect(script.id).toBe("script_test-1");
      expect(script.name).toBe("Basic GET Test_script");
      expect(script.content).toContain("import http from 'k6/http';");
      expect(script.content).toContain("export default function");
      expect(script.content).toContain("makeRequest1");
      expect(script.content).toContain(
        "http.get('https://api.example.com/users')"
      );
      expect(script.options.vus).toBe(10);
      expect(script.options.duration).toBe("30s");
    });

    it("should generate a POST script with payload", () => {
      const spec: LoadTestSpec = {
        id: "test-2",
        name: "POST Test",
        description: "POST request with payload",
        testType: "stress",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/users",
            headers: {
              "Content-Type": "application/json",
            },
            payload: {
              template: '{"name": "{{username}}", "id": {{userId}}}',
              variables: [
                {
                  name: "username",
                  type: "random_string",
                  parameters: { length: 8 },
                },
                {
                  name: "userId",
                  type: "random_id",
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 5,
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("http.post(");
      expect(script.content).toContain("const headers =");
      expect(script.content).toContain("Content-Type");
      expect(script.content).toContain("const username =");
      expect(script.content).toContain("const userId =");
      expect(script.content).toContain("const payload =");
      expect(script.options.duration).toBe("1m");
    });

    it("should generate script with ramp-up stages", () => {
      const spec: LoadTestSpec = {
        id: "test-3",
        name: "Ramp-up Test",
        description: "Load test with ramp-up",
        testType: "stress",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/health",
          },
        ],
        loadPattern: {
          type: "ramp-up",
          virtualUsers: 50,
          rampUpTime: { value: 2, unit: "minutes" },
          plateauTime: { value: 5, unit: "minutes" },
        },
        duration: {
          value: 10,
          unit: "minutes",
        },
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("export function setup()");
      expect(script.content).toContain("export function teardown(data)");
      expect(script.options.stages).toBeDefined();
      expect(script.options.stages).toHaveLength(3);
      expect(script.options.stages![0]).toEqual({
        duration: "2m",
        target: 50,
      });
      expect(script.options.stages![1]).toEqual({
        duration: "5m",
        target: 50,
      });
      expect(script.options.stages![2]).toEqual({
        duration: "60s",
        target: 0,
      });
    });

    it("should generate script with response validation", () => {
      const spec: LoadTestSpec = {
        id: "test-4",
        name: "Validation Test",
        description: "Test with response validation",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/status",
            validation: [
              {
                type: "status_code",
                condition: "equals",
                expectedValue: 200,
              },
              {
                type: "response_time",
                condition: "less_than",
                expectedValue: 500,
              },
              {
                type: "content",
                condition: "contains",
                expectedValue: "success",
              },
            ],
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("check(response, {");
      expect(script.content).toContain("status is 200");
      expect(script.content).toContain("response time < 500ms");
      expect(script.content).toContain('response contains "success"');
    });

    it("should handle multiple requests", () => {
      const spec: LoadTestSpec = {
        id: "test-5",
        name: "Multiple Requests Test",
        description: "Test with multiple requests",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/users",
          },
          {
            method: "POST",
            url: "https://api.example.com/users",
            payload: {
              template: '{"name": "test"}',
              variables: [],
            },
          },
          {
            method: "DELETE",
            url: "https://api.example.com/users/1",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("makeRequest1");
      expect(script.content).toContain("makeRequest2");
      expect(script.content).toContain("makeRequest3");
      expect(script.content).toContain("http.get(");
      expect(script.content).toContain("http.post(");
      expect(script.content).toContain("http.delete(");
    });
  });

  describe("generatePayloadTemplate", () => {
    it("should generate payload template with variables", () => {
      const payloadSpec: PayloadSpec = {
        template:
          '{"userId": {{userId}}, "name": "{{username}}", "timestamp": {{timestamp}}}',
        variables: [
          {
            name: "userId",
            type: "random_id",
          },
          {
            name: "username",
            type: "random_string",
            parameters: { length: 12 },
          },
          {
            name: "timestamp",
            type: "timestamp",
          },
        ],
      };

      const template = generator.generatePayloadTemplate(payloadSpec);

      expect(template.template).toBe(payloadSpec.template);
      expect(template.variables).toHaveLength(3);
      expect(template.variables[0]).toEqual({
        name: "userId",
        placeholder: "{{userId}}",
        type: "random_id",
        required: true,
      });
      expect(template.generators).toHaveProperty("userId");
      expect(template.generators).toHaveProperty("username");
      expect(template.generators).toHaveProperty("timestamp");
    });

    it("should handle UUID variable type", () => {
      const payloadSpec: PayloadSpec = {
        template: '{"id": "{{uuid}}"}',
        variables: [
          {
            name: "uuid",
            type: "uuid",
          },
        ],
      };

      const template = generator.generatePayloadTemplate(payloadSpec);

      expect(template.generators.uuid.type).toBe("uuid");
      const generatedUuid = template.generators.uuid.generate();
      expect(typeof generatedUuid).toBe("string");
      expect(generatedUuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it("should handle sequence variable type", () => {
      const payloadSpec: PayloadSpec = {
        template: '{"sequence": {{seq}}}',
        variables: [
          {
            name: "seq",
            type: "sequence",
          },
        ],
      };

      const template = generator.generatePayloadTemplate(payloadSpec);

      expect(template.generators.seq.type).toBe("sequence");
      const first = template.generators.seq.generate();
      const second = template.generators.seq.generate();
      expect(second).toBe(first + 1);
    });
  });

  describe("validateScript", () => {
    it("should validate a correct script", () => {
      const script = {
        id: "test-script",
        name: "Test Script",
        content: `import http from 'k6/http';
import { check, sleep } from 'k6';

export default function() {
  const response = http.get('https://api.example.com');
  check(response, {
    'status is 200': (r) => r.status === 200
  });
  sleep(1);
}`,
        imports: [],
        options: {
          vus: 10,
          duration: "30s",
        },
        metadata: {
          generatedAt: new Date(),
          specId: "test",
          version: "1.0.0",
          description: "Test",
          tags: ["baseline"],
        },
      };

      const result = generator.validateScript(script);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing default export function", () => {
      const script = {
        id: "test-script",
        name: "Test Script",
        content: `import http from 'k6/http';
function test() {
  http.get('https://api.example.com');
}`,
        imports: [],
        options: { vus: 1, duration: "10s" },
        metadata: {
          generatedAt: new Date(),
          specId: "test",
          version: "1.0.0",
          description: "Test",
          tags: ["baseline"],
        },
      };

      const result = generator.validateScript(script);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Script must contain a default export function"
      );
    });

    it("should detect invalid virtual users", () => {
      const script = {
        id: "test-script",
        name: "Test Script",
        content: "export default function() {}",
        imports: [],
        options: { vus: 0, duration: "10s" },
        metadata: {
          generatedAt: new Date(),
          specId: "test",
          version: "1.0.0",
          description: "Test",
          tags: ["baseline"],
        },
      };

      const result = generator.validateScript(script);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Virtual users must be at least 1");
    });

    it("should detect invalid duration format", () => {
      const script = {
        id: "test-script",
        name: "Test Script",
        content: "export default function() {}",
        imports: [],
        options: { vus: 1, duration: "invalid" },
        metadata: {
          generatedAt: new Date(),
          specId: "test",
          version: "1.0.0",
          description: "Test",
          tags: ["baseline"],
        },
      };

      const result = generator.validateScript(script);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid duration format");
    });

    it("should detect unbalanced braces", () => {
      const script = {
        id: "test-script",
        name: "Test Script",
        content: `export default function() {
  if (true) {
    console.log('test');
  // Missing closing brace
}`,
        imports: [],
        options: { vus: 1, duration: "10s" },
        metadata: {
          generatedAt: new Date(),
          specId: "test",
          version: "1.0.0",
          description: "Test",
          tags: ["baseline"],
        },
      };

      const result = generator.validateScript(script);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unbalanced braces in script");
    });

    it("should provide warnings for missing best practices", () => {
      const script = {
        id: "test-script",
        name: "Test Script",
        content: `export default function() {
  console.log('test');
}`,
        imports: [],
        options: { vus: 1, duration: "10s" },
        metadata: {
          generatedAt: new Date(),
          specId: "test",
          version: "1.0.0",
          description: "Test",
          tags: ["baseline"],
        },
      };

      const result = generator.validateScript(script);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Script should import http module for HTTP requests"
      );
      expect(result.warnings).toContain(
        "Consider adding checks for response validation"
      );
    });
  });

  describe("variable generation", () => {
    it("should generate different variable types correctly", () => {
      const generator = new K6ScriptGenerator();

      // Test random_id
      const payloadWithRandomId: PayloadSpec = {
        template: '{"id": {{randomId}}}',
        variables: [{ name: "randomId", type: "random_id" }],
      };
      const templateRandomId =
        generator.generatePayloadTemplate(payloadWithRandomId);
      const randomId = templateRandomId.generators.randomId.generate();
      expect(typeof randomId).toBe("number");
      expect(randomId).toBeGreaterThanOrEqual(0);
      expect(randomId).toBeLessThan(1000000);

      // Test timestamp
      const payloadWithTimestamp: PayloadSpec = {
        template: '{"timestamp": {{ts}}}',
        variables: [{ name: "ts", type: "timestamp" }],
      };
      const templateTimestamp =
        generator.generatePayloadTemplate(payloadWithTimestamp);
      const timestamp = templateTimestamp.generators.ts.generate();
      expect(typeof timestamp).toBe("number");
      expect(timestamp).toBeGreaterThan(0);

      // Test random_string
      const payloadWithString: PayloadSpec = {
        template: '{"name": "{{str}}"}',
        variables: [
          { name: "str", type: "random_string", parameters: { length: 5 } },
        ],
      };
      const templateString =
        generator.generatePayloadTemplate(payloadWithString);
      const randomString = templateString.generators.str.generate();
      expect(typeof randomString).toBe("string");
      expect(randomString.length).toBeLessThanOrEqual(10); // substring(2, 12) gives max 10 chars
    });
  });

  describe("complex scenarios and workflows", () => {
    it("should generate workflow script with multiple steps", () => {
      const spec: LoadTestSpec = {
        id: "workflow-test",
        name: "Multi-step Workflow",
        description: "Test with workflow steps",
        testType: "baseline",
        requests: [], // Empty for workflow-based tests
        loadPattern: {
          type: "constant",
          virtualUsers: 5,
        },
        duration: {
          value: 2,
          unit: "minutes",
        },
        workflow: [
          {
            id: "login",
            name: "User Login",
            request: {
              method: "POST",
              url: "https://api.example.com/login",
              payload: {
                template: '{"username": "{{username}}", "password": "test123"}',
                variables: [{ name: "username", type: "random_string" }],
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
          },
          {
            id: "getData",
            name: "Get User Data",
            request: {
              method: "GET",
              url: "https://api.example.com/user/profile",
              headers: {
                Authorization: "Bearer {{authToken}}",
              },
            },
            conditions: [
              {
                type: "response_code",
                operator: "equals",
                value: 200,
                action: "continue",
              },
            ],
          },
        ],
        dataCorrelation: [
          {
            sourceStep: "login",
            sourceField: "authToken",
            targetStep: "getData",
            targetField: "authToken",
          },
        ],
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("let workflowData = {}");
      expect(script.content).toContain("executeStep_login");
      expect(script.content).toContain("executeStep_getData");
      expect(script.content).toContain("sleep(2)"); // Think time
      expect(script.content).toContain("JSON.parse(response.body)"); // Data extraction
      expect(script.content).toContain("workflowData['authToken']"); // Data correlation
      expect(script.content).toContain("response.status === 200"); // Condition
    });

    it("should generate data extraction code for different extractors", () => {
      const spec: LoadTestSpec = {
        id: "extraction-test",
        name: "Data Extraction Test",
        description: "Test data extraction",
        testType: "baseline",
        requests: [],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
        workflow: [
          {
            id: "step1",
            name: "Extract Data",
            request: {
              method: "GET",
              url: "https://api.example.com/data",
            },
            dataExtraction: [
              {
                name: "jsonValue",
                source: "response_body",
                extractor: "json_path",
                expression: "$.data.id",
              },
              {
                name: "regexValue",
                source: "response_body",
                extractor: "regex",
                expression: 'id="([^"]+)"',
              },
              {
                name: "xpathValue",
                source: "response_body",
                extractor: "xpath",
                expression: '//div[@class="content"]',
              },
            ],
          },
        ],
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("JSON.parse(response.body)");
      expect(script.content).toContain("responseJson.data.id");
      expect(script.content).toContain('response.body.match(/id="([^"]+)"/');
      expect(script.content).toContain("XPath extraction not fully supported");
    });

    it("should generate conditional logic for different step conditions", () => {
      const spec: LoadTestSpec = {
        id: "condition-test",
        name: "Conditional Logic Test",
        description: "Test step conditions",
        testType: "baseline",
        requests: [],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
        workflow: [
          {
            id: "step1",
            name: "Conditional Step",
            request: {
              method: "GET",
              url: "https://api.example.com/test",
            },
            conditions: [
              {
                type: "response_code",
                operator: "equals",
                value: 200,
                action: "continue",
              },
              {
                type: "response_content",
                operator: "contains",
                value: "success",
                action: "continue",
              },
              {
                type: "response_time",
                operator: "less_than",
                value: 1000,
                action: "fail",
              },
            ],
          },
        ],
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("response.status === 200");
      expect(script.content).toContain("response.body.includes('success')");
      expect(script.content).toContain("response.timings.duration < 1000");
      expect(script.content).toContain("// Continue with next step");
      expect(script.content).toContain("throw new Error");
    });

    it("should handle think time in workflow steps", () => {
      const spec: LoadTestSpec = {
        id: "thinktime-test",
        name: "Think Time Test",
        description: "Test think time insertion",
        testType: "baseline",
        requests: [],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
        workflow: [
          {
            id: "step1",
            name: "Step with Think Time",
            request: {
              method: "GET",
              url: "https://api.example.com/step1",
            },
            thinkTime: { value: 5, unit: "seconds" },
          },
          {
            id: "step2",
            name: "Step with Minute Think Time",
            request: {
              method: "GET",
              url: "https://api.example.com/step2",
            },
            thinkTime: { value: 2, unit: "minutes" },
          },
        ],
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("sleep(5)"); // 5 seconds
      expect(script.content).toContain("sleep(120)"); // 2 minutes = 120 seconds
      expect(script.content).toContain(
        "Think time for realistic user behavior"
      );
    });

    it("should generate data correlation between workflow steps", () => {
      const spec: LoadTestSpec = {
        id: "correlation-test",
        name: "Data Correlation Test",
        description: "Test data correlation between steps",
        testType: "baseline",
        requests: [],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
        workflow: [
          {
            id: "createUser",
            name: "Create User",
            request: {
              method: "POST",
              url: "https://api.example.com/users",
              payload: {
                template: '{"name": "{{username}}"}',
                variables: [{ name: "username", type: "random_string" }],
              },
            },
            dataExtraction: [
              {
                name: "userId",
                source: "response_body",
                extractor: "json_path",
                expression: "$.id",
              },
            ],
          },
          {
            id: "updateUser",
            name: "Update User",
            request: {
              method: "PUT",
              url: "https://api.example.com/users/{{userId}}",
              payload: {
                template: '{"id": {{userId}}, "status": "active"}',
                variables: [],
              },
            },
          },
        ],
        dataCorrelation: [
          {
            sourceStep: "createUser",
            sourceField: "userId",
            targetStep: "updateUser",
            targetField: "userId",
          },
        ],
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("workflowData['createUser_userId']");
      expect(script.content).toContain(
        "const userId = workflowData['createUser_userId'] || 'default_value'"
      );
    });

    it("should handle workflow with header correlation", () => {
      const spec: LoadTestSpec = {
        id: "header-correlation-test",
        name: "Header Correlation Test",
        description: "Test header correlation",
        testType: "baseline",
        requests: [],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        duration: {
          value: 10,
          unit: "seconds",
        },
        workflow: [
          {
            id: "auth",
            name: "Authentication",
            request: {
              method: "POST",
              url: "https://api.example.com/auth",
            },
            dataExtraction: [
              {
                name: "token",
                source: "response_body",
                extractor: "json_path",
                expression: "$.access_token",
              },
            ],
          },
          {
            id: "secureRequest",
            name: "Secure Request",
            request: {
              method: "GET",
              url: "https://api.example.com/secure",
              headers: {
                Authorization: "Bearer {{token}}",
                "X-Custom-Header": "value-{{token}}",
              },
            },
          },
        ],
        dataCorrelation: [
          {
            sourceStep: "auth",
            sourceField: "token",
            targetStep: "secureRequest",
            targetField: "token",
          },
        ],
      };

      const script = generator.generateScript(spec);

      expect(script.content).toContain("workflowData['auth_token']");
      expect(script.content).toContain(
        "Bearer ${workflowData['auth_token'] || 'default_value'}"
      );
      expect(script.content).toContain(
        "value-${workflowData['auth_token'] || 'default_value'}"
      );
    });
  });
});
