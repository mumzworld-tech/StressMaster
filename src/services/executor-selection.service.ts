/**
 * Executor Selection Service
 * Determines which executor to use based on test specifications and metrics
 * Works harmoniously with Simple HTTP Executor and K6 Executor
 */

import { LoadTestSpec } from "../types";

export type ExecutorType = "simple" | "k6" | "workflow" | "batch";

export interface ExecutorSelectionMetrics {
  requestCount: number;
  totalRequests: number;
  loadPatternComplexity: number; // 0-100 scale
  testComplexity: number; // 0-100 scale
  requiresK6: boolean;
  requiresWorkflow: boolean;
  requiresBatch: boolean;
  estimatedDuration: number; // in seconds
  estimatedResourceUsage: "low" | "medium" | "high";
}

export interface ExecutorSelectionResult {
  executorType: ExecutorType;
  metrics: ExecutorSelectionMetrics;
  reason: string;
  confidence: number; // 0-1 scale
}

/**
 * Service to intelligently select the best executor for a load test
 */
export class ExecutorSelectionService {
  // Thresholds for executor selection
  // Simple executor can handle most tests - use it by default
  private static readonly SIMPLE_EXECUTOR_MAX_REQUESTS = 10000; // Simple executor can handle up to 10k requests
  private static readonly SIMPLE_EXECUTOR_MAX_DURATION_SECONDS = 1800; // 30 minutes - simple executor can handle longer tests
  // K6 only for special/complex scenarios
  private static readonly K6_EXECUTOR_MIN_REQUESTS = 5000; // K6 for very high concurrency (5000+ VUs)
  private static readonly K6_EXECUTOR_MIN_DURATION_SECONDS = 1800; // K6 for very long tests (30+ minutes)
  private static readonly K6_EXECUTOR_MIN_TOTAL_REQUESTS = 10000; // K6 for very high total request counts (10k+)
  private static readonly COMPLEX_PATTERN_THRESHOLD = 30; // Load pattern complexity score

  /**
   * Select the best executor for a given test specification
   */
  static selectExecutor(spec: LoadTestSpec): ExecutorSelectionResult {
    const metrics = this.calculateMetrics(spec);

    // Priority 1: Batch tests
    if (metrics.requiresBatch) {
      return {
        executorType: "batch",
        metrics,
        reason: `Batch test with ${spec.batch?.tests.length || 0} tests`,
        confidence: 1.0,
      };
    }

    // Priority 2: Workflow tests
    if (metrics.requiresWorkflow) {
      // For workflows, decide between workflow executor and K6
      if (metrics.requiresK6) {
        return {
          executorType: "k6",
          metrics,
          reason: `Complex workflow test: ${metrics.totalRequests} total requests, ${metrics.loadPatternComplexity}% pattern complexity`,
          confidence: 0.9,
        };
      }
      return {
        executorType: "workflow",
        metrics,
        reason: `Workflow test: ${spec.workflow?.length || 0} workflow steps, ${
          metrics.requestCount
        } virtual users`,
        confidence: 0.95,
      };
    }

    // Priority 3: K6 vs Simple executor
    if (metrics.requiresK6) {
      return {
        executorType: "k6",
        metrics,
        reason: this.getK6SelectionReason(metrics),
        confidence: this.calculateK6Confidence(metrics),
      };
    }

    // Default: Simple executor
    return {
      executorType: "simple",
      metrics,
      reason: this.getSimpleSelectionReason(metrics),
      confidence: 0.95,
    };
  }

