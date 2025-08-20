import {
  LoadTestWorkflowOrchestrator,
  OrchestratorConfig,
  WorkflowState,
} from "@/core/orchestrator";
import { UnifiedCommandParser } from "@/core/parser";
import { ScriptGenerator } from "@/core/generator";
import { ScriptExecutor } from "@/core/executor";
import { LoadTestSpec, TestResult, K6Script, RawResults } from "@/types";
import { BehaviorSubject } from "rxjs";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../parser/command-parser");
vi.mock("../../generator/script-generator");
vi.mock("../../executor/script-executor");

describe("LoadTestWorkflowOrchestrator", () => {
  let orchestrator: LoadTestWorkflowOrchestrator;
  let mockParser: any;
  let mockGenerator: any;
  let mockExecutor: any;
  let config: OrchestratorConfig;

  const mockLoadTestSpec: LoadTestSpec = {
    id: "test-spec-1",
    name: "Test Load Test",
    description: "A test load test specification",
    testType: "baseline",
    requests: [
      {
        method: "GET",
        url: "https://api.example.com/test",
        headers: { "Content-Type": "application/json" },
      },
    ],
    loadPattern: {
      type: "constant",
      virtualUsers: 10,
    },
    duration: { value: 30, unit: "seconds" },
  };

  const mockK6Script: K6Script = {
    id: "script-1",
    name: "Test Script",
    content:
      'import http from "k6/http"; export default function() { http.get("https://api.example.com/test"); }',
    imports: [],
    options: { vus: 10, duration: "30s" },
    metadata: {
      generatedAt: new Date(),
      specId: "test-spec-1",
      version: "1.0.0",
      description: "Test script",
      tags: ["test"],
    },
  };

  const mockRawResults: RawResults = {
    k6Output: {
      metrics: {
        http_reqs: { values: { count: 100 } },
        http_req_duration: { values: { avg: 250 } },
        http_req_failed: { values: { rate: 0.05 } },
      },
    },
    executionLogs: ["Test execution completed"],
    systemMetrics: [],
  };

  beforeEach(() => {
    config = {
      maxConcurrentTests: 2,
      defaultTimeout: 30000,
      retryAttempts: 3,
      historyLimit: 10,
      stepTimeout: 10000,
      enableWorkflowRecovery: true,
      maxWorkflowRetries: 2,
    };

    mockParser = {
      parseCommand: vi.fn(),
      validateSpec: vi.fn(),
      suggestCorrections: vi.fn(),
    } as any;

    mockGenerator = {
      generateScript: vi.fn(),
      generatePayloadTemplate: vi.fn(),
      validateScript: vi.fn(),
    } as any;

    mockExecutor = {
      executeScript: vi.fn(),
      monitorExecution: vi.fn(),
      stopExecution: vi.fn(),
    } as any;

    orchestrator = new LoadTestWorkflowOrchestrator(
      config,
      mockParser,
      mockGenerator,
      mockExecutor
    );
  });

  describe("executeLoadTest", () => {
    it("should successfully execute a complete workflow", async () => {
      // Setup mocks
      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      const result = await orchestrator.executeLoadTest(mockLoadTestSpec);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.spec).toEqual(mockLoadTestSpec);
      expect(result.status).toBe("completed");
      expect(mockParser.validateSpec).toHaveBeenCalledWith(mockLoadTestSpec);
      expect(mockGenerator.generateScript).toHaveBeenCalledWith(
        mockLoadTestSpec
      );
      expect(mockExecutor.executeScript).toHaveBeenCalledWith(mockK6Script);
    });

    it("should handle validation failures with retry", async () => {
      // First call fails, second succeeds
      mockParser.validateSpec
        .mockReturnValueOnce({
          isValid: false,
          errors: ["Invalid URL"],
          warnings: [],
        })
        .mockReturnValueOnce({ isValid: true, errors: [], warnings: [] });

      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      const result = await orchestrator.executeLoadTest(mockLoadTestSpec);

      expect(result.status).toBe("completed");
      expect(mockParser.validateSpec).toHaveBeenCalledTimes(2);
    });

    it("should handle script generation failures with fallback", async () => {
      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockImplementation(() => {
        throw new Error("Script generation failed");
      });
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      const result = await orchestrator.executeLoadTest(mockLoadTestSpec);

      expect(result.status).toBe("completed");
      expect(
        result.errors.some((e) => e.errorMessage.includes("fallback"))
      ).toBe(true);
    });

    it("should handle execution failures", async () => {
      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockRejectedValue(
        new Error("Execution failed")
      );
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "failed",
          progress: 0,
          currentVUs: 0,
          requestsCompleted: 0,
          requestsPerSecond: 0,
          avgResponseTime: 0,
          errorRate: 1,
          timestamp: new Date(),
        })
      );

      await expect(
        orchestrator.executeLoadTest(mockLoadTestSpec)
      ).rejects.toThrow("Workflow failed at phase executing");
    });

    it("should handle multi-step workflow scenarios", async () => {
      const workflowSpec: LoadTestSpec = {
        ...mockLoadTestSpec,
        workflow: [
          {
            id: "step1",
            name: "Login",
            request: {
              method: "POST",
              url: "https://api.example.com/login",
              payload: {
                template:
                  '{"username": "{{username}}", "password": "{{password}}"}',
                variables: [],
              },
            },
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
            id: "step2",
            name: "Get Data",
            request: {
              method: "GET",
              url: "https://api.example.com/data",
              headers: { Authorization: "Bearer {{authToken}}" },
            },
          },
        ],
        dataCorrelation: [
          {
            sourceStep: "step1",
            sourceField: "authToken",
            targetStep: "step2",
            targetField: "authToken",
          },
        ],
      };

      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      const result = await orchestrator.executeLoadTest(workflowSpec);

      expect(result.status).toBe("completed");
      // Verify workflow state was initialized
      expect(mockGenerator.generateScript).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: expect.arrayContaining([
            expect.objectContaining({ id: "step1", name: "Login" }),
            expect.objectContaining({ id: "step2", name: "Get Data" }),
          ]),
        })
      );
    });
  });

  describe("cancelTest", () => {
    it("should cancel a running test", async () => {
      // Create a test execution first
      const testExecution = {
        id: "test-execution-1",
        spec: mockLoadTestSpec,
        status: "running" as const,
        startTime: new Date(),
        progress: 50,
        currentPhase: "executing",
        retryCount: 0,
        errors: [],
      };

      // Mock the active executions map
      (orchestrator as any).activeExecutions.set(
        testExecution.id,
        testExecution
      );
      mockExecutor.stopExecution.mockResolvedValue();

      await orchestrator.cancelTest(testExecution.id);

      expect(mockExecutor.stopExecution).toHaveBeenCalled();
      expect(testExecution.status).toBe("cancelled");
    });

    it("should throw error for non-existent test", async () => {
      await expect(orchestrator.cancelTest("non-existent-id")).rejects.toThrow(
        "Test execution not found"
      );
    });
  });

  describe("monitorProgress", () => {
    it("should provide progress updates during execution", async () => {
      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      const progressUpdates: any[] = [];
      const subscription = orchestrator
        .monitorProgress()
        .subscribe((update) => {
          progressUpdates.push(update);
        });

      await orchestrator.executeLoadTest(mockLoadTestSpec);
      subscription.unsubscribe();

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(
        progressUpdates.some((update) => update.currentPhase === "validation")
      ).toBe(true);
      expect(
        progressUpdates.some((update) => update.currentPhase === "generation")
      ).toBe(true);
      expect(
        progressUpdates.some((update) => update.currentPhase === "executing")
      ).toBe(true);
    });
  });

  describe("getTestHistory", () => {
    it("should maintain test history", async () => {
      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      await orchestrator.executeLoadTest(mockLoadTestSpec);

      const history = orchestrator.getTestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].spec).toEqual(mockLoadTestSpec);
      expect(history[0].status).toBe("completed");
    });

    it("should limit history size", async () => {
      const smallConfig = { ...config, historyLimit: 2 };
      const smallOrchestrator = new LoadTestWorkflowOrchestrator(
        smallConfig,
        mockParser,
        mockGenerator,
        mockExecutor
      );

      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      // Execute 3 tests
      for (let i = 0; i < 3; i++) {
        await smallOrchestrator.executeLoadTest({
          ...mockLoadTestSpec,
          id: `test-${i}`,
          name: `Test ${i}`,
        });
      }

      const history = smallOrchestrator.getTestHistory();
      expect(history).toHaveLength(2); // Should be limited to 2
    });
  });

  describe("concurrent execution limits", () => {
    it.skip("should queue tests when max concurrent limit is reached", async () => {
      const limitedConfig = { ...config, maxConcurrentTests: 1 };
      const limitedOrchestrator = new LoadTestWorkflowOrchestrator(
        limitedConfig,
        mockParser,
        mockGenerator,
        mockExecutor
      );

      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      // Mock faster execution to avoid timeout
      mockExecutor.executeScript.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockRawResults), 100)
          )
      );
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      // Start two tests simultaneously
      const promise1 = limitedOrchestrator.executeLoadTest({
        ...mockLoadTestSpec,
        id: "test-1",
        name: "Test 1",
      });

      const promise2 = limitedOrchestrator.executeLoadTest({
        ...mockLoadTestSpec,
        id: "test-2",
        name: "Test 2",
      });

      const results = await Promise.all([promise1, promise2]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("completed");
      expect(results[1].status).toBe("completed");
    });
  });

  describe("error recovery mechanisms", () => {
    it("should recover from transient validation errors", async () => {
      let validationCallCount = 0;
      mockParser.validateSpec.mockImplementation(() => {
        validationCallCount++;
        if (validationCallCount === 1) {
          return { isValid: false, errors: ["Transient error"], warnings: [] };
        }
        return { isValid: true, errors: [], warnings: [] };
      });

      mockGenerator.generateScript.mockReturnValue(mockK6Script);
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      const result = await orchestrator.executeLoadTest(mockLoadTestSpec);

      expect(result.status).toBe("completed");
      expect(mockParser.validateSpec).toHaveBeenCalledTimes(2);
      expect(
        result.errors.some((e) => e.errorMessage.includes("recovered"))
      ).toBe(true);
    });

    it("should use fallback when generation fails repeatedly", async () => {
      mockParser.validateSpec.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockGenerator.generateScript.mockImplementation(() => {
        throw new Error("Persistent generation error");
      });
      mockGenerator.validateScript.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockExecutor.executeScript.mockResolvedValue(mockRawResults);
      mockExecutor.monitorExecution.mockReturnValue(
        new BehaviorSubject({
          status: "running",
          progress: 50,
          currentVUs: 10,
          requestsCompleted: 50,
          requestsPerSecond: 5,
          avgResponseTime: 250,
          errorRate: 0.05,
          timestamp: new Date(),
        })
      );

      const result = await orchestrator.executeLoadTest(mockLoadTestSpec);

      expect(result.status).toBe("completed");
      expect(
        result.errors.some((e) => e.errorMessage.includes("fallback"))
      ).toBe(true);
    });
  });
});
