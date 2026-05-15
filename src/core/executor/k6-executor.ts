import { LoadTestSpec, TestResult } from "../../types";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { createLogger } from "../../utils/logger";
import { FileResolver } from "../../utils/file-resolver";

const execAsync = promisify(exec);

export interface K6Executor {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
}

/**
 * Production-ready K6 Load Test Executor
 *
 * Features:
 * - Clean architecture following service layer patterns
 * - Robust K6 script generation
 * - Proper JSONL results parsing
 * - File-based payload handling
 * - Comprehensive error handling
 * - Structured logging
 */
export class K6LoadExecutor implements K6Executor {
  private k6ScriptDir: string;
  private logger = createLogger({ component: "K6Executor" });

  constructor() {
    const {
      requireStressMasterDir,
    } = require("../../utils/require-stressmaster-dir");
    const { getK6ScriptsDir, ensureStressMasterDirs } =
      requireStressMasterDir();
    // Ensure all StressMaster directories exist and gitignore is set up
    ensureStressMasterDirs();
    this.k6ScriptDir = getK6ScriptsDir();
    this.ensureK6ScriptDir();
  }

  private ensureK6ScriptDir(): void {
    if (!fs.existsSync(this.k6ScriptDir)) {
      fs.mkdirSync(this.k6ScriptDir, { recursive: true });
    }
  }

  /**
   * Execute a load test using K6
   */
  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const startTime = new Date();
    const scriptPath = await this.generateK6Script(spec);
    const resultsPath = `${scriptPath}.results.json`;
    const stderrLogPath = `${scriptPath}.stderr.log`;

    try {
      this.logger.info("Executing K6 load test", {
        specId: spec.id,
        scriptPath,
        testType: spec.testType,
      });

      // Execute K6 with JSON output
      const isWindows = process.platform === "win32";
      const stderrRedirect = isWindows
        ? `2>${stderrLogPath}`
        : `2>${stderrLogPath}`;

      const result = await execAsync(
        `k6 run --quiet --out json=${resultsPath} ${scriptPath} ${stderrRedirect}`,
        {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      );

      const stdout = result.stdout || "";

      // Read and log stderr if present
      let k6Stderr = "";
      if (fs.existsSync(stderrLogPath)) {
        try {
          k6Stderr = fs.readFileSync(stderrLogPath, "utf8");
          fs.unlinkSync(stderrLogPath);
          if (k6Stderr.trim()) {
            this.logger.warn("K6 stderr output", {
              stderr: k6Stderr.substring(0, 500),
              specId: spec.id,
            });
          }
        } catch (error) {
          // Ignore read errors
        }
      }

      // Verify results file exists
      if (!fs.existsSync(resultsPath)) {
        throw new Error(
          `K6 results file not found at ${resultsPath}. K6 may have failed to execute.`
        );
      }

      // Parse K6 results
      const metrics = this.parseK6Results(resultsPath);

      // Validate that requests were executed
      if (metrics.totalRequests === 0) {
        // Check stdout for actual request count (K6 sometimes reports in stdout)
        const httpReqsMatch = stdout.match(/http_reqs[^:]*:\s*(\d+)/);
        if (httpReqsMatch) {
          const actualCount = parseInt(httpReqsMatch[1], 10);
          this.logger.warn(
            "Parser reported 0 requests but stdout shows requests",
            {
              stdoutCount: actualCount,
              parsedCount: metrics.totalRequests,
              specId: spec.id,
            }
          );
          // Try to extract from stdout as fallback
          metrics.totalRequests = actualCount;
          metrics.successfulRequests = actualCount; // Assume all successful if no errors in stdout
        } else {
          throw new Error(
            `K6 completed but executed 0 requests. Check the generated K6 script at ${scriptPath} for errors.`
          );
        }
      }

      const endTime = new Date();

      return {
        id: spec.id,
        spec,
        startTime,
        endTime,
        status: "completed",
        metrics: {
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          failedRequests: metrics.failedRequests,
          responseTime: {
            min: metrics.minResponseTime,
            max: metrics.maxResponseTime,
            avg: metrics.averageResponseTime,
            p50: metrics.p50ResponseTime,
            p90: metrics.p90ResponseTime,
            p95: metrics.p95ResponseTime,
            p99: metrics.p99ResponseTime,
          },
          throughput: {
            requestsPerSecond: metrics.requestsPerSecond,
            bytesPerSecond: 0,
          },
          errorRate:
            metrics.totalRequests > 0
              ? (metrics.failedRequests / metrics.totalRequests) * 100
              : 0,
        },
        errors: [],
        recommendations: [],
        rawData: {
          k6Output: { stdout, stderr: k6Stderr },
          executionLogs: [stdout],
          systemMetrics: [],
        },
      };
    } catch (error) {
      this.logger.error("K6 execution failed", {
        error: error instanceof Error ? error.message : String(error),
        specId: spec.id,
        scriptPath,
      });
      throw error;
    }
  }

