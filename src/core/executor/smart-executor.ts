import { LoadTestSpec, TestResult } from "../../types";
import { BasicHttpExecutor } from "./simple-http-executor";
import { K6LoadExecutor } from "./k6-executor";
import { WorkflowExecutor } from "./workflow-executor";
import { BatchExecutor } from "./batch-executor";
import { EnhancedBatchExecutor } from "./batch";
import {
  ExecutorSelectionService,
  ExecutorSelectionResult,
} from "../../services/executor-selection.service";
import chalk from "chalk";
import { createLogger } from "../../utils/logger";

export interface SmartExecutor {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
}

export class SmartLoadExecutor implements SmartExecutor {
  private simpleExecutor: BasicHttpExecutor;
  private k6Executor: K6LoadExecutor;
  private workflowExecutor: WorkflowExecutor;
  private batchExecutor: BatchExecutor;
  private enhancedBatchExecutor: EnhancedBatchExecutor;
  private logger = createLogger({ component: "SmartLoadExecutor" });

  constructor() {
    this.simpleExecutor = new BasicHttpExecutor();
    this.k6Executor = new K6LoadExecutor();
    this.workflowExecutor = new WorkflowExecutor();
    this.batchExecutor = new BatchExecutor();
    this.enhancedBatchExecutor = new EnhancedBatchExecutor();
  }

  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const selection = ExecutorSelectionService.selectExecutor(spec);
    const executorType = selection.executorType;

    this.logger.info("Executor selected", {
      executorType,
      reason: selection.reason,
      confidence: selection.confidence,
      metrics: selection.metrics,
      specId: spec.id,
    });

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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(chalk.yellow(`\n⚠️  K6 executor failed: ${errorMessage}`));
        console.log(chalk.gray("   Falling back to simple HTTP executor...\n"));

        this.logger.warn(
          "K6 executor failed, falling back to simple executor",
          {
            error: errorMessage,
            specId: spec.id,
          }
        );
        return await this.simpleExecutor.executeLoadTest(spec);
      }
    }
  }

  private async executeBatchTest(spec: LoadTestSpec): Promise<TestResult> {
    if (!spec.batch) {
      throw new Error("Batch specification is required for batch tests");
    }

    this.logger.info("Executing batch test", {
      batchName: spec.batch.name,
      executionMode: spec.batch.executionMode,
      testCount: spec.batch.tests.length,
      specId: spec.id,
    });

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

  /**
   * @deprecated Use ExecutorSelectionService.selectExecutor() instead
   * This method is kept for backward compatibility but delegates to the service
   */
  private selectExecutor(
    spec: LoadTestSpec
  ): "simple" | "k6" | "workflow" | "batch" {
    const selection = ExecutorSelectionService.selectExecutor(spec);
    return selection.executorType;
  }
}