  /**
   * Calculate metrics for executor selection
   */
  private static calculateMetrics(
    spec: LoadTestSpec
  ): ExecutorSelectionMetrics {
    const requestCount = spec.loadPattern.virtualUsers || 1;
    const loadPatternComplexity = this.calculateLoadPatternComplexity(
      spec.loadPattern
    );
    const testComplexity = this.calculateTestComplexity(spec);
    const totalRequests = this.calculateTotalRequests(spec);
    const estimatedDuration = this.estimateDuration(spec);

    // Determine requirements for K6
    // K6 should ONLY be used for special/complex tests:
    // 1. Specific test types: stress, endurance, spike (with high concurrency)
    // 2. Volume tests ONLY if they have complex patterns or very high scale
    // 3. Very high concurrency (5000+ virtual users)
    // 4. Very high total requests (10000+)
    // 5. Complex load patterns (ramp-up, step, random-burst)
    // 6. Very long durations (30+ minutes)
    //
    // Simple baseline/volume tests with constant load patterns should use simple executor
    const isComplexTestType =
      spec.testType === "stress" ||
      spec.testType === "endurance" ||
      (spec.testType === "spike" && requestCount > 500) ||
      // Volume tests only use K6 if they have complex patterns or very high scale
      (spec.testType === "volume" &&
        (loadPatternComplexity >= this.COMPLEX_PATTERN_THRESHOLD ||
          requestCount >= 5000 ||
          totalRequests >= 10000));

    const isComplexLoadPattern =
      loadPatternComplexity >= this.COMPLEX_PATTERN_THRESHOLD &&
      spec.loadPattern.type !== "constant";

    const requiresK6 =
      isComplexTestType ||
      isComplexLoadPattern ||
      requestCount >= this.K6_EXECUTOR_MIN_REQUESTS ||
      totalRequests >= this.K6_EXECUTOR_MIN_TOTAL_REQUESTS ||
      estimatedDuration >= this.K6_EXECUTOR_MIN_DURATION_SECONDS;

    const requiresWorkflow: boolean =
      spec.testType === "workflow" ||
      !!(spec.workflow && spec.workflow.length > 0);

    const requiresBatch: boolean = spec.testType === "batch" || !!spec.batch;

    // Estimate resource usage
    const estimatedResourceUsage = this.estimateResourceUsage(
      requestCount,
      totalRequests,
      estimatedDuration
    );

    return {
      requestCount,
      totalRequests,
      loadPatternComplexity,
      testComplexity,
      requiresK6,
      requiresWorkflow,
      requiresBatch,
      estimatedDuration,
      estimatedResourceUsage,
    };
  }

  /**
   * Calculate load pattern complexity (0-100)
   */
  private static calculateLoadPatternComplexity(
    pattern: LoadTestSpec["loadPattern"]
  ): number {
    let complexity = 0;

    // Base complexity by type
    switch (pattern.type) {
      case "constant":
        complexity = 10;
        break;
      case "ramp-up":
        complexity = 40;
        break;
      case "spike":
        complexity = 60;
        break;
      case "step":
        complexity = 50;
        break;
      case "random-burst":
        complexity = 70;
        break;
      default:
        complexity = 20;
    }

    // Add complexity for stages
    if (pattern.stages && pattern.stages.length > 0) {
      complexity += Math.min(pattern.stages.length * 5, 30);
    }

    // Add complexity for RPS limits
    if (pattern.requestsPerSecond) {
      complexity += 10;
    }

    // Add complexity for ramp-up/plateau times
    if (pattern.rampUpTime) {
      complexity += 5;
    }
    if (pattern.plateauTime) {
      complexity += 5;
    }

    return Math.min(complexity, 100);
  }

  /**
   * Calculate test complexity (0-100)
   */
  private static calculateTestComplexity(spec: LoadTestSpec): number {
    let complexity = 0;

    // Base complexity by test type
    switch (spec.testType) {
      case "baseline":
        complexity = 10;
        break;
      case "spike":
        complexity = 50;
        break;
      case "stress":
        complexity = 70;
        break;
      case "endurance":
        complexity = 60;
        break;
      case "volume":
        complexity = 80;
        break;
      case "workflow":
        complexity = 40;
        break;
      default:
        complexity = 20;
    }

    // Add complexity for multiple requests
    if (spec.requests.length > 1) {
      complexity += Math.min(spec.requests.length * 5, 20);
    }

    // Add complexity for payloads
    if (spec.requests.some((r) => r.payload)) {
      complexity += 10;
    }

    // Add complexity for media files
    if (spec.requests.some((r) => r.media)) {
      complexity += 15;
    }

    // Add complexity for validation
    if (spec.requests.some((r) => r.validation && r.validation.length > 0)) {
      complexity += 5;
    }

    return Math.min(complexity, 100);
  }

