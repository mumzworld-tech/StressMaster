import {
  LoadTestSpec,
  TestResult,
  ProgressUpdate,
  K6Script,
  RawResults,
} from "../../types";
import {
  Observable,
  BehaviorSubject,
  Subject,
  merge,
  of,
  throwError,
} from "rxjs";
import {
  map,
  catchError,
  retry,
  delay,
  timeout,
  finalize,
} from "rxjs/operators";
import { CommandParser } from "../parser";
import { ScriptGenerator } from "../generator/script-generator";
import { ScriptExecutor } from "../executor/script-executor";
import { v4 as uuidv4 } from "uuid";

export interface LoadTestOrchestrator {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
  monitorProgress(): Observable<ProgressUpdate>;
  cancelTest(testId: string): Promise<void>;
  getTestHistory(): TestResult[];
}

export interface OrchestratorConfig {
  maxConcurrentTests: number;
  defaultTimeout: number;
  retryAttempts: number;
  historyLimit: number;
  stepTimeout: number;
  enableWorkflowRecovery: boolean;
  maxWorkflowRetries: number;
}

export interface TestExecution {
  id: string;
  spec: LoadTestSpec;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  startTime: Date;
  endTime?: Date;
  progress: number;
  currentPhase: string;
  workflowState?: WorkflowState;
  retryCount: number;
  errors: string[];
}

export interface ExecutionQueue {
  pending: TestExecution[];
  running: TestExecution[];
  completed: TestExecution[];
}

export interface WorkflowState {
  testId: string;
  currentStep: number;
  totalSteps: number;
  stepData: Record<string, any>;
  correlatedData: Record<string, any>;
  errors: string[];
  stepHistory: WorkflowStepResult[];
  recoveryAttempts: number;
}

export interface WorkflowStepResult {
  stepId: string;
  stepName: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startTime: Date;
  endTime?: Date;
  data?: any;
  error?: string;
  retryCount: number;
}

export interface WorkflowRecoveryStrategy {
  type: "retry" | "skip" | "fallback" | "abort";
  maxAttempts: number;
  backoffMs: number;
  condition?: (error: Error, step: WorkflowStepResult) => boolean;
}

export interface ExecutionPhase {
  name: string;
  description: string;
  weight: number; // For progress calculation
  execute: (execution: TestExecution) => Promise<any>;
  canRetry: boolean;
  recoveryStrategy?: WorkflowRecoveryStrategy;
}

export class LoadTestWorkflowOrchestrator implements LoadTestOrchestrator {
  private config: OrchestratorConfig;
  private parser: CommandParser;
  private generator: ScriptGenerator;
  private executor: ScriptExecutor;

  private executionQueue: ExecutionQueue = {
    pending: [],
    running: [],
    completed: [],
  };

  private progressSubject = new BehaviorSubject<ProgressUpdate>({
    testId: "",
    currentPhase: "idle",
    progress: 0,
    message: "Ready",
    timestamp: new Date(),
  });

  private testHistory: TestResult[] = [];
  private activeExecutions = new Map<string, TestExecution>();
  private executionPhases: ExecutionPhase[] = [];
  private queueProcessor: NodeJS.Timeout | null = null;
  private progressAggregator: NodeJS.Timeout | null = null;

  constructor(
    config: OrchestratorConfig,
    parser: CommandParser,
    generator: ScriptGenerator,
    executor: ScriptExecutor
  ) {
    this.config = config;
    this.parser = parser;
    this.generator = generator;
    this.executor = executor;

    this.initializeExecutionPhases();
    this.startQueueProcessor();
    this.startProgressAggregator();
  }

  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const execution = this.createTestExecution(spec);

