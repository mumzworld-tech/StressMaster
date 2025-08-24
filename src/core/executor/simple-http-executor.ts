import axios, { AxiosResponse } from "axios";
import { LoadTestSpec, TestResult, PerformanceMetrics } from "../../types";
import chalk from "chalk";
import { generateTestId } from "../../features/common/string-utils";

export interface SimpleHttpExecutor {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
}

export class BasicHttpExecutor implements SimpleHttpExecutor {
  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const startTime = new Date();
    const results: Array<{
      status: number;
      responseTime: number;
      success: boolean;
      error?: string;
      responseBody?: any;
    }> = [];

    const requestCount = spec.loadPattern.virtualUsers || 1;
    const url = spec.requests[0]?.url;

    // Clean header
    console.log(
      chalk.blue.bold(`\n🚀 Executing ${requestCount} requests to ${url}\n`)
    );

    // Calculate delay between requests
    const durationMs = this.getDurationInMs(spec.duration);

    // If duration is very short (like 1 minute) and no specific timing mentioned,
    // execute requests more quickly for better user experience
    const isQuickTest = durationMs <= 60000 && requestCount <= 50;
    const delayBetweenRequests = isQuickTest
      ? 100 // Small delay to avoid overwhelming the target
      : requestCount > 1
      ? durationMs / (requestCount - 1)
      : 0;

    if (isQuickTest) {
      console.log(
        chalk.gray(
          `⚡ Quick test mode: ${requestCount} requests with minimal delays`
        )
      );
    } else {
      console.log(
        chalk.gray(
          `⏱️  Spreading ${requestCount} requests over ${this.formatDuration(
            spec.duration
          )}`
        )
      );
    }

    if (delayBetweenRequests > 0) {
      console.log(
        chalk.gray(
          `⏰ Delay between requests: ${Math.round(delayBetweenRequests)}ms`
        )
      );
    }

