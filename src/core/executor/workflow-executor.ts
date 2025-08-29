import {
  LoadTestSpec,
  WorkflowStep,
  WorkflowRequest,
  TestResult,
} from "../../types";
import { BasicHttpExecutor } from "./simple-http-executor";

export interface WorkflowContext {
  stepData: Record<string, any>;
  globalData: Record<string, any>;
  stepResults: Record<string, any>;
}

export interface WorkflowExecutionResult {
  success: boolean;
  stepResults: Record<string, any>;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  errors: string[];
}

export class WorkflowExecutor {
  private httpExecutor: BasicHttpExecutor;
  private context: WorkflowContext;

  constructor() {
    this.httpExecutor = new BasicHttpExecutor();
    this.context = {
      stepData: {},
      globalData: {},
      stepResults: {},
    };
  }

  async executeWorkflow(spec: LoadTestSpec): Promise<TestResult> {
    if (!spec.workflow || spec.workflow.length === 0) {
      throw new Error("No workflow defined in specification");
    }

    const startTime = new Date();
    const results: WorkflowExecutionResult = {
      success: true,
      stepResults: {},
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
      errors: [],
    };

    try {
      for (const workflowStep of spec.workflow) {
        const stepResult = await this.executeWorkflowStep(workflowStep, spec);

        results.stepResults[workflowStep.id || "step"] = stepResult;
        results.totalRequests += stepResult.totalRequests;
        results.successfulRequests += stepResult.successfulRequests;
        results.failedRequests += stepResult.failedRequests;

        if (!stepResult.success) {
          results.success = false;
          results.errors.push(...stepResult.errors);
        }
      }
    } catch (error) {
      results.success = false;
      results.errors.push(
        error instanceof Error ? error.message : String(error)
      );
    }

    const endTime = new Date();
    results.totalDuration = endTime.getTime() - startTime.getTime();

    return {
      id: spec.id,
      spec,
      startTime,
      endTime,
      status: results.success ? "completed" : "failed",
      metrics: {
        totalRequests: results.totalRequests,
        successfulRequests: results.successfulRequests,
        failedRequests: results.failedRequests,
        responseTime: {
          min: 0,
          max: 0,
          avg: 0,
          p50: 0,
          p90: 0,
          p95: 0,
          p99: 0,
        },
        throughput: {
          requestsPerSecond:
            results.totalDuration > 0
              ? results.totalRequests / (results.totalDuration / 1000)
              : 0,
          bytesPerSecond: 0,
        },
        errorRate:
          results.totalRequests > 0
            ? (results.failedRequests / results.totalRequests) * 100
            : 0,
      },
      errors: results.errors.map((error) => ({
        errorType: "execution",
        errorMessage: error,
        count: 1,
        percentage:
          results.totalRequests > 0 ? (1 / results.totalRequests) * 100 : 0,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
      })),
      recommendations: [],
      rawData: {
        k6Output: null,
        executionLogs: [],
        systemMetrics: [],
      },
    };
  }

  private async executeWorkflowStep(
    step: WorkflowStep,
    spec: LoadTestSpec
  ): Promise<WorkflowExecutionResult> {
    const result: WorkflowExecutionResult = {
      success: true,
      stepResults: {},
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
      errors: [],
    };

    if (step.type === "sequential") {
      for (const subStep of step.steps) {
        if (this.isWorkflowRequest(subStep)) {
          const requestResult = await this.executeWorkflowRequest(
            subStep,
            spec
          );
          result.totalRequests += requestResult.totalRequests;
          result.successfulRequests += requestResult.successfulRequests;
          result.failedRequests += requestResult.failedRequests;

          if (!requestResult.success) {
            result.success = false;
            result.errors.push(...requestResult.errors);
          }
        } else {
          const subStepResult = await this.executeWorkflowStep(subStep, spec);
          result.totalRequests += subStepResult.totalRequests;
          result.successfulRequests += subStepResult.successfulRequests;
          result.failedRequests += subStepResult.failedRequests;

          if (!subStepResult.success) {
            result.success = false;
            result.errors.push(...subStepResult.errors);
          }
        }
      }
    } else if (step.type === "parallel") {
      const parallelPromises = step.steps.map(async (subStep) => {
        if (this.isWorkflowRequest(subStep)) {
          return await this.executeWorkflowRequest(subStep, spec);
        } else {
          return await this.executeWorkflowStep(subStep, spec);
        }
      });

      const parallelResults = await Promise.all(parallelPromises);

      for (const parallelResult of parallelResults) {
        result.totalRequests += parallelResult.totalRequests;
        result.successfulRequests += parallelResult.successfulRequests;
        result.failedRequests += parallelResult.failedRequests;

        if (!parallelResult.success) {
          result.success = false;
          result.errors.push(...parallelResult.errors);
        }
      }
    }

    return result;
  }

