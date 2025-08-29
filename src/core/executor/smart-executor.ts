import { LoadTestSpec, TestResult } from "../../types";
import { BasicHttpExecutor } from "./simple-http-executor";
import { K6LoadExecutor } from "./k6-executor";
import { WorkflowExecutor } from "./workflow-executor";

export interface SmartExecutor {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
}

export class SmartLoadExecutor implements SmartExecutor {
  private simpleExecutor: BasicHttpExecutor;
  private k6Executor: K6LoadExecutor;
  private workflowExecutor: WorkflowExecutor;

  constructor() {
    this.simpleExecutor = new BasicHttpExecutor();
    this.k6Executor = new K6LoadExecutor();
    this.workflowExecutor = new WorkflowExecutor();
  }

  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const executorType = this.selectExecutor(spec);

    console.log(`🤖 Using ${executorType} executor for this test`);

    if (executorType === "workflow") {
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

  private selectExecutor(spec: LoadTestSpec): "simple" | "k6" | "workflow" {
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
