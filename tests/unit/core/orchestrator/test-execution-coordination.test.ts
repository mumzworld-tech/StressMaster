import {
  LoadTestWorkflowOrchestrator,
  OrchestratorConfig,
} from "@/core/orchestrator";
import { UnifiedCommandParser } from "@/core/parser";
import { ScriptGenerator } from "@/core/generator";
import { ScriptExecutor } from "@/core/executor";
import { LoadTestSpec, K6Script, RawResults } from "@/types";
import { BehaviorSubject } from "rxjs";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("../../parser/command-parser");
vi.mock("../../generator/script-generator");
vi.mock("../../executor/script-executor");

describe("LoadTestWorkflowOrchestrator - Test Execution Coordination", () => {
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
    };

    mockGenerator = {
      generateScript: vi.fn(),
      generatePayloadTemplate: vi.fn(),
      validateScript: vi.fn(),
    };

    mockExecutor = {
      executeScript: vi.fn(),
      monitorExecution: vi.fn(),
      stopExecution: vi.fn(),
    };

    orchestrator = new LoadTestWorkflowOrchestrator(
      config,
      mockParser,
      mockGenerator,
      mockExecutor
    );
  });

  afterEach(() => {
    orchestrator.dispose();
  });

  describe("Queue Management", () => {
    it("should provide queue status information", () => {
      const status = orchestrator.getQueueStatus();

      expect(status).toEqual({
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        totalCapacity: 2,
        availableSlots: 2,
      });
    });

    it.skip("should manage concurrent test limits", async () => {
      // Setup mocks for successful execution
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

      // Start multiple tests
      const promises = [
        orchestrator.executeLoadTest({
          ...mockLoadTestSpec,
          id: "test-1",
          name: "Test 1",
        }),
        orchestrator.executeLoadTest({
          ...mockLoadTestSpec,
          id: "test-2",
          name: "Test 2",
        }),
        orchestrator.executeLoadTest({
          ...mockLoadTestSpec,
          id: "test-3",
          name: "Test 3",
        }),
      ];

      // Check queue status during execution
      await new Promise((resolve) => setTimeout(resolve, 50));
      const statusDuringExecution = orchestrator.getQueueStatus();

      expect(statusDuringExecution.running).toBeLessThanOrEqual(2);
      expect(
        statusDuringExecution.pending + statusDuringExecution.running
      ).toBe(3);

      await Promise.all(promises);

      // Wait a bit for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalStatus = orchestrator.getQueueStatus();
      expect(finalStatus.running).toBe(0);
      expect(finalStatus.completed).toBe(3);
    });

    it("should provide access to running tests", async () => {
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
      mockExecutor.executeScript.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockRawResults), 200)
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

      const executionPromise = orchestrator.executeLoadTest(mockLoadTestSpec);

      // Wait a bit for execution to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      const runningTests = orchestrator.getRunningTests();
      expect(runningTests.length).toBe(1);
      expect(runningTests[0].spec.name).toBe("Test Load Test");

      await executionPromise;

      const runningTestsAfter = orchestrator.getRunningTests();
      expect(runningTestsAfter.length).toBe(0);
    });

    it("should provide access to pending tests", () => {
      // Create test executions manually to test pending queue
      const testExecution = {
        id: "test-1",
        spec: mockLoadTestSpec,
        status: "queued" as const,
        startTime: new Date(),
        progress: 0,
        currentPhase: "queued",
        retryCount: 0,
        errors: [],
      };

      // Access private queue to add test
      (orchestrator as any).executionQueue.pending.push(testExecution);

      const pendingTests = orchestrator.getPendingTests();
      expect(pendingTests.length).toBe(1);
      expect(pendingTests[0].id).toBe("test-1");
    });

    it("should find tests by ID", async () => {
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
      const foundTest = orchestrator.getTestById(result.id);

      expect(foundTest).toBeDefined();
      expect(foundTest?.id).toBe(result.id);
    });
  });

  describe("Test History Management", () => {
    beforeEach(async () => {
      // Setup successful execution mocks
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

      // Execute some tests to populate history
      await orchestrator.executeLoadTest({
        ...mockLoadTestSpec,
        id: "test-1",
        name: "Successful Test",
        testType: "baseline",
      });

      // Mock a failed test
      mockExecutor.executeScript.mockRejectedValueOnce(
        new Error("Execution failed")
      );
      try {
        await orchestrator.executeLoadTest({
          ...mockLoadTestSpec,
          id: "test-2",
          name: "Failed Test",
          testType: "stress",
        });
      } catch (error) {
        // Expected to fail
      }
    });

    it("should search test history by criteria", () => {
      const successfulTests = orchestrator.searchTestHistory({
        status: "completed",
      });
      expect(successfulTests.length).toBe(1);
      expect(successfulTests[0].spec.name).toBe("Successful Test");

      const failedTests = orchestrator.searchTestHistory({
        status: "failed",
      });
      expect(failedTests.length).toBe(1);
      expect(failedTests[0].spec.name).toBe("Failed Test");

      const baselineTests = orchestrator.searchTestHistory({
        testType: "baseline",
      });
      expect(baselineTests.length).toBe(1);

      const testsByName = orchestrator.searchTestHistory({
        testName: "successful",
      });
      expect(testsByName.length).toBe(1);
    });

    it.skip("should provide test statistics", () => {
      const stats = orchestrator.getTestStatistics();

      expect(stats.totalTests).toBe(2);
      expect(stats.successfulTests).toBe(1);
      expect(stats.failedTests).toBe(1);
      expect(stats.cancelledTests).toBe(0);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
      expect(stats.averageSuccessRate).toBeGreaterThan(0);
    });

    it("should handle empty history statistics", () => {
      // Create new orchestrator with no history
      const emptyOrchestrator = new LoadTestWorkflowOrchestrator(
        config,
        mockParser,
        mockGenerator,
        mockExecutor
      );

      const stats = emptyOrchestrator.getTestStatistics();

      expect(stats.totalTests).toBe(0);
      expect(stats.successfulTests).toBe(0);
      expect(stats.failedTests).toBe(0);
      expect(stats.cancelledTests).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.averageSuccessRate).toBe(0);

      emptyOrchestrator.dispose();
    });
  });

  describe("Progress Aggregation", () => {
    it("should provide detailed progress information", async () => {
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
      mockExecutor.executeScript.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockRawResults), 200)
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

      const executionPromise = orchestrator.executeLoadTest(mockLoadTestSpec);

      // Wait for execution to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      const detailedProgress = orchestrator.getDetailedProgress();

      expect(detailedProgress.queueStatus).toBeDefined();
      expect(detailedProgress.runningTests).toBeDefined();
      expect(detailedProgress.recentCompletions).toBeDefined();
      expect(detailedProgress.systemHealth).toBeDefined();

      expect(detailedProgress.runningTests.length).toBe(1);
      expect(detailedProgress.runningTests[0].name).toBe("Test Load Test");
      expect(detailedProgress.systemHealth.memoryUsage).toBeGreaterThanOrEqual(
        0
      );
      expect(
        detailedProgress.systemHealth.activeConnections
      ).toBeGreaterThanOrEqual(0);

      await executionPromise;

      const finalProgress = orchestrator.getDetailedProgress();
      expect(finalProgress.runningTests.length).toBe(0);
      expect(finalProgress.recentCompletions.length).toBe(1);
    });

    it.skip("should aggregate progress across multiple running tests", async () => {
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
      mockExecutor.executeScript.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockRawResults), 300)
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

      // Start multiple tests
      const promises = [
        orchestrator.executeLoadTest({
          ...mockLoadTestSpec,
          id: "test-1",
          name: "Test 1",
        }),
        orchestrator.executeLoadTest({
          ...mockLoadTestSpec,
          id: "test-2",
          name: "Test 2",
        }),
      ];

      // Wait for tests to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      const progressUpdates: any[] = [];
      const subscription = orchestrator
        .monitorProgress()
        .subscribe((update) => {
          progressUpdates.push(update);
        });

      // Wait longer for progress aggregation to occur
      await new Promise((resolve) => setTimeout(resolve, 600));

      subscription.unsubscribe();

      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Check for aggregate progress messages or multiple running tests
      const aggregateUpdates = progressUpdates.filter(
        (update) =>
          update.message.includes("tests running") ||
          update.message.includes("Test 1") ||
          update.message.includes("Test 2")
      );
      expect(aggregateUpdates.length).toBeGreaterThan(0);

      await Promise.all(promises);
    });
  });

  describe("Queue Processing", () => {
    it("should process execution queue automatically", async () => {
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

      // Add tests to queue manually to test queue processing
      const testExecution1 = {
        id: "test-1",
        spec: { ...mockLoadTestSpec, id: "test-1", name: "Test 1" },
        status: "queued" as const,
        startTime: new Date(),
        progress: 0,
        currentPhase: "queued",
        retryCount: 0,
        errors: [],
      };

      const testExecution2 = {
        id: "test-2",
        spec: { ...mockLoadTestSpec, id: "test-2", name: "Test 2" },
        status: "queued" as const,
        startTime: new Date(),
        progress: 0,
        currentPhase: "queued",
        retryCount: 0,
        errors: [],
      };

      // Access private queue to add tests
      (orchestrator as any).executionQueue.pending.push(
        testExecution1,
        testExecution2
      );
      (orchestrator as any).activeExecutions.set(
        testExecution1.id,
        testExecution1
      );
      (orchestrator as any).activeExecutions.set(
        testExecution2.id,
        testExecution2
      );

      // Wait for queue processor to run
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const queueStatus = orchestrator.getQueueStatus();
      expect(queueStatus.running).toBeGreaterThan(0);
      expect(queueStatus.pending + queueStatus.running).toBeLessThanOrEqual(2);
    });

    it("should clean up old completed executions", async () => {
      // Create old completed execution
      const oldExecution = {
        id: "old-test",
        spec: mockLoadTestSpec,
        status: "completed" as const,
        startTime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        endTime: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000), // Just over 24 hours ago
        progress: 100,
        currentPhase: "completed",
        retryCount: 0,
        errors: [],
      };

      // Add to completed queue
      (orchestrator as any).executionQueue.completed.push(oldExecution);

      const initialCompleted = orchestrator.getCompletedTests();
      expect(initialCompleted.length).toBe(1);

      // Wait for queue processor to clean up
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const finalCompleted = orchestrator.getCompletedTests();
      expect(finalCompleted.length).toBe(0);
    });
  });

  describe("Disposal and Cleanup", () => {
    it("should properly dispose of resources", () => {
      const queueProcessor = (orchestrator as any).queueProcessor;
      const progressAggregator = (orchestrator as any).progressAggregator;

      expect(queueProcessor).not.toBeNull();
      expect(progressAggregator).not.toBeNull();

      orchestrator.dispose();

      expect((orchestrator as any).queueProcessor).toBeNull();
      expect((orchestrator as any).progressAggregator).toBeNull();
    });

    it("should cancel running tests on disposal", () => {
      // Add a running test
      const runningTest = {
        id: "running-test",
        spec: mockLoadTestSpec,
        status: "running" as const,
        startTime: new Date(),
        progress: 50,
        currentPhase: "executing",
        retryCount: 0,
        errors: [],
      };

      (orchestrator as any).executionQueue.running.push(runningTest);
      (orchestrator as any).activeExecutions.set(runningTest.id, runningTest);

      orchestrator.dispose();

      expect(runningTest.status).toBe("cancelled");
      expect(runningTest.endTime).toBeDefined();
      expect((orchestrator as any).activeExecutions.size).toBe(0);
    });
  });
});
