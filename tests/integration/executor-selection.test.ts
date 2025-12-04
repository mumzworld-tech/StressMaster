/**
 * Integration Tests for Executor Selection
 * Tests the executor selection logic with various scenarios
 */

import { describe, it, expect } from "vitest";
import { ExecutorSelectionService } from "../../src/services/executor-selection.service";
import { LoadTestSpec } from "../../src/types";

describe("Executor Selection Service", () => {
  describe("Simple Executor Selection", () => {
    it("should select Simple Executor for small tests", () => {
      const spec: LoadTestSpec = {
        id: "test-1",
        name: "Small Test",
        description: "Small load test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("simple");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should select Simple Executor for quick tests", () => {
      const spec: LoadTestSpec = {
        id: "test-2",
        name: "Quick Test",
        description: "Quick test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 5,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("simple");
    });
  });

  describe("K6 Executor Selection", () => {
    it("should select K6 Executor for large request counts", () => {
      const spec: LoadTestSpec = {
        id: "test-3",
        name: "Large Test",
        description: "Large load test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 100,
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("k6");
      expect(result.metrics.requiresK6).toBe(true);
    });

    it("should select K6 Executor for complex load patterns", () => {
      const spec: LoadTestSpec = {
        id: "test-4",
        name: "Spike Test",
        description: "Spike load test",
        testType: "spike",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        loadPattern: {
          type: "spike",
          virtualUsers: 50,
          rampUpTime: {
            value: 10,
            unit: "seconds",
          },
          plateauTime: {
            value: 30,
            unit: "seconds",
          },
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("k6");
      expect(result.metrics.loadPatternComplexity).toBeGreaterThan(30);
    });

    it("should select K6 Executor for stress tests", () => {
      const spec: LoadTestSpec = {
        id: "test-5",
        name: "Stress Test",
        description: "Stress test",
        testType: "stress",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 20,
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("k6");
    });
  });

  describe("Workflow Executor Selection", () => {
    it("should select Workflow Executor for workflow tests", () => {
      const spec: LoadTestSpec = {
        id: "test-6",
        name: "Workflow Test",
        description: "Workflow test",
        testType: "workflow",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        workflow: [
          {
            id: "step1",
            name: "Step 1",
            type: "sequential",
            steps: [
              {
                method: "GET",
                url: "https://api.example.com/step1",
                requestCount: 1,
              },
            ],
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 5,
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("workflow");
    });

    it("should select K6 Executor for complex workflow tests", () => {
      const spec: LoadTestSpec = {
        id: "test-7",
        name: "Complex Workflow",
        description: "Complex workflow",
        testType: "workflow",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        workflow: [
          {
            id: "step1",
            name: "Step 1",
            type: "sequential",
            steps: [
              {
                method: "GET",
                url: "https://api.example.com/step1",
                requestCount: 100,
              },
            ],
          },
        ],
        loadPattern: {
          type: "spike",
          virtualUsers: 50,
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("k6");
    });
  });

  describe("Batch Executor Selection", () => {
    it("should select Batch Executor for batch tests", () => {
      const spec: LoadTestSpec = {
        id: "test-8",
        name: "Batch Test",
        description: "Batch test",
        testType: "batch",
        requests: [],
        loadPattern: {
          type: "constant",
          virtualUsers: 1,
        },
        batch: {
          id: "batch-1",
          name: "Test Batch",
          description: "Test batch description",
          tests: [
            {
              id: "test-1",
              name: "Test 1",
              description: "Test 1",
              testType: "baseline",
              requests: [
                {
                  method: "GET",
                  url: "https://api.example.com",
                },
              ],
              loadPattern: {
                type: "constant",
                virtualUsers: 10,
              },
            },
          ],
          executionMode: "parallel",
          aggregationMode: "combined",
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.executorType).toBe("batch");
    });
  });

  describe("Metrics Calculation", () => {
    it("should calculate load pattern complexity correctly", () => {
      const spec: LoadTestSpec = {
        id: "test-9",
        name: "Complex Pattern",
        description: "Complex pattern",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com",
          },
        ],
        loadPattern: {
          type: "spike",
          virtualUsers: 50,
          rampUpTime: {
            value: 10,
            unit: "seconds",
          },
          plateauTime: {
            value: 30,
            unit: "seconds",
          },
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.metrics.loadPatternComplexity).toBeGreaterThan(30);
      expect(result.metrics.loadPatternComplexity).toBeLessThanOrEqual(100);
    });

    it("should calculate test complexity correctly", () => {
      const spec: LoadTestSpec = {
        id: "test-10",
        name: "Stress Test",
        description: "Stress test",
        testType: "stress",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com",
            payload: {
              template: '{"name":"{{name}}"}',
              variables: [
                {
                  name: "name",
                  type: "random_string",
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 20,
        },
      };

      const result = ExecutorSelectionService.selectExecutor(spec);
      expect(result.metrics.testComplexity).toBeGreaterThan(50);
    });
  });
});