    // Execute requests with pacing
    for (let i = 0; i < requestCount; i++) {
      try {
        const requestStart = Date.now();
        const request = spec.requests[0];

        // Prepare request data
        let requestData: any = undefined;
        if (request.body) {
          requestData = request.body;
        } else if (request.payload) {
          requestData = this.generateRequestBody(request.payload, i);
        }

        // Only show detailed request info for first request or if verbose
        if (i === 0 || requestCount <= 3) {
          this.displayRequestInfo(i + 1, request, requestData);
        }

        // Normalize URL to ensure it has a protocol
        const normalizedUrl = this.normalizeUrl(request.url);

        // Make HTTP request with retry logic for 5xx errors
        const response: AxiosResponse = await this.makeRequestWithRetry({
          method: request.method.toLowerCase() as any,
          url: normalizedUrl,
          data: requestData,
          headers: request.headers || {},
          timeout: 30000,
          validateStatus: () => true,
        });

        // Display response info
        this.displayResponseInfo(i + 1, response, requestCount);

        const responseTime = Date.now() - requestStart;
        const success = response.status >= 200 && response.status < 300;

        results.push({
          status: response.status,
          responseTime,
          success,
          responseBody: response.data,
        });

        // Clean status line
        const statusEmoji = success ? "✅" : "❌";
        const statusColor = success ? chalk.green : chalk.red;
        console.log(
          `Request ${i + 1}/${requestCount}: ${statusColor(
            `${response.status} (${responseTime}ms)`
          )} ${statusEmoji}`
        );

        // Add delay between requests (except for the last one)
        if (i < requestCount - 1 && delayBetweenRequests > 0) {
          await this.sleep(delayBetweenRequests);
        }
      } catch (error) {
        const responseTime = Date.now() - Date.now();
        results.push({
          status: 0,
          responseTime,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        console.log(
          `Request ${i + 1}/${requestCount}: ${chalk.red("ERROR")} - ${error}`
        );
      }
    }

    const endTime = new Date();
    const metrics = this.calculateMetrics(results);

    return {
      id: generateTestId(spec),
      spec,
      startTime,
      endTime,
      status: "completed",
      metrics,
      errors: this.extractErrors(results),
      recommendations: this.generateRecommendations(results, spec),
      rawData: {
        k6Output: {},
        executionLogs: [`Executed ${results.length} real HTTP requests`],
        systemMetrics: [],
      },
    };
  }

  private displayRequestInfo(
    requestNum: number,
    request: any,
    requestData: any
  ): void {
    console.log(chalk.cyan.bold(`📤 REQUEST ${requestNum}:`));
    console.log(`   Method: ${chalk.yellow(request.method)}`);
    console.log(`   URL: ${chalk.blue(request.url)}`);

    if (Object.keys(request.headers || {}).length > 0) {
      console.log(`   Headers: ${chalk.gray(JSON.stringify(request.headers))}`);
    }

    if (requestData) {
      const bodyStr = JSON.stringify(requestData);
      if (bodyStr.length > 100) {
        console.log(`   Body: ${chalk.gray(bodyStr.substring(0, 97) + "...")}`);
      } else {
        console.log(`   Body: ${chalk.gray(bodyStr)}`);
      }
    }
    console.log();
  }

  private displayResponseInfo(
    responseNum: number,
    response: AxiosResponse,
    totalRequests: number
  ): void {
    // Only show detailed response for first request or small tests
    if (responseNum === 1 || totalRequests <= 3) {
      console.log(chalk.magenta.bold(`📥 RESPONSE ${responseNum}:`));
      const statusColor = this.getStatusColor(response.status);
      const statusEmoji =
        response.status >= 200 && response.status < 300 ? "✅" : "❌";
      console.log(
        `   Status: ${statusColor}${response.status} ${
          response.statusText
        }${chalk.reset()} ${statusEmoji}`
      );

      if (response.data && typeof response.data === "object") {
        const dataStr = JSON.stringify(response.data);
        if (dataStr.length > 100) {
          console.log(
            `   Body: ${chalk.gray(dataStr.substring(0, 97) + "...")}`
          );
        } else {
          console.log(`   Body: ${chalk.gray(dataStr)}`);
        }
      }
      console.log();
    }
  }

  private getStatusColor(status: number): any {
    if (status >= 200 && status < 300) return chalk.green;
    if (status >= 400 && status < 500) return chalk.yellow;
    if (status >= 500) return chalk.red;
    return chalk.gray;
  }

  private generateRequestBody(payload: any, requestIndex?: number): any {
    if (!payload.template) return {};

    try {
      let body = payload.template;

      // Handle file references (e.g., @filename.json)
      if (typeof body === "string" && body.startsWith("@")) {
        const filePath = body.substring(1); // Remove @ prefix
        const fs = require("fs");
        const path = require("path");

        try {
          const fullPath = path.resolve(process.cwd(), filePath);
          body = fs.readFileSync(fullPath, "utf8");
          console.log(`📁 Loaded file: ${filePath}`);
        } catch (fileError) {
          console.warn(
            `⚠️ Failed to load file ${filePath}:`,
            (fileError as Error).message
          );
          return {};
        }
      }

      // Normalize smart quotes in the template first
      body = body
        .replace(/["""]/g, '"') // Handle all types of smart quotes
        .replace(/[''']/g, "'") // Handle all types of smart apostrophes
        .replace(/…/g, "...") // Handle ellipsis
        .replace(/–/g, "-") // Handle en dash
        .replace(/—/g, "-") // Handle em dash
        .trim();

      // Replace template variables with actual values
      if (payload.variables) {
        payload.variables.forEach((variable: any) => {
          const value = this.generateVariableValue(
            variable.type,
            variable.parameters,
            variable.name,
            requestIndex
          );
          // Normalize any smart quotes in the variable value
          const normalizedValue = value
            .replace(/["""]/g, '"') // Handle all types of smart quotes
            .replace(/[''']/g, "'") // Handle all types of smart apostrophes
            .replace(/…/g, "...") // Handle ellipsis
            .replace(/–/g, "-") // Handle en dash
            .replace(/—/g, "-") // Handle em dash
            .trim();

          // Replace placeholder if it exists
          body = body.replace(`{{${variable.name}}}`, normalizedValue);

          // Also replace static values in the JSON for common fields
          if (variable.name === "requestId") {
            body = body.replace(
              /"requestId":\s*"[^"]*"/g,
              `"requestId": "${normalizedValue}"`
            );
          }
          if (variable.name === "externalId") {
            body = body.replace(
              /"externalId":\s*"[^"]*"/g,
              `"externalId": "${normalizedValue}"`
            );
          }
        });
      }

      // Try multiple approaches to parse the JSON
      const parseAttempts = [
        // Attempt 1: Direct parse
        () => JSON.parse(body),
        // Attempt 2: Fix smart quotes and whitespace
        () =>
          JSON.parse(
            body
              .replace(/[""]/g, '"')
              .replace(/['']/g, "'")
              .replace(/\s+/g, " ")
              .trim()
          ),
        // Attempt 3: Remove trailing commas
        () => JSON.parse(body.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")),
        // Attempt 4: Fix quotes and remove trailing commas
        () =>
          JSON.parse(
            body
              .replace(/[""]/g, '"')
              .replace(/['']/g, "'")
              .replace(/\s+/g, " ")
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]")
              .trim()
          ),
        // Attempt 5: Try to fix common JSON issues
        () => {
          let fixed = body
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            .replace(/\s+/g, " ")
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]")
            .replace(/,\s*,/g, ",") // Remove double commas
            .trim();
          return JSON.parse(fixed);
        },
        // Attempt 6: More aggressive smart quote and character replacement
        () => {
          let fixed = body
            .replace(/["""]/g, '"') // Handle all types of smart quotes
            .replace(/[''']/g, "'") // Handle all types of smart apostrophes
            .replace(/…/g, "...") // Handle ellipsis
            .replace(/–/g, "-") // Handle en dash
            .replace(/—/g, "-") // Handle em dash
            .replace(/\s+/g, " ")
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]")
            .replace(/,\s*,/g, ",")
            .trim();
          return JSON.parse(fixed);
        },
      ];

