import { ExecutionMetrics } from "../../../types/common";

// Enhanced batch execution result
export interface EnhancedBatchExecutionResult {
  batchId: string;
  status: "completed" | "failed" | "partial";
  startTime: Date;
  endTime: Date;
  duration: number;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  results: EnhancedBatchTestResult[];
  aggregatedMetrics: AggregatedMetrics;
  executionMode: "parallel" | "sequential";
  individualReports?: IndividualTestReport[];
  combinedReport?: CombinedBatchReport;
  error?: string;
}

// Enhanced batch test result
export interface EnhancedBatchTestResult {
  testId: string;
  testName: string;
  status: "completed" | "failed" | "skipped";
  startTime: Date;
  endTime: Date;
  duration: number;
  metrics: ExecutionMetrics;
  error?: string;
  retryCount?: number;
  assertions?: AssertionResult[];
  k6ScriptPath?: string; // Path to generated K6 script
  individualReportPath?: string; // Path to individual test report
}

// Individual test report
export interface IndividualTestReport {
  testId: string;
  testName: string;
  reportPath: string;
  reportFormat: "html" | "json" | "csv";
  metrics: ExecutionMetrics;
  assertions: AssertionResult[];
}

// Combined batch report
export interface CombinedBatchReport {
  batchId: string;
  batchName: string;
  reportPath: string;
  reportFormat: "html" | "json" | "csv";
  summary: {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    successRate: number;
    totalDuration: number;
    averageResponseTime: number;
    totalThroughput: number;
  };
  testResults: EnhancedBatchTestResult[];
  aggregatedMetrics: AggregatedMetrics;
}

// Assertion result
export interface AssertionResult {
  name: string;
  type: string;
  condition: string;
  expectedValue: any;
  actualValue: any;
  passed: boolean;
  tolerance?: number;
}

// Aggregated metrics
export interface AggregatedMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  totalDuration: number;
}
