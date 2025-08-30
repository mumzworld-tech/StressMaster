import { BatchTestAssertion } from "../../../types/load-test-spec";
import { TestResult } from "../../../types/test-result";
import { AssertionResult } from "./types";

export class AssertionProcessor {
  runAssertions(
    assertions: BatchTestAssertion[],
    result: TestResult
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    for (const assertion of assertions) {
      const actualValue = this.getAssertionValue(assertion, result);
      const passed = this.evaluateAssertion(assertion, actualValue);

      results.push({
        name: assertion.name,
        type: assertion.type,
        condition: assertion.condition,
        expectedValue: assertion.expectedValue,
        actualValue,
        passed,
        tolerance: assertion.tolerance,
      });
    }

    return results;
  }

  private getAssertionValue(
    assertion: BatchTestAssertion,
    result: TestResult
  ): any {
    switch (assertion.type) {
      case "response_time":
        return result.metrics?.responseTime?.avg || 0;
      case "success_rate":
        return result.metrics
          ? result.metrics.successfulRequests / result.metrics.totalRequests
          : 0;
      case "throughput":
        return result.metrics?.throughput?.requestsPerSecond || 0;
      case "error_rate":
        return result.metrics?.errorRate || 0;
      case "custom":
        // Evaluate custom expression
        return this.evaluateCustomExpression(
          assertion.customExpression || "",
          result
        );
      default:
        return 0;
    }
  }

  private evaluateAssertion(
    assertion: BatchTestAssertion,
    actualValue: any
  ): boolean {
    const { condition, expectedValue, tolerance = 0 } = assertion;

    switch (condition) {
      case "less_than":
        return actualValue < expectedValue;
      case "greater_than":
        return actualValue > expectedValue;
      case "equals":
        return Math.abs(actualValue - expectedValue) <= tolerance;
      case "not_equals":
        return Math.abs(actualValue - expectedValue) > tolerance;
      case "contains":
        return String(actualValue).includes(String(expectedValue));
      default:
        return false;
    }
  }

  private evaluateCustomExpression(
    expression: string,
    result: TestResult
  ): any {
    // Simple expression evaluator - can be enhanced
    try {
      // Replace placeholders with actual values
      let evalExpression = expression
        .replace(
          /\{\{responseTime\}\}/g,
          String(result.metrics?.responseTime?.avg || 0)
        )
        .replace(
          /\{\{successRate\}\}/g,
          String(
            result.metrics
              ? result.metrics.successfulRequests / result.metrics.totalRequests
              : 0
          )
        )
        .replace(
          /\{\{throughput\}\}/g,
          String(result.metrics?.throughput?.requestsPerSecond || 0)
        )
        .replace(/\{\{errorRate\}\}/g, String(result.metrics?.errorRate || 0));

      return eval(evalExpression);
    } catch (error) {
      console.warn(
        `Failed to evaluate custom expression: ${expression}`,
        error
      );
      return 0;
    }
  }
}