  private async executeWorkflowRequest(
    request: WorkflowRequest,
    spec: LoadTestSpec
  ): Promise<WorkflowExecutionResult> {
    const result: WorkflowExecutionResult = {
      success: true,
      stepResults: {},
      totalRequests: request.requestCount || 1,
      successfulRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
      errors: [],
    };

    try {
      // Process data dependencies
      const processedRequest = this.processDataDependencies(request);

      // Execute the request
      const testResult = await this.httpExecutor.executeLoadTest({
        ...spec,
        requests: [
          {
            method: processedRequest.method,
            url: processedRequest.url,
            headers: processedRequest.headers,
            body: processedRequest.body,
            payload: processedRequest.payload,
          },
        ],
        loadPattern: spec.loadPattern,
        duration: spec.duration,
      });

      result.successfulRequests = testResult.metrics.successfulRequests;
      result.failedRequests = testResult.metrics.failedRequests;
      result.totalDuration =
        testResult.endTime.getTime() - testResult.startTime.getTime();
      result.success = testResult.status === "completed";

      if (testResult.errors && testResult.errors.length > 0) {
        result.errors.push(...testResult.errors.map((e) => e.errorMessage));
      }

      // Extract data if specified
      if (
        processedRequest.extractData &&
        processedRequest.extractData.length > 0
      ) {
        this.extractDataFromResponse(processedRequest.extractData, testResult);
      }
    } catch (error) {
      result.success = false;
      result.failedRequests = result.totalRequests;
      result.errors.push(
        error instanceof Error ? error.message : String(error)
      );
    }

    return result;
  }

  private processDataDependencies(request: WorkflowRequest): WorkflowRequest {
    const processedRequest = { ...request };

    // Process URL data dependencies
    if (processedRequest.url && processedRequest.url.includes("{{")) {
      processedRequest.url = this.replaceDataPlaceholders(processedRequest.url);
    }

    // Process body data dependencies
    if (processedRequest.body) {
      processedRequest.body = this.processDataInObject(processedRequest.body);
    }

    // Process headers data dependencies
    if (processedRequest.headers) {
      processedRequest.headers = this.processDataInObject(
        processedRequest.headers
      );
    }

    return processedRequest;
  }

  private replaceDataPlaceholders(text: string): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, placeholder) => {
      const [stepId, fieldName] = placeholder.split(".");
      if (stepId && fieldName && this.context.stepResults[stepId]) {
        return this.context.stepResults[stepId][fieldName] || match;
      }
      return match;
    });
  }

  private processDataInObject(obj: any): any {
    if (typeof obj === "string") {
      return this.replaceDataPlaceholders(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processDataInObject(item));
    }

    if (obj && typeof obj === "object") {
      const processed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = this.processDataInObject(value);
      }
      return processed;
    }

    return obj;
  }

  private extractDataFromResponse(
    extractFields: string[],
    testResult: TestResult
  ): void {
    // TODO: Implement data extraction from response
    // This would parse the response and extract specified fields
    // For now, we'll store a placeholder
    this.context.stepResults[`step${Date.now()}`] = {
      extracted: extractFields,
      timestamp: new Date().toISOString(),
    };
  }

  private isWorkflowRequest(
    step: WorkflowRequest | WorkflowStep
  ): step is WorkflowRequest {
    return "method" in step && "url" in step;
  }
}