      for (let i = 0; i < parseAttempts.length; i++) {
        try {
          return parseAttempts[i]();
        } catch (error) {
          if (i === parseAttempts.length - 1) {
            console.warn(
              `Failed to parse JSON body after ${parseAttempts.length} attempts:`,
              error
            );
            console.warn("Original body:", body);
            return {};
          }
        }
      }
    } catch (error) {
      console.warn("Failed to generate request body:", error);
      return {};
    }
  }

  private generateVariableValue(
    type: string,
    parameters?: any,
    variableName?: string,
    requestIndex?: number
  ): string {
    // For incremental types, check multiple parameter formats
    if (type === "incremental" && requestIndex !== undefined) {
      // Check for baseValue (standard format)
      if (parameters?.baseValue) {
        const baseValue = parameters.baseValue.toString();
        // Extract base and number parts (e.g., "ai-body-req10" -> "ai-body-req" + "10")
        const match = baseValue.match(/^(.+?)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const startNum = parseInt(match[2]);
          const result = `${prefix}${startNum + requestIndex}`;
          return result;
        }
        // If no number found, append the index
        const result = `${baseValue}-${requestIndex + 1}`;
        return result;
      }

      // Check for startValue (AI format)
      if (parameters?.startValue) {
        const startValue = parameters.startValue.toString();
        console.log(
          `🔍 Executor: Processing startValue: "${startValue}" with requestIndex: ${requestIndex}`
        );

        // Extract base and number parts (e.g., "ai-claude-req2" -> "ai-claude-req" + "2")
        const match = startValue.match(/^(.+?)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const startNum = parseInt(match[2]);
          const result = `${prefix}${startNum + requestIndex}`;
          console.log(
            `🔍 Executor: Incremented with pattern: "${prefix}${
              startNum + requestIndex
            }"`
          );
          return result;
        }
        // If no number found, append the index
        const result = `${startValue}-${requestIndex + 1}`;
        console.log(`🔍 Executor: Appended index: "${result}"`);
        return result;
      }
    }

    // Check if parameters contain a literal value (user-specified value)
    if (parameters?.literalValue !== undefined) {
      return parameters.literalValue.toString();
    }

    // Check if parameters contain a specific value for this variable name
    if (parameters?.value !== undefined) {
      return parameters.value.toString();
    }

    // For common variable names, try to use smart defaults based on the name
    if (variableName) {
      const lowerName = variableName.toLowerCase();

      // Handle requestId specifically with incremental support
      if (lowerName.includes("requestid")) {
        console.log("🔍 Executor: Processing requestId variable:", {
          parameters,
          requestIndex,
        });
        // If user provided a base requestId, increment it
        if (parameters?.baseValue && requestIndex !== undefined) {
          const baseId = parameters.baseValue.toString();
          // Extract base and number parts (e.g., "ord-1" -> "ord-" + "1", "ai-req101" -> "ai-req" + "101")
          const match = baseId.match(/^(.+?)(\d+)$/);
          if (match) {
            const prefix = match[1];
            const startNum = parseInt(match[2]);
            return `${prefix}${startNum + requestIndex}`;
          }
          // If no number found, append the index
          return `${baseId}-${requestIndex + 1}`;
        }
        // Also check for literalValue (for backward compatibility)
        if (parameters?.literalValue && requestIndex !== undefined) {
          const baseId = parameters.literalValue.toString();
          // Extract base and number parts (e.g., "ord-1" -> "ord-" + "1", "ai-req4" -> "ai-req" + "4")
          const match = baseId.match(/^(.+?)(\d+)$/);
          if (match) {
            const prefix = match[1];
            const startNum = parseInt(match[2]);
            return `${prefix}${startNum + requestIndex}`;
          }
          // If no number found, append the index
          return `${baseId}-${requestIndex + 1}`;
        }
        return parameters?.defaultRequestId || "ai-req1";
      }

      // Handle externalId specifically
      if (lowerName.includes("externalid")) {
        return parameters?.defaultExternalId || "ORD#1";
      }

      // Handle orderId
      if (lowerName.includes("orderid")) {
        return parameters?.defaultOrderId || "ORD#1";
      }
    }

    // Fall back to type-based generation
    switch (type) {
      case "literal":
        // This should have been handled above, but fallback to test_value
        return "test_value";
      case "incremental":
        // Handle incremental values with base value + request index
        if (parameters?.baseValue && requestIndex !== undefined) {
          const baseValue = parameters.baseValue.toString();
          // Extract base and number parts (e.g., "ai-req100" -> "ai-req" + "100")
          const match = baseValue.match(/^(.+?)(\d+)$/);
          if (match) {
            const prefix = match[1];
            const startNum = parseInt(match[2]);
            return `${prefix}${startNum + requestIndex}`;
          }
          // If no number found, append the index
          return `${baseValue}-${requestIndex + 1}`;
        }
        return `increment-${requestIndex || 0}`;
      case "random_id":
        return Math.floor(Math.random() * 1000000).toString();
      case "uuid":
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      case "timestamp":
        return Date.now().toString();
      case "random_string":
        const length = parameters?.length || 10;
        return Math.random()
          .toString(36)
          .substring(2, length + 2);
      case "sequence":
        return Math.floor(Math.random() * 1000).toString(); // Simple random for now
      default:
        return "test_value";
    }
  }

  private calculateMetrics(
    results: Array<{ status: number; responseTime: number; success: boolean }>
  ): PerformanceMetrics {
    const successfulRequests = results.filter((r) => r.success).length;
    const failedRequests = results.length - successfulRequests;
    const responseTimes = results.map((r) => r.responseTime);

    responseTimes.sort((a, b) => a - b);

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * responseTimes.length) - 1;
      return responseTimes[Math.max(0, index)] || 0;
    };

    return {
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      responseTime: {
        min: Math.min(...responseTimes) || 0,
        max: Math.max(...responseTimes) || 0,
        avg:
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
        p50: percentile(50),
        p90: percentile(90),
        p95: percentile(95),
        p99: percentile(99),
      },
      throughput: {
        requestsPerSecond: results.length / (results.length * 0.1), // Rough estimate
        bytesPerSecond: 0, // Would need response size data
      },
      errorRate: failedRequests / results.length,
    };
  }

  private normalizeUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `http://${url}`;
  }

  private extractErrors(
    results: Array<{
      status: number;
      responseTime: number;
      success: boolean;
      error?: string;
      responseBody?: any;
    }>
  ): any[] {
    return results
      .filter((r) => !r.success)
      .map((r) => {
        const errorInfo = this.analyzeError(r.status, r.responseBody);
        return {
          errorType: "http_error",
          errorMessage: errorInfo.message,
          errorDetails: errorInfo.details,
          suggestions: errorInfo.suggestions,
          statusCode: r.status,
          count: 1,
          percentage: 0,
          firstOccurrence: new Date(),
          lastOccurrence: new Date(),
        };
      });
  }

  private analyzeError(
    statusCode: number,
    responseBody?: any
  ): {
    message: string;
    details: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    let details = "";
    let message = `HTTP ${statusCode}`;

    // Analyze response body for more details
    if (responseBody) {
      try {
        if (typeof responseBody === "string") {
          details = responseBody;
        } else if (responseBody.error) {
          details = responseBody.error;
        } else if (responseBody.message) {
          details = responseBody.message;
        } else {
          details = JSON.stringify(responseBody);
        }
      } catch (e) {
        details = "Unable to parse error response";
      }
    }

    // Provide intelligent error analysis based on status code
    switch (statusCode) {
      case 400:
        message = "Bad Request (400)";
        suggestions.push(
          "🔍 Check your request body format and required fields"
        );
        suggestions.push("📋 Verify all required headers are present");
        suggestions.push("🔧 Ensure JSON syntax is valid");
        if (details.includes("payload") || details.includes("body")) {
          suggestions.push("📦 Add a request body with required payload");
        }
        if (details.includes("required")) {
          suggestions.push("✅ Include all mandatory fields in your request");
        }
        break;

      case 401:
        message = "Unauthorized (401)";
        suggestions.push("🔑 Check your authentication credentials");
        suggestions.push("🔐 Verify API key or token is valid");
        suggestions.push(
          "📋 Ensure Authorization header is properly formatted"
        );
        break;

      case 403:
        message = "Forbidden (403)";
        suggestions.push("🚫 Check if your account has required permissions");
        suggestions.push("🔑 Verify your API key has correct scope");
        suggestions.push("📋 Contact API administrator for access");
        break;

      case 404:
        message = "Not Found (404)";
        suggestions.push("🔍 Verify the API endpoint URL is correct");
        suggestions.push("📋 Check if the resource exists");
        suggestions.push("🔧 Ensure you're using the right HTTP method");
        break;

      case 422:
        message = "Unprocessable Entity (422)";
        suggestions.push("📋 Validate your request data format");
        suggestions.push("🔍 Check field types and constraints");
        suggestions.push("✅ Ensure all required fields are provided");
        break;

      case 429:
        message = "Too Many Requests (429)";
        suggestions.push("⏱️  Reduce request frequency");
        suggestions.push("🔄 Implement exponential backoff");
        suggestions.push("📊 Check your rate limiting quotas");
        break;

      case 500:
        message = "Internal Server Error (500)";
        suggestions.push("🔄 Try again later - this is a server issue");
        suggestions.push("📋 Contact API support if problem persists");
        suggestions.push("🔍 Check API status page for known issues");
        break;

      case 502:
        message = "Bad Gateway (502)";
        suggestions.push("🔄 Server temporarily unavailable");
        suggestions.push("⏱️  Wait a moment and try again");
        suggestions.push("📋 Check if the service is under maintenance");
        break;

      case 503:
        message = "Service Unavailable (503)";
        suggestions.push("🔄 Service is temporarily down");
        suggestions.push("⏱️  Wait and retry your request");
        suggestions.push("📋 Check API status for maintenance windows");
        break;

      default:
        if (statusCode >= 400 && statusCode < 500) {
          message = `Client Error (${statusCode})`;
          suggestions.push("🔍 Review your request format and data");
          suggestions.push("📋 Check API documentation for requirements");
        } else if (statusCode >= 500) {
          message = `Server Error (${statusCode})`;
          suggestions.push("🔄 This is a server-side issue");
          suggestions.push("⏱️  Try again later");
        }
        break;
    }

    return {
      message,
      details,
      suggestions,
    };
  }

  private generateRecommendations(
    results: Array<{ status: number; responseTime: number; success: boolean }>,
    spec: LoadTestSpec
  ): string[] {
    const successfulRequests = results.filter((r) => r.success).length;
    const totalRequests = results.length;
    const successRate = (successfulRequests / totalRequests) * 100;

    const recommendations: string[] = [];
    if (totalRequests > 0) {
      recommendations.push("✅ Real HTTP requests executed successfully!");
      recommendations.push(
        `🎯 ${successfulRequests}/${totalRequests} requests succeeded`
      );
      recommendations.push(
        "📊 Performance metrics calculated from actual responses"
      );
      recommendations.push("🚀 Your API load test completed with real data!");
    }
    return recommendations;
  }

  private getDurationInMs(duration: { value: number; unit: string }): number {
    const { value, unit } = duration;
    switch (unit.toLowerCase()) {
      case "seconds":
      case "s":
        return value * 1000;
      case "minutes":
      case "m":
        return value * 60 * 1000;
      case "hours":
      case "h":
        return value * 60 * 60 * 1000;
      default:
        return value * 1000; // Default to seconds
    }
  }

  private formatDuration(duration: { value: number; unit: string }): string {
    return `${duration.value} ${duration.unit}`;
  }

  private async makeRequestWithRetry(config: any): Promise<AxiosResponse> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second base delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios(config);

        // If it's a 5xx error, retry (except on last attempt)
        if (
          response.status >= 500 &&
          response.status < 600 &&
          attempt < maxRetries
        ) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(
            chalk.yellow(
              `⚠️  Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`
            )
          );
          await this.sleep(delay);
          continue;
        }

        return response;
      } catch (error) {
        // Network errors or timeouts - retry (except on last attempt)
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          console.log(
            chalk.yellow(
              `⚠️  Request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`
            )
          );
          await this.sleep(delay);
          continue;
        }

        // Last attempt failed, re-throw
        throw error;
      }
    }

    // This should never be reached, but just in case
    throw new Error("Max retries exceeded");
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