    try {
      // Add to queue
      this.executionQueue.pending.push(execution);
      this.activeExecutions.set(execution.id, execution);

      // Check if we can start immediately
      if (
        this.executionQueue.running.length >= this.config.maxConcurrentTests
      ) {
        execution.status = "queued";
        this.updateProgress(execution, "queued", 0, "Waiting in queue...");

        // Wait for slot to become available
        await this.waitForExecutionSlot();
      }

      // Move to running queue
      this.moveToRunning(execution);

      // Execute workflow
      const result = await this.executeWorkflow(execution);

      // Move to completed queue
      this.moveToCompleted(execution);

      // Add to history
      this.addToHistory(result);

      return result;
    } catch (error) {
      execution.status = "failed";
      execution.endTime = new Date();
      execution.errors.push(
        error instanceof Error ? error.message : String(error)
      );

      this.moveToCompleted(execution);

      // Create failed result
      const failedResult = this.createFailedResult(execution, error);
      this.addToHistory(failedResult);

      throw error;
    } finally {
      this.activeExecutions.delete(execution.id);
    }
  }

  monitorProgress(): Observable<ProgressUpdate> {
    return this.progressSubject.asObservable();
  }

  async cancelTest(testId: string): Promise<void> {
    const execution = this.activeExecutions.get(testId);
    if (!execution) {
      throw new Error(`Test execution not found: ${testId}`);
    }

    execution.status = "cancelled";
    execution.endTime = new Date();

    // Cancel executor if running
    if (execution.currentPhase === "executing") {
      try {
        await this.executor.stopExecution();
      } catch (error) {
        execution.errors.push(
          `Error cancelling execution: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.updateProgress(
      execution,
      "cancelled",
      execution.progress,
      "Test cancelled by user"
    );
    this.moveToCompleted(execution);
  }

  getTestHistory(): TestResult[] {
    return [...this.testHistory];
  }

  private initializeExecutionPhases(): void {
    this.executionPhases = [
      {
        name: "validation",
        description: "Validating load test specification",
        weight: 10,
        execute: (execution) => this.validateSpecification(execution),
        canRetry: true,
        recoveryStrategy: {
          type: "retry",
          maxAttempts: 2,
          backoffMs: 1000,
        },
      },
      {
        name: "preparation",
        description: "Preparing workflow state and data correlation",
        weight: 15,
        execute: (execution) => this.prepareWorkflowState(execution),
        canRetry: true,
        recoveryStrategy: {
          type: "retry",
          maxAttempts: 3,
          backoffMs: 500,
        },
      },
      {
        name: "generation",
        description: "Generating K6 script from specification",
        weight: 20,
        execute: (execution) => this.generateScript(execution),
        canRetry: true,
        recoveryStrategy: {
          type: "fallback",
          maxAttempts: 1,
          backoffMs: 0,
        },
      },
      {
        name: "executing",
        description: "Executing load test script",
        weight: 50,
        execute: (execution) => this.executeScript(execution),
        canRetry: false, // Script execution typically shouldn't be retried
        recoveryStrategy: {
          type: "abort",
          maxAttempts: 1,
          backoffMs: 0,
        },
      },
      {
        name: "processing",
        description: "Processing and analyzing results",
        weight: 5,
        execute: (execution) => this.processResults(execution),
        canRetry: true,
        recoveryStrategy: {
          type: "retry",
          maxAttempts: 3,
          backoffMs: 2000,
        },
      },
    ];
  }

  private async executeWorkflow(execution: TestExecution): Promise<TestResult> {
    let cumulativeProgress = 0;
    const totalWeight = this.executionPhases.reduce(
      (sum, phase) => sum + phase.weight,
      0
    );

    // Initialize workflow state for multi-step scenarios
    if (execution.spec.workflow && execution.spec.workflow.length > 0) {
      execution.workflowState = this.initializeWorkflowState(execution);
    }

    for (const phase of this.executionPhases) {
      try {
        execution.currentPhase = phase.name;
        this.updateProgress(
          execution,
          phase.name,
          cumulativeProgress,
          phase.description
        );

        // Execute phase with timeout
        const phaseResult = await this.executePhaseWithRecovery(
          phase,
          execution
        );

        // Store phase result in execution
        (execution as any)[`${phase.name}Result`] = phaseResult;

        cumulativeProgress += phase.weight;
        const progressPercentage = Math.round(
          (cumulativeProgress / totalWeight) * 100
        );

        this.updateProgress(
          execution,
          phase.name,
          progressPercentage,
          `${phase.description} completed`
        );
      } catch (error) {
        execution.errors.push(
          `Phase ${phase.name} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        // Check if we can recover from this error
        if (
          phase.recoveryStrategy &&
          this.canRecover(phase, execution, error)
        ) {
          const recoveryResult = await this.attemptRecovery(
            phase,
            execution,
            error
          );
          if (recoveryResult.success) {
            (execution as any)[`${phase.name}Result`] = recoveryResult.data;
            cumulativeProgress += phase.weight;
            continue;
          }
        }

        // Recovery failed or not possible, abort workflow
        throw new Error(
          `Workflow failed at phase ${phase.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Create final test result
    return this.createTestResult(execution);
  }

  private async executePhaseWithRecovery(
    phase: ExecutionPhase,
    execution: TestExecution
  ): Promise<any> {
    const timeoutMs = this.config.stepTimeout || 30000;

    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Phase ${phase.name} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = await phase.execute(execution);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private canRecover(
    phase: ExecutionPhase,
    execution: TestExecution,
    error: any
  ): boolean {
    if (!phase.recoveryStrategy || !phase.canRetry) {
      return false;
    }

    if (execution.retryCount >= phase.recoveryStrategy.maxAttempts) {
      return false;
    }

    // Check custom recovery condition if provided
    if (phase.recoveryStrategy.condition) {
      const stepResult: WorkflowStepResult = {
        stepId: phase.name,
        stepName: phase.description,
        status: "failed",
        startTime: new Date(),
        error: error instanceof Error ? error.message : String(error),
        retryCount: execution.retryCount,
      };

      return phase.recoveryStrategy.condition(
        error instanceof Error ? error : new Error(String(error)),
        stepResult
      );
    }

    return true;
  }

  private async attemptRecovery(
    phase: ExecutionPhase,
    execution: TestExecution,
    error: any
  ): Promise<{ success: boolean; data?: any }> {
    if (!phase.recoveryStrategy) {
      return { success: false };
    }

    execution.retryCount++;

    switch (phase.recoveryStrategy.type) {
      case "retry":
        // Wait for backoff period
        if (phase.recoveryStrategy.backoffMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, phase.recoveryStrategy!.backoffMs)
          );
        }

        try {
          const result = await this.executePhaseWithRecovery(phase, execution);
          execution.errors.push(
            `Phase ${phase.name} recovered after ${execution.retryCount} attempts`
          );
          return { success: true, data: result };
        } catch (retryError) {
          return { success: false };
        }

      case "skip":
        execution.errors.push(
          `Phase ${phase.name} skipped due to error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return { success: true, data: null };

      case "fallback":
        // Implement fallback logic specific to each phase
        const fallbackResult = await this.executeFallback(
          phase,
          execution,
          error
        );
        return { success: fallbackResult !== null, data: fallbackResult };

      case "abort":
      default:
        return { success: false };
    }
  }

  private async executeFallback(
    phase: ExecutionPhase,
    execution: TestExecution,
    error: any
  ): Promise<any> {
    switch (phase.name) {
      case "generation":
        // Fallback to basic script generation
        try {
          const basicScript = this.generateBasicScript(execution.spec);
          execution.errors.push("Used fallback script generation due to error");
          return basicScript;
        } catch (fallbackError) {
          return null;
        }

      case "validation":
        // Fallback to minimal validation
        execution.errors.push("Used minimal validation due to error");
        return { isValid: true, warnings: ["Minimal validation applied"] };

      default:
        return null;
    }
  }

  private initializeWorkflowState(execution: TestExecution): WorkflowState {
    const workflow = execution.spec.workflow || [];

    return {
      testId: execution.id,
      currentStep: 0,
      totalSteps: workflow.length,
      stepData: {},
      correlatedData: {},
      errors: [],
      stepHistory: workflow.map((step) => ({
        stepId: step.id || "step",
        stepName: step.name || "Step",
        status: "pending",
        startTime: new Date(),
        retryCount: 0,
      })),
      recoveryAttempts: 0,
    };
  }

  private async validateSpecification(execution: TestExecution): Promise<any> {
    const validationResult = this.parser.validateSpec(execution.spec);

    if (!validationResult.isValid) {
      throw new Error(
        `Specification validation failed: ${validationResult.errors.join(", ")}`
      );
    }

    return validationResult;
  }

  private async prepareWorkflowState(execution: TestExecution): Promise<any> {
    // Initialize correlation data if needed
    if (
      execution.spec.dataCorrelation &&
      execution.spec.dataCorrelation.length > 0
    ) {
      if (!execution.workflowState) {
        execution.workflowState = this.initializeWorkflowState(execution);
      }

      // Prepare correlation mappings
      execution.workflowState.correlatedData = {};
      execution.spec.dataCorrelation.forEach((rule) => {
        execution.workflowState!.correlatedData[
          `${rule.targetStep}_${rule.targetField}`
        ] = null;
      });
    }

    return { prepared: true };
  }

  private async generateScript(execution: TestExecution): Promise<K6Script> {
    try {
      const script = this.generator.generateScript(execution.spec);

      // Validate generated script
      const validation = this.generator.validateScript(script);
      if (!validation.isValid) {
        throw new Error(
          `Generated script validation failed: ${validation.errors.join(", ")}`
        );
      }

      return script;
    } catch (error) {
      throw new Error(
        `Script generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async executeScript(execution: TestExecution): Promise<RawResults> {
    const script = (execution as any).generationResult as K6Script;
    if (!script) {
      throw new Error("No script available for execution");
    }

    // Subscribe to execution monitoring
    const executionMonitoring = this.executor.monitorExecution();
    const subscription = executionMonitoring.subscribe((metrics) => {
      // Update progress based on execution metrics
      const executionProgress = 50 + metrics.progress * 0.4; // Execution is 50% of total workflow
      this.updateProgress(
        execution,
        "executing",
        executionProgress,
        `Running: ${metrics.currentVUs} VUs, ${metrics.requestsCompleted} requests`
      );
    });

    try {
      const results = await this.executor.executeScript(script);
      subscription.unsubscribe();
      return results;
    } catch (error) {
      subscription.unsubscribe();
      throw error;
    }
  }

  private async processResults(execution: TestExecution): Promise<any> {
    const rawResults = (execution as any).executingResult as RawResults;
    if (!rawResults) {
      throw new Error("No raw results available for processing");
    }

    // Basic result processing - this would be enhanced with actual analysis
    return {
      processed: true,
      timestamp: new Date(),
      summary: {
        totalRequests:
          rawResults.k6Output?.metrics?.http_reqs?.values?.count || 0,
        avgResponseTime:
          rawResults.k6Output?.metrics?.http_req_duration?.values?.avg || 0,
        errorRate:
          rawResults.k6Output?.metrics?.http_req_failed?.values?.rate || 0,
      },
    };
  }

  private generateBasicScript(spec: LoadTestSpec): K6Script {
    // Fallback basic script generation
    const basicContent = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  const response = http.get('${spec.requests[0]?.url || "http://example.com"}');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}`;

    return {
      id: `fallback_${spec.id}`,
      name: `${spec.name}_fallback`,
      content: basicContent,
      imports: [],
      options: {
        vus: spec.loadPattern.virtualUsers || 1,
        duration: "30s",
      },
      metadata: {
        generatedAt: new Date(),
        specId: spec.id,
        version: "1.0.0-fallback",
        description: "Fallback script generated due to error",
        tags: ["fallback"],
      },
    };
  }

  private createTestExecution(spec: LoadTestSpec): TestExecution {
    return {
      id: uuidv4(),
      spec,
      status: "queued",
      startTime: new Date(),
      progress: 0,
      currentPhase: "queued",
      retryCount: 0,
      errors: [],
    };
  }

  private createTestResult(execution: TestExecution): TestResult {
    const rawResults = (execution as any).executingResult as RawResults;
    const processingResult = (execution as any).processingResult;

    return {
      id: execution.id,
      spec: execution.spec,
      startTime: execution.startTime,
      endTime: execution.endTime || new Date(),
      status: "completed",
      metrics: {
        totalRequests: processingResult?.summary?.totalRequests || 0,
        successfulRequests:
          processingResult?.summary?.totalRequests -
            processingResult?.summary?.totalRequests *
              (processingResult?.summary?.errorRate || 0) || 0,
        failedRequests:
          processingResult?.summary?.totalRequests *
            (processingResult?.summary?.errorRate || 0) || 0,
        responseTime: {
          min: 0,
          max: 0,
          avg: processingResult?.summary?.avgResponseTime || 0,
          p50: 0,
          p90: 0,
          p95: 0,
          p99: 0,
        },
        throughput: {
          requestsPerSecond: 0,
          bytesPerSecond: 0,
        },
        errorRate: processingResult?.summary?.errorRate || 0,
      },
      errors: execution.errors.map((error) => ({
        errorType: "execution_error",
        errorMessage: error,
        count: 1,
        percentage: 0,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
      })),
      recommendations: [],
      rawData: rawResults || {
        k6Output: {},
        executionLogs: [],
        systemMetrics: [],
      },
    };
  }

  private createFailedResult(execution: TestExecution, error: any): TestResult {
    return {
      id: execution.id,
      spec: execution.spec,
      startTime: execution.startTime,
      endTime: execution.endTime || new Date(),
      status: "failed",
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTime: {
          min: 0,
          max: 0,
          avg: 0,
          p50: 0,
          p90: 0,
          p95: 0,
          p99: 0,
        },
        throughput: { requestsPerSecond: 0, bytesPerSecond: 0 },
        errorRate: 1,
      },
      errors: [
        {
          errorType: "workflow_error",
          errorMessage: error instanceof Error ? error.message : String(error),
          count: 1,
          percentage: 100,
          firstOccurrence: new Date(),
          lastOccurrence: new Date(),
        },
      ],
      recommendations: ["Check test specification and system configuration"],
      rawData: {
        k6Output: {},
        executionLogs: execution.errors,
        systemMetrics: [],
      },
    };
  }

  private updateProgress(
    execution: TestExecution,
    phase: string,
    progress: number,
    message: string
  ): void {
    execution.progress = progress;
    execution.currentPhase = phase;

    this.progressSubject.next({
      testId: execution.id,
      currentPhase: phase,
      progress,
      message,
      timestamp: new Date(),
    });
  }

  private async waitForExecutionSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (
          this.executionQueue.running.length < this.config.maxConcurrentTests
        ) {
          resolve();
        } else {
          setTimeout(checkSlot, 1000);
        }
      };
      checkSlot();
    });
  }

  private moveToRunning(execution: TestExecution): void {
    const index = this.executionQueue.pending.indexOf(execution);
    if (index > -1) {
      this.executionQueue.pending.splice(index, 1);
    }
    this.executionQueue.running.push(execution);
    execution.status = "running";
  }

  private moveToCompleted(execution: TestExecution): void {
    const index = this.executionQueue.running.indexOf(execution);
    if (index > -1) {
      this.executionQueue.running.splice(index, 1);
    }
    this.executionQueue.completed.push(execution);

    // Maintain history limit
    if (this.executionQueue.completed.length > this.config.historyLimit) {
      this.executionQueue.completed.shift();
    }
  }

  private addToHistory(result: TestResult): void {
    this.testHistory.push(result);

    // Maintain history limit
    if (this.testHistory.length > this.config.historyLimit) {
      this.testHistory.shift();
    }
  }

  // Enhanced test execution coordination methods for task 8.2

  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      this.processExecutionQueue();
    }, 1000); // Process queue every second
  }

  private startProgressAggregator(): void {
    this.progressAggregator = setInterval(() => {
      this.aggregateProgress();
    }, 500); // Aggregate progress every 500ms
  }

  private processExecutionQueue(): void {
    // Check if we can start more tests from the pending queue
    const availableSlots =
      this.config.maxConcurrentTests - this.executionQueue.running.length;

    if (availableSlots > 0 && this.executionQueue.pending.length > 0) {
      const testsToStart = this.executionQueue.pending.splice(
        0,
        availableSlots
      );

      testsToStart.forEach((execution) => {
        this.moveToRunning(execution);
        this.updateProgress(
          execution,
          "starting",
          5,
          "Starting test execution..."
        );
      });
    }

    // Clean up completed executions that are too old
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    this.executionQueue.completed = this.executionQueue.completed.filter(
      (execution) => execution.endTime && execution.endTime > cutoffTime
    );
  }

  private aggregateProgress(): void {
    if (this.executionQueue.running.length === 0) {
      // No running tests, update to idle state
      this.progressSubject.next({
        testId: "",
        currentPhase: "idle",
        progress: 0,
        message: `Ready - ${this.executionQueue.pending.length} tests queued`,
        timestamp: new Date(),
      });
      return;
    }

    // Calculate aggregate progress across all running tests
    const runningTests = this.executionQueue.running;
    const totalProgress = runningTests.reduce(
      (sum, execution) => sum + execution.progress,
      0
    );
    const avgProgress = totalProgress / runningTests.length;

    // Find the most advanced test for status reporting
    const mostAdvancedTest = runningTests.reduce((prev, current) =>
      current.progress > prev.progress ? current : prev
    );

    // Create aggregate progress update
    const aggregateMessage =
      runningTests.length === 1
        ? `${mostAdvancedTest.currentPhase} - ${mostAdvancedTest.spec.name}`
        : `${runningTests.length} tests running - avg ${Math.round(
            avgProgress
          )}% complete`;

    this.progressSubject.next({
      testId: mostAdvancedTest.id,
      currentPhase: mostAdvancedTest.currentPhase,
      progress: avgProgress,
      message: aggregateMessage,
      timestamp: new Date(),
    });
  }

  // Enhanced queue management methods

  public getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    totalCapacity: number;
    availableSlots: number;
  } {
    const failedTests = this.testHistory.filter(
      (test) => test.status === "failed"
    ).length;
    return {
      pending: this.executionQueue.pending.length,
      running: this.executionQueue.running.length,
      completed: this.executionQueue.completed.length,
      failed: failedTests,
      totalCapacity: this.config.maxConcurrentTests,
      availableSlots:
        this.config.maxConcurrentTests - this.executionQueue.running.length,
    };
  }

  public getRunningTests(): TestExecution[] {
    return [...this.executionQueue.running];
  }

  public getPendingTests(): TestExecution[] {
    return [...this.executionQueue.pending];
  }

  public getCompletedTests(): TestExecution[] {
    return [...this.executionQueue.completed];
  }

  public getTestById(testId: string): TestExecution | undefined {
    return (
      this.activeExecutions.get(testId) ||
      this.executionQueue.completed.find((t) => t.id === testId)
    );
  }

  // Enhanced test history management

  public searchTestHistory(criteria: {
    testName?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    testType?: string;
  }): TestResult[] {
    return this.testHistory.filter((result) => {
      if (
        criteria.testName &&
        !result.spec.name
          .toLowerCase()
          .includes(criteria.testName.toLowerCase())
      ) {
        return false;
      }
      if (criteria.status && result.status !== criteria.status) {
        return false;
      }
      if (criteria.startDate && result.startTime < criteria.startDate) {
        return false;
      }
      if (criteria.endDate && result.endTime > criteria.endDate) {
        return false;
      }
      if (criteria.testType && result.spec.testType !== criteria.testType) {
        return false;
      }
      return true;
    });
  }

  public getTestStatistics(): {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    cancelledTests: number;
    averageExecutionTime: number;
    averageSuccessRate: number;
  } {
    const total = this.testHistory.length;
    if (total === 0) {
      return {
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
        cancelledTests: 0,
        averageExecutionTime: 0,
        averageSuccessRate: 0,
      };
    }

    const successful = this.testHistory.filter(
      (t) => t.status === "completed"
    ).length;
    const failed = this.testHistory.filter((t) => t.status === "failed").length;
    const cancelled = this.testHistory.filter(
      (t) => t.status === "cancelled"
    ).length;

    const totalExecutionTime = this.testHistory.reduce((sum, test) => {
      return sum + (test.endTime.getTime() - test.startTime.getTime());
    }, 0);

    const totalSuccessRate = this.testHistory.reduce((sum, test) => {
      return sum + (1 - test.metrics.errorRate);
    }, 0);

    return {
      totalTests: total,
      successfulTests: successful,
      failedTests: failed,
      cancelledTests: cancelled,
      averageExecutionTime: totalExecutionTime / total,
      averageSuccessRate: totalSuccessRate / total,
    };
  }

  // Progress reporting across all components

  public getDetailedProgress(): {
    queueStatus: {
      pending: number;
      running: number;
      completed: number;
      failed: number;
    };
    runningTests: Array<{
      id: string;
      name: string;
      phase: string;
      progress: number;
      startTime: Date;
      estimatedCompletion?: Date;
    }>;
    recentCompletions: Array<{
      id: string;
      name: string;
      status: string;
      completionTime: Date;
      duration: number;
    }>;
    systemHealth: {
      memoryUsage: number;
      activeConnections: number;
      errorRate: number;
    };
  } {
    const queueStatus = this.getQueueStatus();

    const runningTests = this.executionQueue.running.map((execution) => ({
      id: execution.id,
      name: execution.spec.name,
      phase: execution.currentPhase,
      progress: execution.progress,
      startTime: execution.startTime,
      estimatedCompletion: this.estimateCompletionTime(execution),
    }));

    const recentCompletions = this.executionQueue.completed
      .slice(-5) // Last 5 completed tests
      .map((execution) => ({
        id: execution.id,
        name: execution.spec.name,
        status: execution.status,
        completionTime: execution.endTime || new Date(),
        duration:
          (execution.endTime?.getTime() || Date.now()) -
          execution.startTime.getTime(),
      }));

    // Basic system health metrics (would be enhanced with actual monitoring)
    const systemHealth = {
      memoryUsage:
        process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
      activeConnections: this.activeExecutions.size,
      errorRate: this.calculateRecentErrorRate(),
    };

    return {
      queueStatus,
      runningTests,
      recentCompletions,
      systemHealth,
    };
  }

  private estimateCompletionTime(execution: TestExecution): Date | undefined {
    if (execution.progress === 0) return undefined;

    const elapsed = Date.now() - execution.startTime.getTime();
    const estimatedTotal = (elapsed / execution.progress) * 100;
    const remaining = estimatedTotal - elapsed;

    return new Date(Date.now() + remaining);
  }

  private calculateRecentErrorRate(): number {
    const recentTests = this.testHistory.slice(-10); // Last 10 tests
    if (recentTests.length === 0) return 0;

    const failedTests = recentTests.filter((t) => t.status === "failed").length;
    return failedTests / recentTests.length;
  }

  // Cleanup and disposal

  public dispose(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }

    if (this.progressAggregator) {
      clearInterval(this.progressAggregator);
      this.progressAggregator = null;
    }

    // Cancel all running tests
    this.executionQueue.running.forEach((execution) => {
      execution.status = "cancelled";
      execution.endTime = new Date();
    });

    this.activeExecutions.clear();
    this.progressSubject.complete();
  }
}