  /**
   * Calculate total requests across all requests and workflow steps
   */
  private static calculateTotalRequests(spec: LoadTestSpec): number {
    const baseRequests = spec.requests.length;
    const virtualUsers = spec.loadPattern.virtualUsers || 1;
    let baseTotal = baseRequests * virtualUsers;

    // Add workflow requests
    if (spec.workflow && spec.workflow.length > 0) {
      for (const workflow of spec.workflow) {
        if (workflow.steps && Array.isArray(workflow.steps)) {
          for (const step of workflow.steps) {
            if (
              "requestCount" in step &&
              typeof step.requestCount === "number"
            ) {
              baseTotal += step.requestCount * virtualUsers;
            } else {
              baseTotal += virtualUsers;
            }
          }
        }
      }
    }

    return baseTotal;
  }

  /**
   * Estimate test duration in seconds
   */
  private static estimateDuration(spec: LoadTestSpec): number {
    if (spec.duration) {
      const duration = spec.duration;
      switch (duration.unit) {
        case "seconds":
          return duration.value;
        case "minutes":
          return duration.value * 60;
        case "hours":
          return duration.value * 3600;
        default:
          return duration.value;
      }
    }

    // Estimate based on request count and load pattern
    const requestCount = spec.loadPattern.virtualUsers || 1;
    const baseTime = requestCount * 2; // 2 seconds per request estimate

    if (spec.loadPattern.rampUpTime) {
      return (
        baseTime + this.convertDurationToSeconds(spec.loadPattern.rampUpTime)
      );
    }

    return Math.max(baseTime, 30); // Minimum 30 seconds
  }

  /**
   * Convert duration to seconds
   */
  private static convertDurationToSeconds(duration: {
    value: number;
    unit: string;
  }): number {
    switch (duration.unit) {
      case "seconds":
        return duration.value;
      case "minutes":
        return duration.value * 60;
      case "hours":
        return duration.value * 3600;
      default:
        return duration.value;
    }
  }

  /**
   * Estimate resource usage
   */
  private static estimateResourceUsage(
    requestCount: number,
    totalRequests: number,
    duration: number
  ): "low" | "medium" | "high" {
    const requestsPerSecond = totalRequests / Math.max(duration, 1);

    if (requestCount <= 10 && requestsPerSecond <= 5) {
      return "low";
    } else if (requestCount <= 50 && requestsPerSecond <= 20) {
      return "medium";
    } else {
      return "high";
    }
  }

  /**
   * Get reason for K6 selection
   */
  private static getK6SelectionReason(
    metrics: ExecutorSelectionMetrics
  ): string {
    const reasons: string[] = [];

    if (metrics.requestCount >= this.K6_EXECUTOR_MIN_REQUESTS) {
      reasons.push(`${metrics.requestCount} virtual users`);
    }

    if (metrics.totalRequests >= this.K6_EXECUTOR_MIN_TOTAL_REQUESTS) {
      reasons.push(`${metrics.totalRequests} total requests`);
    }

    if (metrics.loadPatternComplexity >= this.COMPLEX_PATTERN_THRESHOLD) {
      reasons.push(`complex load pattern (${metrics.loadPatternComplexity}%)`);
    }

    if (metrics.estimatedDuration >= this.K6_EXECUTOR_MIN_DURATION_SECONDS) {
      reasons.push(`long duration (${Math.round(metrics.estimatedDuration)}s)`);
    }

    return `K6 selected: ${reasons.join(", ")}`;
  }

  /**
   * Get reason for Simple executor selection
   */
  private static getSimpleSelectionReason(
    metrics: ExecutorSelectionMetrics
  ): string {
    return `Simple executor: ${metrics.requestCount} requests, ${
      metrics.estimatedResourceUsage
    } resource usage, ${Math.round(metrics.estimatedDuration)}s duration`;
  }

  /**
   * Calculate confidence for K6 selection
   */
  private static calculateK6Confidence(
    metrics: ExecutorSelectionMetrics
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on clear indicators
    if (metrics.requestCount >= this.K6_EXECUTOR_MIN_REQUESTS * 2) {
      confidence += 0.2;
    }

    if (metrics.loadPatternComplexity >= this.COMPLEX_PATTERN_THRESHOLD * 2) {
      confidence += 0.2;
    }

    if (
      metrics.estimatedDuration >=
      this.K6_EXECUTOR_MIN_DURATION_SECONDS * 2
    ) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}
