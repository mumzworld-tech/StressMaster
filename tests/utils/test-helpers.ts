/**
 * Shared test utilities and helper functions
 * Consolidates common testing patterns from across the test suite
 */

import { LoadTestSpec } from "../../src/types";

/**
 * Creates a basic LoadTestSpec for testing
 */
export function createMockLoadTestSpec(
  overrides: Partial<LoadTestSpec> = {}
): LoadTestSpec {
  return {
    id: "test-spec",
    name: "Test Load Test",
    description: "A test load test specification",
    testType: "baseline",
    duration: { value: 30, unit: "seconds" },
    requests: [
      {
        method: "GET",
        url: "https://api.example.com/test",
        headers: {},
      },
    ],
    loadPattern: { type: "constant", virtualUsers: 1 },
    ...overrides,
  };
}

/**
 * Creates mock test result data
 */
export function createMockTestResult(overrides: any = {}) {
  return {
    id: "test-result",
    name: "Test Result",
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 30000).toISOString(),
    duration: 30000,
    status: "completed",
    metrics: {
      totalRequests: 100,
      requestsPerSecond: 3.33,
      averageResponseTime: 150,
      minResponseTime: 50,
      maxResponseTime: 500,
      errorRate: 0,
      successRate: 100,
    },
    ...overrides,
  };
}

/**
 * Waits for a specified amount of time (for async testing)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock file path for testing
 */
export function createMockFilePath(filename: string): string {
  return `/tmp/test-${Date.now()}-${filename}`;
}

/**
 * Validates that a LoadTestSpec has required fields
 */
export function validateLoadTestSpec(spec: LoadTestSpec): boolean {
  return !!(
    spec.id &&
    spec.name &&
    spec.requests &&
    spec.requests.length > 0 &&
    spec.loadPattern
  );
}

/**
 * Creates a mock AI provider response
 */
export function createMockAIResponse(
  spec: Partial<LoadTestSpec> = {}
): LoadTestSpec {
  return createMockLoadTestSpec(spec);
}

/**
 * Common test data patterns
 */
export const TEST_PATTERNS = {
  SIMPLE_GET: "GET https://api.example.com/data",
  SIMPLE_POST: "POST https://api.example.com/users",
  WITH_HEADERS: `POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123`,
  WITH_BODY: `POST https://api.example.com/users
Content-Type: application/json

{"name": "John Doe"}`,
  WITH_LOAD_PATTERN:
    "GET https://api.example.com/data with 10 users for 30 seconds",
  CURL_COMMAND: `curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John"}'`,
};

/**
 * Common assertion helpers
 */
export const ASSERTIONS = {
  hasMethod: (spec: any, method: string) =>
    spec.method === method || spec.requests?.[0]?.method === method,
  hasUrl: (spec: any, url: string) =>
    spec.url === url || spec.requests?.[0]?.url === url,
  hasHeader: (spec: any, key: string, value?: string) => {
    const headers = spec.headers || spec.requests?.[0]?.headers || {};
    return value ? headers[key] === value : key in headers;
  },
  hasBody: (spec: any, body?: string) => {
    const specBody = spec.body || spec.requests?.[0]?.body;
    return body ? specBody === body : !!specBody;
  },
  hasLoadPattern: (spec: any) => !!spec.loadPattern,
};
