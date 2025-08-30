/**
 * Batch Executor - Handles parallel execution of multiple load tests
 *
 * Supports:
 * - Parallel execution of multiple API tests
 * - Sequential execution with dependencies
 * - Result aggregation and reporting
 * - Resource allocation and management
 */

import { LoadTestSpec, BatchTestSpec, BatchTestItem } from "../../types";
import { BasicHttpExecutor } from "./simple-http-executor";
import { K6LoadExecutor } from "./k6-executor";
import { WorkflowExecutor } from "./workflow-executor";
import { ExecutionMetrics } from "../../types/common";

export interface BatchExecutionResult {
  batchId: string;
  status: "completed" | "failed" | "cancelled";
  startTime: Date;
  endTime: Date;
  duration: number;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  results: BatchTestResult[];
  aggregatedMetrics: AggregatedMetrics;
  error?: string; // Add error property
}

export interface BatchTestResult {
  testId: string;
  testName: string;
  status: "completed" | "failed" | "cancelled";
  startTime: Date;
  endTime: Date;
  duration: number;
  metrics: ExecutionMetrics;
  error?: string;
}

export interface AggregatedMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

export class BatchExecutor {
  private simpleExecutor: BasicHttpExecutor;
  private k6Executor: K6LoadExecutor;
  private workflowExecutor: WorkflowExecutor;

  constructor() {
    this.simpleExecutor = new BasicHttpExecutor();
    this.k6Executor = new K6LoadExecutor();
    this.workflowExecutor = new WorkflowExecutor();
  }

