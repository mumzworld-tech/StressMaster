export interface BackendExecutionRequest {
  command: string;
}

export interface BackendMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime?: number;
  p95ResponseTime?: number;
  p99ResponseTime?: number;
  requestsPerSecond?: number;
  // Backend actually returns nested structure
  responseTime?: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughput?: {
    requestsPerSecond: number;
    bytesPerSecond: number;
  };
}

export interface BackendExecutionResponse {
  testId: string;
  status: string;
  results?: {
    metrics?: BackendMetrics;
  };
}

export interface BackendStatusResponse {
  testId: string;
  status: string;
  progress: number;
  results?: {
    metrics?: BackendMetrics;
  };
}

class StressMasterBackend {
  private baseUrl: string;

  constructor() {
    // Point to your backend server
    this.baseUrl = "http://localhost:3001";
  }

  async executeLoadTest(
    request: BackendExecutionRequest
  ): Promise<BackendExecutionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/loadtest/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: request.command,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to execute load test:", error);
      throw error;
    }
  }

  async getTestStatus(testId: string): Promise<BackendStatusResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/loadtest/status/${testId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to get test status:", error);
      throw error;
    }
  }
}

export const stressMasterBackend = new StressMasterBackend();
