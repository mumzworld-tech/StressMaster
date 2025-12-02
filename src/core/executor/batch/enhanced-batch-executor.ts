import {
  BatchTestSpec,
  BatchTestItem,
  LoadTestSpec,
} from "../../../types/load-test-spec";
import { TestResult } from "../../../types/test-result";
import { ExecutionMetrics } from "../../../types/common";
import { BasicHttpExecutor } from "../simple-http-executor";
import { K6LoadExecutor } from "../k6-executor";
import { WorkflowExecutor } from "../workflow-executor";
import * as fs from "fs";
import * as path from "path";

// Import modular components
import {
  EnhancedBatchExecutionResult,
  EnhancedBatchTestResult,
  AggregatedMetrics,
} from "./types";
import { DynamicPayloadProcessor } from "./dynamic-payload-processor";
import { K6ScriptGenerator } from "./k6-script-generator";

import { AssertionProcessor } from "./assertion-processor";

export class EnhancedBatchExecutor {
  private simpleExecutor: BasicHttpExecutor;
  private k6Executor: K6LoadExecutor;
  private workflowExecutor: WorkflowExecutor;
  private dynamicPayloadProcessor: DynamicPayloadProcessor;
  private k6ScriptGenerator: K6ScriptGenerator;

  private assertionProcessor: AssertionProcessor;

  constructor() {
    this.simpleExecutor = new BasicHttpExecutor();
    this.k6Executor = new K6LoadExecutor();
    this.workflowExecutor = new WorkflowExecutor();
    this.dynamicPayloadProcessor = new DynamicPayloadProcessor();
    this.k6ScriptGenerator = new K6ScriptGenerator();

    this.assertionProcessor = new AssertionProcessor();
  }

