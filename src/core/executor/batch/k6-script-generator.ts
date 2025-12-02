import { BatchTestItem, BatchTestSpec } from "../../../types/load-test-spec";

export class K6ScriptGenerator {
  /**
   * Get error rate threshold based on test type
   */
  private getErrorThreshold(testType: string): number {
    switch (testType) {
      case "spike":
        return 0.5; // 50% - spike tests intentionally overwhelm servers
      case "stress":
        return 0.4; // 40% - stress tests push limits
      case "endurance":
        return 0.2; // 20% - endurance tests should be stable
      case "volume":
        return 0.3; // 30% - volume tests may have some errors under high load
      case "baseline":
      default:
        return 0.1; // 10% - baseline tests should be stable
    }
  }

  async generateScript(
    test: BatchTestItem,
    batchSpec: BatchTestSpec
  ): Promise<string> {
    const errorThreshold = this.getErrorThreshold(test.testType);

    // This would integrate with the existing K6 executor's script generation
    // For now, return a basic template
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: ${test.loadPattern?.virtualUsers || 10} },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    errors: ['rate<${errorThreshold}'],
  },
};

export default function() {
  const url = '${test.requests[0]?.url || ""}';
  const method = '${test.requests[0]?.method || "GET"}';
  const headers = ${JSON.stringify(test.requests[0]?.headers || {})};
  
  const payload = ${
    test.requests[0]?.body ? JSON.stringify(test.requests[0].body) : "null"
  };
  
  const response = http.request(method, url, payload, { headers });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 5000ms': (r) => r.timings.duration < 5000,
  });
  
  errorRate.add(response.status !== 200);
  
  sleep(1);
}
`;
  }

  async generateScriptsForBatch(
    batchSpec: BatchTestSpec
  ): Promise<Map<string, string>> {
    const scripts = new Map<string, string>();

    if (!batchSpec.k6Config?.generateSeparateScripts) return scripts;

    for (const test of batchSpec.tests) {
      if (test.k6Overrides?.customScript) {
        // Use custom script if provided
        scripts.set(test.id, test.k6Overrides.customScript);
      } else {
        // Generate standard K6 script
        const scriptContent = await this.generateScript(test, batchSpec);
        scripts.set(test.id, scriptContent);
      }
    }

    return scripts;
  }
}
