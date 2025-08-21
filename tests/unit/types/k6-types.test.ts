import { describe, it, expect } from "vitest";
import {
  K6Script,
  K6Options,
  K6Stage,
  ScriptMetadata,
  K6Metrics,
  K6Metric,
  K6Check,
  K6ExecutionResult,
} from "../../../src/types/k6-types";

describe("K6 Types", () => {
  describe("K6Script", () => {
    it("should create a valid K6Script", () => {
      const script: K6Script = {
        id: "test-script-1",
        name: "Test Script",
        content: "export default function() { console.log('test'); }",
        imports: ["http", "check"],
        options: {
          vus: 10,
          duration: "30s",
        },
        metadata: {
          generatedAt: new Date(),
          specId: "spec-1",
          version: "1.0.0",
          description: "Test script",
          tags: ["test", "basic"],
        },
      };

      expect(script.id).toBe("test-script-1");
      expect(script.name).toBe("Test Script");
      expect(script.content).toContain("export default function");
      expect(script.imports).toContain("http");
      expect(script.options.vus).toBe(10);
      expect(script.metadata.version).toBe("1.0.0");
    });

    it("should support complex K6 options", () => {
      const options: K6Options = {
        vus: 50,
        duration: "5m",
        rps: 100,
        stages: [
          { duration: "2m", target: 20 },
          { duration: "5m", target: 20 },
          { duration: "2m", target: 0 },
        ],
        thresholds: {
          http_req_duration: ["p(95)<500"],
          http_req_failed: ["rate<0.1"],
        },
        setupTimeout: "60s",
        teardownTimeout: "60s",
      };

      expect(options.stages).toHaveLength(3);
      expect(options.stages![0].target).toBe(20);
      expect(options.thresholds!.http_req_duration).toContain("p(95)<500");
    });
  });

  describe("K6Stage", () => {
    it("should create valid K6 stages", () => {
      const stage: K6Stage = {
        duration: "10m",
        target: 100,
      };

      expect(stage.duration).toBe("10m");
      expect(stage.target).toBe(100);
    });
  });

  describe("ScriptMetadata", () => {
    it("should contain required metadata fields", () => {
      const metadata: ScriptMetadata = {
        generatedAt: new Date("2024-01-01"),
        specId: "load-test-spec-1",
        version: "2.1.0",
        description: "Load test for API endpoints",
        tags: ["api", "load-test", "production"],
      };

      expect(metadata.specId).toBe("load-test-spec-1");
      expect(metadata.version).toBe("2.1.0");
      expect(metadata.tags).toContain("api");
      expect(metadata.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe("K6Metric", () => {
    it("should create a valid K6 metric", () => {
      const metric: K6Metric = {
        type: "counter",
        contains: "default",
        values: {
          count: 1000,
          rate: 33.33,
          avg: 245.5,
          min: 100.2,
          med: 230.1,
          max: 500.8,
          "p(90)": 350.5,
          "p(95)": 400.2,
          "p(99)": 480.1,
        },
      };

      expect(metric.type).toBe("counter");
      expect(metric.values.count).toBe(1000);
      expect(metric.values["p(95)"]).toBe(400.2);
    });
  });

  describe("K6Check", () => {
    it("should create a valid K6 check result", () => {
      const check: K6Check = {
        name: "status is 200",
        path: "::status is 200",
        id: "check_1",
        passes: 950,
        fails: 50,
      };

      expect(check.name).toBe("status is 200");
      expect(check.passes).toBe(950);
      expect(check.fails).toBe(50);
      expect(check.passes + check.fails).toBe(1000);
    });
  });

  describe("K6Metrics", () => {
    it("should contain all standard K6 metrics", () => {
      const metrics: K6Metrics = {
        checks: {
          "status is 200": {
            name: "status is 200",
            path: "::status is 200",
            id: "check_1",
            passes: 1000,
            fails: 0,
          },
        },
        data_received: {
          type: "counter",
          contains: "data",
          values: {
            count: 1024000,
            rate: 34133.33,
            avg: 0,
            min: 0,
            med: 0,
            max: 0,
            "p(90)": 0,
            "p(95)": 0,
            "p(99)": 0,
          },
        },
        data_sent: {
          type: "counter",
          contains: "data",
          values: {
            count: 50000,
            rate: 1666.67,
            avg: 0,
            min: 0,
            med: 0,
            max: 0,
            "p(90)": 0,
            "p(95)": 0,
            "p(99)": 0,
          },
        },
        http_req_blocked: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 1.2,
            min: 0.5,
            med: 1.1,
            max: 5.2,
            "p(90)": 2.1,
            "p(95)": 2.8,
            "p(99)": 4.1,
          },
        },
        http_req_connecting: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 0.8,
            min: 0.2,
            med: 0.7,
            max: 3.1,
            "p(90)": 1.5,
            "p(95)": 2.0,
            "p(99)": 2.8,
          },
        },
        http_req_duration: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 245.5,
            min: 100.2,
            med: 230.1,
            max: 500.8,
            "p(90)": 350.5,
            "p(95)": 400.2,
            "p(99)": 480.1,
          },
        },
        http_req_failed: {
          type: "rate",
          contains: "default",
          values: {
            count: 0,
            rate: 0.0,
            avg: 0,
            min: 0,
            med: 0,
            max: 0,
            "p(90)": 0,
            "p(95)": 0,
            "p(99)": 0,
          },
        },
        http_req_receiving: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 2.1,
            min: 0.5,
            med: 1.8,
            max: 8.2,
            "p(90)": 3.5,
            "p(95)": 4.2,
            "p(99)": 6.1,
          },
        },
        http_req_sending: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 0.3,
            min: 0.1,
            med: 0.2,
            max: 1.1,
            "p(90)": 0.5,
            "p(95)": 0.7,
            "p(99)": 0.9,
          },
        },
        http_req_tls_handshaking: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 0,
            min: 0,
            med: 0,
            max: 0,
            "p(90)": 0,
            "p(95)": 0,
            "p(99)": 0,
          },
        },
        http_req_waiting: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 243.1,
            min: 98.5,
            med: 228.3,
            max: 495.2,
            "p(90)": 347.8,
            "p(95)": 396.1,
            "p(99)": 475.3,
          },
        },
        http_reqs: {
          type: "counter",
          contains: "default",
          values: {
            count: 1000,
            rate: 33.33,
            avg: 0,
            min: 0,
            med: 0,
            max: 0,
            "p(90)": 0,
            "p(95)": 0,
            "p(99)": 0,
          },
        },
        iteration_duration: {
          type: "trend",
          contains: "time",
          values: {
            count: 1000,
            rate: 0,
            avg: 1247.8,
            min: 1102.1,
            med: 1231.5,
            max: 1502.3,
            "p(90)": 1352.1,
            "p(95)": 1401.8,
            "p(99)": 1481.2,
          },
        },
        iterations: {
          type: "counter",
          contains: "default",
          values: {
            count: 1000,
            rate: 33.33,
            avg: 0,
            min: 0,
            med: 0,
            max: 0,
            "p(90)": 0,
            "p(95)": 0,
            "p(99)": 0,
          },
        },
        vus: {
          type: "gauge",
          contains: "default",
          values: {
            count: 0,
            rate: 0,
            avg: 10,
            min: 10,
            med: 10,
            max: 10,
            "p(90)": 10,
            "p(95)": 10,
            "p(99)": 10,
          },
        },
        vus_max: {
          type: "gauge",
          contains: "default",
          values: {
            count: 0,
            rate: 0,
            avg: 10,
            min: 10,
            med: 10,
            max: 10,
            "p(90)": 10,
            "p(95)": 10,
            "p(99)": 10,
          },
        },
      };

      expect(metrics.checks["status is 200"].passes).toBe(1000);
      expect(metrics.http_req_duration.values.avg).toBe(245.5);
      expect(metrics.http_reqs.values.count).toBe(1000);
      expect(metrics.vus.values.avg).toBe(10);
    });
  });

  describe("K6ExecutionResult", () => {
    it("should create a valid execution result", () => {
      const result: K6ExecutionResult = {
        exitCode: 0,
        stdout:
          "running (30s), 10/10 VUs, 1000 complete and 0 interrupted iterations",
        stderr: "",
        metrics: {
          checks: {},
          data_received: {
            type: "counter",
            contains: "data",
            values: {
              count: 1024000,
              rate: 34133.33,
              avg: 0,
              min: 0,
              med: 0,
              max: 0,
              "p(90)": 0,
              "p(95)": 0,
              "p(99)": 0,
            },
          },
          data_sent: {
            type: "counter",
            contains: "data",
            values: {
              count: 50000,
              rate: 1666.67,
              avg: 0,
              min: 0,
              med: 0,
              max: 0,
              "p(90)": 0,
              "p(95)": 0,
              "p(99)": 0,
            },
          },
          http_req_blocked: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 1.2,
              min: 0.5,
              med: 1.1,
              max: 5.2,
              "p(90)": 2.1,
              "p(95)": 2.8,
              "p(99)": 4.1,
            },
          },
          http_req_connecting: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 0.8,
              min: 0.2,
              med: 0.7,
              max: 3.1,
              "p(90)": 1.5,
              "p(95)": 2.0,
              "p(99)": 2.8,
            },
          },
          http_req_duration: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 245.5,
              min: 100.2,
              med: 230.1,
              max: 500.8,
              "p(90)": 350.5,
              "p(95)": 400.2,
              "p(99)": 480.1,
            },
          },
          http_req_failed: {
            type: "rate",
            contains: "default",
            values: {
              count: 0,
              rate: 0.0,
              avg: 0,
              min: 0,
              med: 0,
              max: 0,
              "p(90)": 0,
              "p(95)": 0,
              "p(99)": 0,
            },
          },
          http_req_receiving: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 2.1,
              min: 0.5,
              med: 1.8,
              max: 8.2,
              "p(90)": 3.5,
              "p(95)": 4.2,
              "p(99)": 6.1,
            },
          },
          http_req_sending: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 0.3,
              min: 0.1,
              med: 0.2,
              max: 1.1,
              "p(90)": 0.5,
              "p(95)": 0.7,
              "p(99)": 0.9,
            },
          },
          http_req_tls_handshaking: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 0,
              min: 0,
              med: 0,
              max: 0,
              "p(90)": 0,
              "p(95)": 0,
              "p(99)": 0,
            },
          },
          http_req_waiting: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 243.1,
              min: 98.5,
              med: 228.3,
              max: 495.2,
              "p(90)": 347.8,
              "p(95)": 396.1,
              "p(99)": 475.3,
            },
          },
          http_reqs: {
            type: "counter",
            contains: "default",
            values: {
              count: 1000,
              rate: 33.33,
              avg: 0,
              min: 0,
              med: 0,
              max: 0,
              "p(90)": 0,
              "p(95)": 0,
              "p(99)": 0,
            },
          },
          iteration_duration: {
            type: "trend",
            contains: "time",
            values: {
              count: 1000,
              rate: 0,
              avg: 1247.8,
              min: 1102.1,
              med: 1231.5,
              max: 1502.3,
              "p(90)": 1352.1,
              "p(95)": 1401.8,
              "p(99)": 1481.2,
            },
          },
          iterations: {
            type: "counter",
            contains: "default",
            values: {
              count: 1000,
              rate: 33.33,
              avg: 0,
              min: 0,
              med: 0,
              max: 0,
              "p(90)": 0,
              "p(95)": 0,
              "p(99)": 0,
            },
          },
          vus: {
            type: "gauge",
            contains: "default",
            values: {
              count: 0,
              rate: 0,
              avg: 10,
              min: 10,
              med: 10,
              max: 10,
              "p(90)": 10,
              "p(95)": 10,
              "p(99)": 10,
            },
          },
          vus_max: {
            type: "gauge",
            contains: "default",
            values: {
              count: 0,
              rate: 0,
              avg: 10,
              min: 10,
              med: 10,
              max: 10,
              "p(90)": 10,
              "p(95)": 10,
              "p(99)": 10,
            },
          },
        },
        duration: 30000,
      };

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1000 complete");
      expect(result.stderr).toBe("");
      expect(result.duration).toBe(30000);
      expect(result.metrics.http_reqs.values.count).toBe(1000);
    });

    it("should handle failed execution", () => {
      const result: K6ExecutionResult = {
        exitCode: 1,
        stdout: "",
        stderr: "Error: Connection refused",
        metrics: {} as K6Metrics,
        duration: 5000,
      };

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Connection refused");
      expect(result.duration).toBe(5000);
    });
  });
});