  async executeBatch(
    batchSpec: BatchTestSpec
  ): Promise<EnhancedBatchExecutionResult> {
    const startTime = new Date();
    console.log(`🚀 Starting enhanced batch execution: ${batchSpec.name}`);
    console.log(
      `📊 Mode: ${batchSpec.executionMode}, Tests: ${batchSpec.tests.length}`
    );

    // Process dynamic payloads if enabled
    if (batchSpec.dynamicPayloads?.enabled) {
      console.log(
        `🔄 Processing dynamic payloads with ${batchSpec.dynamicPayloads.incrementStrategy} strategy`
      );
      this.dynamicPayloadProcessor.processBatchPayloads(batchSpec);
    }

    // Generate K6 scripts if enabled
    if (batchSpec.k6Config?.generateSeparateScripts) {
      console.log(`📝 Generating separate K6 scripts for each test`);
      await this.generateK6Scripts(batchSpec);
    }

    const results: EnhancedBatchTestResult[] = [];
    let successfulTests = 0;
    let failedTests = 0;

    try {
      if (batchSpec.executionMode === "parallel") {
        // Execute tests in parallel with concurrency control
        const concurrency =
          batchSpec.executionOptions?.parallelConcurrency ||
          batchSpec.tests.length;
        console.log(`⚡ Parallel execution with concurrency: ${concurrency}`);

        const testBatches = this.chunkArray(batchSpec.tests, concurrency);

        for (const batch of testBatches) {
          const promises = batch.map((test) =>
            this.executeSingleTest(test, batchSpec)
          );
          const batchResults = await Promise.allSettled(promises);

          batchResults.forEach((result, index) => {
            if (result.status === "fulfilled") {
              results.push(result.value);
              if (result.value.status === "completed") {
                successfulTests++;
              } else {
                failedTests++;
              }
            } else {
              const test = batch[index];
              const failedResult: EnhancedBatchTestResult = {
                testId: test.id,
                testName: test.name,
                status: "failed",
                startTime: new Date(),
                endTime: new Date(),
                duration: 0,
                metrics: this.createEmptyMetrics(),
                error: result.reason?.message || "Unknown error",
              };
              results.push(failedResult);
              failedTests++;
            }
          });
        }
      } else {
        // Execute tests sequentially
        console.log(
          `📋 Sequential execution with ${
            batchSpec.executionOptions?.sequentialDelay ? "delays" : "no delays"
          }`
        );

        // Sort tests by execution order if specified
        const sortedTests = [...batchSpec.tests].sort(
          (a, b) => (a.executionOrder || 0) - (b.executionOrder || 0)
        );

        for (const test of sortedTests) {
          try {
            const result = await this.executeSingleTest(test, batchSpec);
            results.push(result);

            if (result.status === "completed") {
              successfulTests++;
            } else {
              failedTests++;
            }

            // Add delay between sequential tests if configured
            if (batchSpec.executionOptions?.sequentialDelay) {
              const delayMs = this.durationToMs(
                batchSpec.executionOptions.sequentialDelay
              );
              console.log(`⏳ Waiting ${delayMs}ms before next test...`);
              await this.sleep(delayMs);
            }
          } catch (error) {
            const failedResult: EnhancedBatchTestResult = {
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

      // Note: Reports will be generated only when user requests export

      const aggregatedMetrics = this.aggregateMetrics(results);

      return {
        batchId: batchSpec.id,
        status:
          failedTests === 0
            ? "completed"
            : failedTests === batchSpec.tests.length
            ? "failed"
            : "partial",
        startTime,
        endTime,
        duration,
        totalTests: batchSpec.tests.length,
        successfulTests,
        failedTests,
        results,
        aggregatedMetrics,
        executionMode: batchSpec.executionMode,
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
        executionMode: batchSpec.executionMode,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async executeSingleTest(
    test: BatchTestItem,
    batchSpec: BatchTestSpec
  ): Promise<EnhancedBatchTestResult> {
    const startTime = new Date();
    console.log(`🔧 Executing test: ${test.name} (${test.testType})`);

    let retryCount = 0;
    const maxRetries = batchSpec.executionOptions?.maxRetries || 0;

    while (retryCount <= maxRetries) {
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
            batchSpec.globalLoadPattern || {
              type: "constant",
              virtualUsers: 1,
            },
          duration: test.duration ||
            batchSpec.globalDuration || { value: 60, unit: "seconds" },
        };

        // Execute the test using the appropriate executor
        let result: TestResult;

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

        // Run assertions if defined
        const assertions = test.assertions
          ? this.assertionProcessor.runAssertions(test.assertions, result)
          : [];

        // Convert result metrics to ExecutionMetrics format
        const metrics: ExecutionMetrics = {
          status: "completed",
          progress: 100,
          currentVUs: 0,
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
          retryCount,
          assertions,
        };
      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          const endTime = new Date();
          const duration = endTime.getTime() - startTime.getTime();

          throw new Error(
            `Test ${test.name} failed after ${maxRetries} retries: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }

        console.log(
          `🔄 Retrying test ${test.name} (attempt ${retryCount}/${maxRetries})`
        );
        await this.sleep(1000 * retryCount); // Exponential backoff
      }
    }

    throw new Error(`Test ${test.name} failed after all retries`);
  }

  private async generateK6Scripts(batchSpec: BatchTestSpec): Promise<void> {
    if (!batchSpec.k6Config?.generateSeparateScripts) return;

    const {
      requireStressMasterDir,
    } = require("../../../utils/require-stressmaster-dir");
    const { getK6ScriptsDir } = requireStressMasterDir();
    const outputDir =
      batchSpec.k6Config.scriptOutputDir ||
      path.join(getK6ScriptsDir(), "batch");

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const scripts = await this.k6ScriptGenerator.generateScriptsForBatch(
      batchSpec
    );

    for (const [testId, scriptContent] of scripts) {
      const scriptPath = path.join(outputDir, `${testId}.js`);
      fs.writeFileSync(scriptPath, scriptContent);
      console.log(`📝 Generated K6 script: ${scriptPath}`);
    }
  }

  private aggregateMetrics(
    results: EnhancedBatchTestResult[]
  ): AggregatedMetrics {
    const completedResults = results.filter((r) => r.status === "completed");

    if (completedResults.length === 0) {
      return this.createEmptyAggregatedMetrics();
    }

    const totalRequests = completedResults.reduce(
      (sum, r) => sum + r.metrics.requestsCompleted,
      0
    );
    const successfulRequests = completedResults.reduce(
      (sum, r) =>
        sum +
        Math.floor(r.metrics.requestsCompleted * (1 - r.metrics.errorRate)),
      0
    );
    const failedRequests = totalRequests - successfulRequests;
    const successRate =
      totalRequests > 0 ? successfulRequests / totalRequests : 0;

    const responseTimes = completedResults
      .map((r) => r.metrics.avgResponseTime)
      .filter((time) => time > 0);

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    const minResponseTime =
      responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    // Calculate percentiles
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p50ResponseTime = this.calculatePercentile(sortedTimes, 50);
    const p90ResponseTime = this.calculatePercentile(sortedTimes, 90);
    const p95ResponseTime = this.calculatePercentile(sortedTimes, 95);
    const p99ResponseTime = this.calculatePercentile(sortedTimes, 99);

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
      averageResponseTime: avgResponseTime,
      minResponseTime,
      maxResponseTime,
      p50ResponseTime,
      p90ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      requestsPerSecond,
      errorRate: 1 - successRate,
      totalDuration,
    };
  }

  private calculatePercentile(
    sortedValues: number[],
    percentile: number
  ): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private durationToMs(duration: any): number {
    if (!duration) return 0;

    const value = duration.value || 0;
    const unit = duration.unit || "seconds";

    switch (unit) {
      case "milliseconds":
        return value;
      case "seconds":
        return value * 1000;
      case "minutes":
        return value * 60 * 1000;
      case "hours":
        return value * 60 * 60 * 1000;
      default:
        return value * 1000;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p90ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      totalDuration: 0,
    };
  }
}
