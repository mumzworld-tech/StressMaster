import { LoadTestSpec, TestResult } from "../../types";
import { BasicHttpExecutor } from "./simple-http-executor";
import { K6LoadExecutor } from "./k6-executor";

export interface SmartExecutor {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
}

export class SmartLoadExecutor implements SmartExecutor {
  private simpleExecutor: BasicHttpExecutor;
  private k6Executor: K6LoadExecutor;

  constructor() {
    this.simpleExecutor = new BasicHttpExecutor();
    this.k6Executor = new K6LoadExecutor();
  }

  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const executorType = this.selectExecutor(spec);

    console.log(`🤖 Using ${executorType} executor for this test`);

    if (executorType === "simple") {
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

  private selectExecutor(spec: LoadTestSpec): "simple" | "k6" {
    const requestCount = spec.loadPattern.virtualUsers || 1;
    const loadPatternType = spec.loadPattern.type;
    const testType = spec.testType;

    // Use K6 executor for:
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
