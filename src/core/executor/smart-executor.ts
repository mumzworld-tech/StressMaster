import { LoadTestSpec, TestResult } from "../../types";
import { BasicHttpExecutor } from "./simple-http-executor";
import { K6LoadExecutor } from "./k6-executor";
import { WorkflowExecutor } from "./workflow-executor";
import { BatchExecutor } from "./batch-executor";
import { EnhancedBatchExecutor } from "./batch";

export interface SmartExecutor {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
}

export class SmartLoadExecutor implements SmartExecutor {
  private simpleExecutor: BasicHttpExecutor;
  private k6Executor: K6LoadExecutor;
  private workflowExecutor: WorkflowExecutor;
  private batchExecutor: BatchExecutor;
  private enhancedBatchExecutor: EnhancedBatchExecutor;

  constructor() {
    this.simpleExecutor = new BasicHttpExecutor();
    this.k6Executor = new K6LoadExecutor();
    this.workflowExecutor = new WorkflowExecutor();
    this.batchExecutor = new BatchExecutor();
    this.enhancedBatchExecutor = new EnhancedBatchExecutor();
  }

  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const executorType = this.selectExecutor(spec);

    console.log(`🤖 Using ${executorType} executor for this test`);

    if (executorType === "batch") {
      return await this.executeBatchTest(spec);
    } else if (executorType === "workflow") {
      return await this.workflowExecutor.executeWorkflow(spec);
    } else if (executorType === "simple") {
      return await this.simpleExecutor.executeLoadTest(spec);
    } else {
      try {
        return await this.k6Executor.executeLoadTest(spec);
      } catch (error) {
        console.log(
          `⚠️  K6 executor failed, falling back to simple executor: ${error}`
        );
        console.log(`⚡ Using simple executor as fallback`);
        return await this.simpleExecutor.executeLoadTest(spec);
      }
    }
  }

  private async executeBatchTest(spec: LoadTestSpec): Promise<TestResult> {
    if (!spec.batch) {
      throw new Error("Batch specification is required for batch tests");
    }

    console.log(`🚀 Executing batch test: ${spec.batch.name}`);
    console.log(
      `📊 Batch mode: ${spec.batch.executionMode}, Tests: ${spec.batch.tests.length}`
    );

    const batchResult = await this.enhancedBatchExecutor.executeBatch(
      spec.batch
    );

    // Convert batch result to TestResult format
    return {
      id: spec.id,
      spec: spec,
      status:
        batchResult.status === "partial" ? "completed" : batchResult.status,
      startTime: batchResult.startTime,
      endTime: batchResult.endTime,
      metrics: {
        totalRequests: batchResult.aggregatedMetrics.totalRequests,
        successfulRequests: batchResult.aggregatedMetrics.successfulRequests,
        failedRequests: batchResult.aggregatedMetrics.failedRequests,
        responseTime: {
          min: batchResult.aggregatedMetrics.minResponseTime,
          max: batchResult.aggregatedMetrics.maxResponseTime,
          avg: batchResult.aggregatedMetrics.averageResponseTime,
          p50: batchResult.aggregatedMetrics.p50ResponseTime,
          p90: batchResult.aggregatedMetrics.p90ResponseTime,
          p95: batchResult.aggregatedMetrics.p95ResponseTime,
          p99: batchResult.aggregatedMetrics.p95ResponseTime, // Use p95 as p99 approximation
        },
        throughput: {
          requestsPerSecond: batchResult.aggregatedMetrics.requestsPerSecond,
          bytesPerSecond: 0, // Not available in batch results
        },
        errorRate: batchResult.aggregatedMetrics.errorRate,
      },
      errors: [], // No detailed error summary in batch results
      recommendations: this.generateBatchRecommendations(batchResult),
      rawData: {
        k6Output: null,
        executionLogs: [
          `Batch execution completed with ${batchResult.successfulTests}/${batchResult.totalTests} successful tests`,
        ],
        systemMetrics: [],
      },
    };
  }

  private generateBatchRecommendations(batchResult: any): string[] {
    const recommendations = [];

    if (batchResult.failedTests > 0) {
      recommendations.push(
        `⚠️ ${batchResult.failedTests} out of ${batchResult.totalTests} tests failed`
      );
    }

    if (batchResult.aggregatedMetrics.successRate < 0.95) {
      recommendations.push(
        "📉 Overall success rate is below 95% - consider investigating failures"
      );
    }

    if (batchResult.aggregatedMetrics.avgResponseTime > 1000) {
      recommendations.push(
        "🐌 Average response time is high - consider performance optimization"
      );
    }

    recommendations.push(
      `✅ Batch execution completed with ${batchResult.successfulTests}/${batchResult.totalTests} successful tests`
    );

    return recommendations;
  }

  private selectExecutor(
    spec: LoadTestSpec
  ): "simple" | "k6" | "workflow" | "batch" {
    // Check if this is a batch test
    if (spec.testType === "batch" || spec.batch) {
      console.log(
        `📦 Batch executor selected: ${spec.batch?.tests.length || 0} tests, ${
          spec.batch?.executionMode || "parallel"
        } mode`
      );
      return "batch";
    }

    const requestCount = spec.loadPattern.virtualUsers || 1;
    const loadPatternType = spec.loadPattern.type;
    const testType = spec.testType;

    // Check if this is a workflow test
    const isWorkflowTest =
      testType === "workflow" || (spec.workflow && spec.workflow.length > 0);

    // For workflow tests, check if they have complex load patterns that warrant K6
    if (isWorkflowTest) {
      // Calculate total requests from workflow steps
      let totalWorkflowRequests = 0;
      if (spec.workflow && spec.workflow.length > 0) {
        for (const workflowStep of spec.workflow) {
          if (workflowStep.steps && Array.isArray(workflowStep.steps)) {
            for (const step of workflowStep.steps) {
              if (
                "requestCount" in step &&
                typeof step.requestCount === "number"
              ) {
                totalWorkflowRequests += step.requestCount;
              }
            }
          }
        }
      }

      // Check if workflow has complex load patterns that should use K6
      const hasComplexLoadPattern =
        requestCount > 50 ||
        totalWorkflowRequests > 50 ||
        ["spike", "ramp-up", "random-burst"].includes(loadPatternType) ||
        testType === "stress" ||
        testType === "endurance" ||
        testType === "volume";

      if (hasComplexLoadPattern) {
        console.log(
          `📊 K6 selected for workflow: ${requestCount} global requests, ${totalWorkflowRequests} total workflow requests, ${loadPatternType} pattern, ${testType} test`
        );
        return "k6";
      } else {
        console.log(
          `🔄 Workflow executor selected: ${testType} test with ${
            spec.workflow?.length || 0
          } workflow steps, ${totalWorkflowRequests} total requests`
        );
        return "workflow";
      }
    }

    // Use K6 executor for non-workflow tests with:
    // 1. Large request counts (>50)
    // 2. Complex load patterns (spike, ramp-up, random-burst)
    // 3. High-volume tests
    // 4. Stress/endurance tests

    const shouldUseK6 =
      requestCount > 50 ||
      ["spike", "ramp-up", "random-burst"].includes(loadPatternType) ||
      testType === "stress" ||
      testType === "endurance" ||
      testType === "volume";

    if (shouldUseK6) {
      console.log(
        `📊 K6 selected: ${requestCount} requests, ${loadPatternType} pattern, ${testType} test`
      );
      return "k6";
    } else {
      console.log(
        `⚡ Simple executor selected: ${requestCount} requests, ${loadPatternType} pattern, ${testType} test`
      );
      return "simple";
    }
  }
}