  async executeBatch(batchSpec: BatchTestSpec): Promise<BatchExecutionResult> {
    const startTime = new Date();
    const results: BatchTestResult[] = [];
    let successfulTests = 0;
    let failedTests = 0;

    console.log(`🚀 Starting batch execution: ${batchSpec.name}`);
    console.log(
      `📊 Mode: ${batchSpec.executionMode}, Tests: ${batchSpec.tests.length}`
    );

    try {
      if (batchSpec.executionMode === "parallel") {
        // Execute all tests in parallel
        const promises = batchSpec.tests.map((test) =>
          this.executeSingleTest(test, batchSpec)
        );
        const testResults = await Promise.allSettled(promises);

        testResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            results.push(result.value);
            successfulTests++;
          } else {
            const test = batchSpec.tests[index];
            results.push({
              testId: test.id,
              testName: test.name,
              status: "failed",
              startTime: new Date(),
              endTime: new Date(),
              duration: 0,
              metrics: this.createEmptyMetrics(),
              error: result.reason?.message || "Unknown error",
            });
            failedTests++;
          }
        });
      } else {
        // Execute tests sequentially
        for (const test of batchSpec.tests) {
          try {
            const result = await this.executeSingleTest(test, batchSpec);
            results.push(result);
            successfulTests++;
          } catch (error) {
            const failedResult: BatchTestResult = {
              testId: test.id,
              testName: test.name,
              status: "failed",
              startTime: new Date(),
              endTime: new Date(),
              duration: 0,
              metrics: this.createEmptyMetrics(),
              error: error instanceof Error ? error.message : "Unknown error",
            };
            results.push(failedResult);
            failedTests++;
          }
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const aggregatedMetrics = this.aggregateMetrics(results);

      return {
        batchId: batchSpec.id,
        status: failedTests === 0 ? "completed" : "failed",
        startTime,
        endTime,
        duration,
        totalTests: batchSpec.tests.length,
        successfulTests,
        failedTests,
        results,
        aggregatedMetrics,
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        batchId: batchSpec.id,
        status: "failed",
        startTime,
        endTime,
        duration,
        totalTests: batchSpec.tests.length,
        successfulTests,
        failedTests,
        results,
        aggregatedMetrics: this.createEmptyAggregatedMetrics(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async executeSingleTest(
    test: BatchTestItem,
    batchSpec: BatchTestSpec
  ): Promise<BatchTestResult> {
    const startTime = new Date();

    console.log(`🔧 Executing test: ${test.name} (${test.testType})`);

    try {
      // Create a LoadTestSpec from the batch test item
      const loadTestSpec: LoadTestSpec = {
        id: test.id,
        name: test.name,
        description: test.description,
        testType: test.testType,
        requests: test.requests,
        workflow: test.workflow,
        loadPattern: test.loadPattern ||
          batchSpec.globalLoadPattern || { type: "constant", virtualUsers: 1 },
        duration: test.duration ||
          batchSpec.globalDuration || { value: 60, unit: "seconds" },
      };

      // Execute the test using the appropriate executor directly (avoid smart executor to prevent recursion)
      let result;
      if (test.testType === "workflow" || test.workflow) {
        result = await this.workflowExecutor.executeWorkflow(loadTestSpec);
      } else if (
        loadTestSpec.loadPattern.virtualUsers &&
        loadTestSpec.loadPattern.virtualUsers > 50
      ) {
        result = await this.k6Executor.executeLoadTest(loadTestSpec);
      } else {
        result = await this.simpleExecutor.executeLoadTest(loadTestSpec);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Convert result metrics to ExecutionMetrics format
      const metrics: ExecutionMetrics = {
        status: "completed",
        progress: 100,
        currentVUs: 0, // Not available in PerformanceMetrics
        requestsCompleted: result.metrics?.totalRequests || 0,
        requestsPerSecond: result.metrics?.throughput?.requestsPerSecond || 0,
        avgResponseTime: result.metrics?.responseTime?.avg || 0,
        errorRate: result.metrics?.errorRate || 0,
        timestamp: new Date(),
      };

      return {
        testId: test.id,
        testName: test.name,
        status: "completed",
        startTime,
        endTime,
        duration,
        metrics,
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      throw new Error(
        `Test ${test.name} failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private aggregateMetrics(results: BatchTestResult[]): AggregatedMetrics {
    const completedResults = results.filter((r) => r.status === "completed");

    if (completedResults.length === 0) {
      return this.createEmptyAggregatedMetrics();
    }

    const totalRequests = completedResults.reduce(
      (sum, r) => sum + r.metrics.requestsCompleted,
      0
    );
    const successfulRequests = completedResults.reduce(
      (sum, r) => sum + r.metrics.requestsCompleted * (1 - r.metrics.errorRate),
      0
    );
    const failedRequests = totalRequests - successfulRequests;
    const successRate =
      totalRequests > 0 ? successfulRequests / totalRequests : 0;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    // Calculate response time percentiles
    const responseTimes = completedResults
      .flatMap((r) =>
        Array(r.metrics.requestsCompleted).fill(r.metrics.avgResponseTime)
      )
      .sort((a, b) => a - b);

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;
    const minResponseTime = responseTimes.length > 0 ? responseTimes[0] : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0;
    const p50ResponseTime =
      responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.5)]
        : 0;
    const p90ResponseTime =
      responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.9)]
        : 0;
    const p95ResponseTime =
      responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.95)]
        : 0;

    const totalDuration = completedResults.reduce(
      (sum, r) => sum + r.duration,
      0
    );
    const requestsPerSecond =
      totalDuration > 0 ? totalRequests / (totalDuration / 1000) : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      p50ResponseTime,
      p90ResponseTime,
      p95ResponseTime,
      requestsPerSecond,
      errorRate,
    };
  }

  private createEmptyMetrics(): ExecutionMetrics {
    return {
      status: "completed",
      progress: 100,
      currentVUs: 0,
      requestsCompleted: 0,
      requestsPerSecond: 0,
      avgResponseTime: 0,
      errorRate: 0,
      timestamp: new Date(),
    };
  }

  private createEmptyAggregatedMetrics(): AggregatedMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p90ResponseTime: 0,
      p95ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
    };
  }
}