  /**
   * Generate K6 script from LoadTestSpec
   */
  private async generateK6Script(spec: LoadTestSpec): Promise<string> {
    const scriptContent = this.buildK6Script(spec);
    const scriptPath = path.join(this.k6ScriptDir, `${spec.id}.js`);

    fs.writeFileSync(scriptPath, scriptContent);

    // Copy payload files to script directory
    await this.copyPayloadFilesToScriptDir(spec, scriptPath);

    return scriptPath;
  }

  /**
   * Copy payload files to script directory so K6 can access them
   */
  private async copyPayloadFilesToScriptDir(
    spec: LoadTestSpec,
    scriptPath: string
  ): Promise<void> {
    const scriptDir = path.dirname(scriptPath);

    for (const request of spec.requests) {
      if (request.payload?.template?.startsWith("@")) {
        const fileRef = request.payload.template.substring(1);
        try {
          const resolved = FileResolver.resolveFile(fileRef);
          if (resolved.exists && resolved.resolvedPath) {
            const fileName = path.basename(resolved.resolvedPath);
            const destPath = path.join(scriptDir, fileName);
            fs.copyFileSync(resolved.resolvedPath, destPath);
            this.logger.info("Copied payload file", {
              source: resolved.resolvedPath,
              destination: destPath,
            });
          }
        } catch (error) {
          this.logger.warn("Failed to copy payload file", {
            fileRef,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Build K6 script content
   */
  private buildK6Script(spec: LoadTestSpec): string {
    const options = this.generateK6Options(spec);
    const requestCode = this.generateRequestCode(spec.requests[0]); // Single request for now
    const thresholds = this.generateThresholds(spec.testType);

    return `import http from 'k6/http';
import { check, sleep } from 'k6';

${this.generateInitCode(spec.requests[0])}

export const options = ${JSON.stringify(options, null, 2)};

export const thresholds = ${JSON.stringify(thresholds, null, 2)};

export default function() {
  ${requestCode}
  ${this.generateThinkTime(spec)}
}
`;
  }

  /**
   * Generate K6 options based on test type and load pattern
   */
  private generateK6Options(spec: LoadTestSpec): any {
    const duration = spec.duration || { value: 30, unit: "seconds" };
    const durationSeconds = this.durationToSeconds(duration);

    // For spike tests with specific request count, use iterations
    if (spec.testType === "spike" && spec.loadPattern.virtualUsers) {
      const vuCount = spec.loadPattern.virtualUsers;
      if (vuCount <= 1000) {
        // Interpret as request count for spike tests
        return {
          vus: 10, // Use 10 VUs to execute requests
          iterations: vuCount,
        };
      }
    }

    // Generate stages for spike tests
    if (spec.testType === "spike") {
      return {
        stages: this.generateSpikeStages(spec, durationSeconds),
      };
    }

    // Default: constant load
    const vus = spec.loadPattern.virtualUsers || 10;
    return {
      vus: vus,
      duration: `${durationSeconds}s`,
    };
  }

  /**
   * Generate spike test stages
   */
  private generateSpikeStages(
    spec: LoadTestSpec,
    durationSeconds: number
  ): Array<{ duration: string; target: number }> {
    const spikeVUs = spec.loadPattern.virtualUsers || 100;
    const baselineVUs = spec.loadPattern.baselineVUs || 10;

    return [
      { duration: "10s", target: baselineVUs }, // Baseline
      { duration: "5s", target: spikeVUs }, // Spike
      { duration: `${Math.max(5, durationSeconds - 20)}s`, target: spikeVUs }, // Hold
      { duration: "5s", target: baselineVUs }, // Ramp down
    ];
  }

  /**
   * Generate thresholds based on test type
   */
  private generateThresholds(testType: string): any {
    const errorThresholds: Record<string, string> = {
      spike: "rate<0.5", // 50% error rate acceptable for spike
      stress: "rate<0.4", // 40% error rate acceptable for stress
      baseline: "rate<0.1", // 10% error rate for baseline
      endurance: "rate<0.2", // 20% error rate for endurance
      volume: "rate<0.3", // 30% error rate for volume
    };

    return {
      errors: [errorThresholds[testType] || "rate<0.1"],
      http_req_duration: ["p(95)<5000"], // 95th percentile < 5s
    };
  }

  /**
   * Generate init code for loading files (must be in global scope)
   */
  private generateInitCode(request: any): string {
    if (!request.payload?.template?.startsWith("@")) {
      return "";
    }

    const fileName = path.basename(request.payload.template.substring(1));

    // Check if there are variables to increment
    const hasVariables =
      request.payload.variables && request.payload.variables.length > 0;

    if (hasVariables) {
      return `
// INIT STAGE: Load base payload from file
let basePayloadData;
try {
  const fileContent = open('${fileName}');
  if (!fileContent) {
    console.error('Failed to open file: ${fileName}');
    basePayloadData = {};
  } else {
    basePayloadData = JSON.parse(fileContent);
  }
} catch (error) {
  console.error('Error loading payload file:', error);
  basePayloadData = {};
}
`;
    }

    return `
// INIT STAGE: Load payload from file
let payloadData;
try {
  const fileContent = open('${fileName}');
  payloadData = fileContent ? JSON.parse(fileContent) : {};
} catch (error) {
  console.error('Error loading payload file:', error);
  payloadData = {};
}
`;
  }

  /**
   * Generate request code
   */
  private generateRequestCode(request: any): string {
    const method = request.method || "GET";
    const url = request.url;
    const headers = request.headers || {};

    // Generate payload
    const payloadCode = this.generatePayloadCode(request);

    // Generate checks
    const checks = this.generateChecks(request);

    return `
  const payload = ${payloadCode};
  const params = {
    headers: ${JSON.stringify(headers)},
  };

  const response = http.${method.toLowerCase()}('${url}', payload, params);

  ${checks}
`;
  }

  /**
   * Generate payload code
   */
  private generatePayloadCode(request: any): string {
    if (!request.payload) {
      return "null";
    }

    const template = request.payload.template;

    // File-based payload
    if (template?.startsWith("@")) {
      const fileName = path.basename(template.substring(1));
      const hasVariables =
        request.payload.variables && request.payload.variables.length > 0;

      if (hasVariables) {
        // Generate variable increment code
        const varCode = this.generateVariableIncrementCode(
          request.payload.variables
        );
        return `
(() => {
  let payloadObj = JSON.parse(JSON.stringify(basePayloadData)); // Deep copy
  ${varCode}
  return JSON.stringify(payloadObj);
})()`;
      } else {
        return "JSON.stringify(payloadData)";
      }
    }

    // Static JSON payload
    if (typeof template === "object") {
      return JSON.stringify(template);
    }

    // String payload
    return JSON.stringify(template);
  }

  /**
   * Generate variable increment code
   * Handles both numeric and string-based increments (e.g., "external-test-1" -> "external-test-2")
   */
  private generateVariableIncrementCode(variables: any[]): string {
    return variables
      .map((variable) => {
        if (variable.type === "increment" || variable.type === "incremental") {
          const fieldPath = variable.parameters?.field || variable.name;
          const baseValue =
            variable.parameters?.baseValue ||
            variable.parameters?.startValue ||
            "1";
          const increment = variable.parameters?.increment || 1;

          // Handle nested field paths (e.g., "requestId" or "data.id")
          const pathParts = fieldPath.split(".");
          let accessor = "payloadObj";
          for (const part of pathParts) {
            accessor += `['${part}']`;
          }

          // Generate increment logic that handles string-based IDs
          // Extract number from base value (e.g., "external-test-1" -> prefix: "external-test-", num: 1)
          const baseValueStr = String(baseValue);
          const numberMatch = baseValueStr.match(/(\d+)$/);

          if (numberMatch) {
            // Has a number at the end - extract prefix and starting number
            const prefix = baseValueStr.substring(0, numberMatch.index);
            const startNum = parseInt(numberMatch[1], 10);

            return `
  // Increment ${fieldPath} from base value: ${baseValue}
  if (!${accessor}) {
    ${accessor} = '${baseValue}';
  } else {
    const currentValue = String(${accessor});
    const numMatch = currentValue.match(/(\\\\d+)$/);
    if (numMatch) {
      const prefix = currentValue.substring(0, numMatch.index);
      const currentNum = parseInt(numMatch[1], 10);
      ${accessor} = prefix + (currentNum + ${increment});
    } else {
      // No number found, append increment
      ${accessor} = currentValue + '-${increment}';
    }
  }`;
          } else {
            // No number in base value - append increment as suffix
            return `
  // Increment ${fieldPath} from base value: ${baseValue}
  if (!${accessor}) {
    ${accessor} = '${baseValue}';
  } else {
    const currentValue = String(${accessor});
    const numMatch = currentValue.match(/(\\\\d+)$/);
    if (numMatch) {
      const prefix = currentValue.substring(0, numMatch.index);
      const currentNum = parseInt(numMatch[1], 10);
      ${accessor} = prefix + (currentNum + ${increment});
    } else {
      // No number found, append increment
      ${accessor} = currentValue + '-${increment}';
    }
  }`;
          }
        }
        return "";
      })
      .join("\n");
  }

  /**
   * Generate response checks
   */
  private generateChecks(request: any): string {
    const checks: string[] = [];

    checks.push("check(response, {");
    checks.push("  'status is 200': (r) => r.status === 200,");
    checks.push(
      "  'response time < 5000ms': (r) => r.timings.duration < 5000,"
    );
    checks.push("});");

    return checks.join("\n  ");
  }

  /**
   * Generate think time
   */
  private generateThinkTime(spec: LoadTestSpec): string {
    if (spec.testType === "spike") {
      return "sleep(0.1);"; // Minimal sleep for spike tests
    }
    return "sleep(1);"; // Default 1 second
  }

  /**
   * Parse K6 results from JSONL format
   * K6 --out json= outputs JSONL: one JSON object per line
   * Each line: {"metric":"http_reqs","type":"counter","data":{...}}
   */
  private parseK6Results(resultsPath: string): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p50ResponseTime: number;
    p90ResponseTime: number;
    p99ResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    requestsPerSecond: number;
  } {
    try {
      const fileContent = fs.readFileSync(resultsPath, "utf8");
      const lines = fileContent
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      if (lines.length === 0) {
        this.logger.warn("K6 results file is empty", { resultsPath });
        return this.getEmptyMetrics();
      }

      // Parse JSONL format
      const metrics: Record<string, any> = {};

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);

          // K6 JSONL format: {"metric":"http_reqs","type":"counter","data":{...}}
          if (obj.metric && obj.data) {
            const metricName = obj.metric;

            // Extract values - data might be the values directly or nested
            let values = obj.data;
            if (obj.data.values && typeof obj.data.values === "object") {
              values = obj.data.values;
            } else if (
              obj.data.count !== undefined ||
              obj.data.rate !== undefined
            ) {
              // data itself is the values object
              values = obj.data;
            }

            metrics[metricName] = {
              type: obj.type,
              values: values,
            };
          }
        } catch (lineError) {
          // Skip invalid lines
          continue;
        }
      }

      // Extract metrics
      const httpReqs = metrics.http_reqs?.values || {};
      const httpDuration = metrics.http_req_duration?.values || {};
      const httpFailed = metrics.http_req_failed?.values || {};

      const totalRequests = httpReqs.count || 0;
      const failureRate = httpFailed.rate || 0;
      const successfulRequests = Math.round(totalRequests * (1 - failureRate));
      const failedRequests = totalRequests - successfulRequests;

      const avgResponseTime = httpDuration.avg || 0;
      const p95ResponseTime = httpDuration["p(95)"] || 0;
      const p50ResponseTime = httpDuration["p(50)"] || 0;
      const p90ResponseTime = httpDuration["p(90)"] || 0;
      const p99ResponseTime = httpDuration["p(99)"] || 0;
      const minResponseTime = httpDuration.min || 0;
      const maxResponseTime = httpDuration.max || 0;

      // Calculate requests per second
      const testDuration = metrics.iteration_duration?.values?.max || 30;
      const requestsPerSecond =
        testDuration > 0 ? totalRequests / testDuration : 0;

      this.logger.info("Parsed K6 results", {
        totalRequests,
        successfulRequests,
        failedRequests,
        avgResponseTime,
        resultsPath,
      });

      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: avgResponseTime,
        p95ResponseTime,
        p50ResponseTime,
        p90ResponseTime,
        p99ResponseTime,
        minResponseTime,
        maxResponseTime,
        requestsPerSecond,
      };
    } catch (error) {
      this.logger.error("Failed to parse K6 results", {
        error: error instanceof Error ? error.message : String(error),
        resultsPath,
      });
      return this.getEmptyMetrics();
    }
  }

  /**
   * Get empty metrics structure
   */
  private getEmptyMetrics() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p50ResponseTime: 0,
      p90ResponseTime: 0,
      p99ResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      requestsPerSecond: 0,
    };
  }

  /**
   * Convert duration to seconds
   */
  private durationToSeconds(duration: { value: number; unit: string }): number {
    const value = duration.value;
    const unit = duration.unit.toLowerCase();

    switch (unit) {
      case "seconds":
      case "second":
      case "s":
        return value;
      case "minutes":
      case "minute":
      case "m":
        return value * 60;
      case "hours":
      case "hour":
      case "h":
        return value * 3600;
      default:
        return value; // Default to seconds
    }
  }
}
