/**
 * Workflow Generator - Creates multi-step test scenarios
 * with data correlation and authentication flows
 */

import {
  WorkflowStep,
  LoadTestSpec,
  RequestSpec,
  CorrelationRule,
  WorkflowRequest,
} from "../../types";
import { DynamicPayloadGenerator } from "./dynamic-payload-generator";

export interface WorkflowConfig {
  steps: WorkflowStepConfig[];
  dataCorrelation?: CorrelationConfig[];
  authentication?: AuthConfig;
}

export interface WorkflowStepConfig {
  id: string;
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  thinkTime?: number;
  conditions?: StepConditionConfig[];
  dataExtraction?: DataExtractionConfig[];
}

export interface CorrelationConfig {
  sourceStep: string;
  sourceField: string;
  targetStep: string;
  targetField: string;
  extractor?: "json_path" | "regex" | "xpath";
  expression?: string;
}

export interface AuthConfig {
  type: "jwt" | "basic" | "bearer" | "api_key";
  loginStep: string;
  tokenField: string;
  headerName?: string;
  headerPrefix?: string;
}

export interface StepConditionConfig {
  type: "response_code" | "response_content" | "response_time";
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value: any;
  action: "continue" | "skip" | "fail";
}

export interface DataExtractionConfig {
  name: string;
  source: "response_body" | "response_header" | "status_code";
  extractor: "json_path" | "regex" | "xpath";
  expression: string;
}

export class WorkflowGenerator {
  private static dataStore: Map<string, any> = new Map();

  /**
   * Generate workflow from configuration
   */
  static generateWorkflow(config: WorkflowConfig): LoadTestSpec {
    const steps: WorkflowStep[] = config.steps.map((stepConfig) =>
      this.createWorkflowStep(stepConfig)
    );

    const correlationRules: CorrelationRule[] =
      config.dataCorrelation?.map((corr) => ({
        sourceStep: corr.sourceStep,
        sourceField: corr.sourceField,
        targetStep: corr.targetStep,
        targetField: corr.targetField,
      })) || [];

    // Create a single request spec that represents the workflow
    const workflowRequest: RequestSpec = {
      method: "POST",
      url: "/workflow", // Placeholder URL
      body: {
        steps: steps,
        correlationRules: correlationRules,
        authentication: config.authentication,
      },
    };

    return {
      id: `workflow_${Date.now()}`,
      name: "Multi-step Workflow",
      description: "Generated workflow test",
      testType: "baseline",
      requests: [workflowRequest],
      loadPattern: {
        type: "constant",
        virtualUsers: 10,
        plateauTime: { value: 30, unit: "seconds" },
        rampUpTime: { value: 10, unit: "seconds" },
        rampDownTime: { value: 10, unit: "seconds" },
      },
      duration: { value: 30, unit: "seconds" },
      workflow: steps,
      dataCorrelation: correlationRules,
    };
  }

  /**
   * Create workflow step from configuration
   */
  private static createWorkflowStep(config: WorkflowStepConfig): WorkflowStep {
    // Create a workflow request from the config
    const workflowRequest: WorkflowRequest = {
      method: config.method as any,
      url: config.url,
      headers: config.headers,
      body: config.body,
      requestCount: 1,
    };

    // Return the new workflow step structure
    return {
      id: config.id,
      name: config.name,
      type: "sequential",
      steps: [workflowRequest],
      thinkTime: config.thinkTime
        ? { value: config.thinkTime, unit: "seconds" }
        : undefined,
      conditions: config.conditions?.map((cond) => ({
        type: cond.type,
        operator: cond.operator,
        value: cond.value,
        action: cond.action,
      })),
    };
  }

  /**
   * Parse natural language workflow description
   */
  static parseWorkflowDescription(description: string): WorkflowConfig {
    const config: WorkflowConfig = {
      steps: [],
    };

    // Simple parsing for common workflow patterns
    const lines = description
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    for (const line of lines) {
      const step = this.parseWorkflowLine(line);
      if (step) {
        config.steps.push(step);
      }
    }

    return config;
  }

  /**
   * Parse a single workflow line
   */
  private static parseWorkflowLine(line: string): WorkflowStepConfig | null {
    // Pattern: "1. POST login to /auth with credentials"
    const stepPattern =
      /^(\d+)\.\s+(GET|POST|PUT|DELETE|PATCH)\s+(.+?)\s+to\s+(.+?)(?:\s+with\s+(.+))?$/i;
    const match = line.match(stepPattern);

    if (!match) return null;

    const [, stepNumber, method, action, url, additional] = match;

    return {
      id: `step_${stepNumber}`,
      name: `${method} ${action}`,
      method: method.toUpperCase(),
      url: url.trim(),
      body: this.parseBodyFromDescription(additional),
      headers: this.parseHeadersFromDescription(additional),
    };
  }

  /**
   * Parse body from description
   */
  private static parseBodyFromDescription(description?: string): any {
    if (!description) return undefined;

    // Look for JSON-like patterns
    const jsonPattern = /\{.*\}/;
    const match = description.match(jsonPattern);

    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (error) {
        // Return as string if not valid JSON
        return match[0];
      }
    }

    // Look for specific keywords
    if (description.includes("credentials")) {
      return {
        username: "{randomString:8}",
        password: "{randomString:12}",
      };
    }

    if (description.includes("order")) {
      return {
        orderId: "{uuid}",
        customerId: "{sequence:prefix=CUST}",
        items: [
          {
            productId: "{randomId:prefix=PROD}",
            quantity: "{randomNumber:min=1,max=10}",
          },
        ],
        timestamp: "{isoDate}",
      };
    }

    return undefined;
  }

  /**
   * Parse headers from description
   */
  private static parseHeadersFromDescription(
    description?: string
  ): Record<string, string> | undefined {
    if (!description) return undefined;

    const headers: Record<string, string> = {};

    // Look for common header patterns
    if (description.includes("auth token") || description.includes("jwt")) {
      headers["Authorization"] = "Bearer {token}";
    }

    if (description.includes("api key")) {
      headers["x-api-key"] = "{apiKey}";
    }

    if (description.includes("content type")) {
      headers["Content-Type"] = "application/json";
    }

    return Object.keys(headers).length > 0 ? headers : undefined;
  }

  /**
   * Generate authentication workflow
   */
  static generateAuthWorkflow(
    authType: string,
    loginUrl: string,
    protectedUrl: string
  ): WorkflowConfig {
    return {
      steps: [
        {
          id: "login",
          name: "Login",
          method: "POST",
          url: loginUrl,
          body: {
            username: "{randomString:8}",
            password: "{randomString:12}",
          },
          dataExtraction: [
            {
              name: "token",
              source: "response_body",
              extractor: "json_path",
              expression: "$.token",
            },
          ],
        },
        {
          id: "protected_request",
          name: "Protected Request",
          method: "GET",
          url: protectedUrl,
          headers: {
            Authorization: "Bearer {token}",
          },
        },
      ],
      authentication: {
        type: "jwt",
        loginStep: "login",
        tokenField: "token",
        headerName: "Authorization",
        headerPrefix: "Bearer ",
      },
    };
  }

  /**
   * Generate e-commerce workflow
   */
  static generateEcommerceWorkflow(baseUrl: string): WorkflowConfig {
    return {
      steps: [
        {
          id: "login",
          name: "User Login",
          method: "POST",
          url: `${baseUrl}/auth/login`,
          body: {
            email: "user{sequence:prefix=USER}@example.com",
            password: "{randomString:12}",
          },
          dataExtraction: [
            {
              name: "authToken",
              source: "response_body",
              extractor: "json_path",
              expression: "$.token",
            },
            {
              name: "userId",
              source: "response_body",
              extractor: "json_path",
              expression: "$.user.id",
            },
          ],
        },
        {
          id: "browse_products",
          name: "Browse Products",
          method: "GET",
          url: `${baseUrl}/products`,
          headers: {
            Authorization: "Bearer {authToken}",
          },
          dataExtraction: [
            {
              name: "productId",
              source: "response_body",
              extractor: "json_path",
              expression: "$.products[0].id",
            },
          ],
        },
        {
          id: "add_to_cart",
          name: "Add to Cart",
          method: "POST",
          url: `${baseUrl}/cart/add`,
          headers: {
            Authorization: "Bearer {authToken}",
          },
          body: {
            productId: "{productId}",
            quantity: "{randomNumber:min=1,max=5}",
          },
          dataExtraction: [
            {
              name: "cartId",
              source: "response_body",
              extractor: "json_path",
              expression: "$.cartId",
            },
          ],
        },
        {
          id: "checkout",
          name: "Checkout",
          method: "POST",
          url: `${baseUrl}/orders`,
          headers: {
            Authorization: "Bearer {authToken}",
          },
          body: {
            cartId: "{cartId}",
            customerId: "{userId}",
            paymentMethod: "credit_card",
            shippingAddress: {
              street: "{randomString:20}",
              city: "{randomString:10}",
              zipCode: "{randomNumber:min=10000,max=99999}",
            },
          },
          dataExtraction: [
            {
              name: "orderId",
              source: "response_body",
              extractor: "json_path",
              expression: "$.orderId",
            },
          ],
        },
        {
          id: "order_status",
          name: "Check Order Status",
          method: "GET",
          url: `${baseUrl}/orders/{orderId}`,
          headers: {
            Authorization: "Bearer {authToken}",
          },
        },
      ],
      dataCorrelation: [
        {
          sourceStep: "login",
          sourceField: "authToken",
          targetStep: "browse_products",
          targetField: "Authorization",
        },
        {
          sourceStep: "login",
          sourceField: "userId",
          targetStep: "checkout",
          targetField: "customerId",
        },
        {
          sourceStep: "browse_products",
          sourceField: "productId",
          targetStep: "add_to_cart",
          targetField: "productId",
        },
        {
          sourceStep: "add_to_cart",
          sourceField: "cartId",
          targetStep: "checkout",
          targetField: "cartId",
        },
        {
          sourceStep: "checkout",
          sourceField: "orderId",
          targetStep: "order_status",
          targetField: "url",
        },
      ],
    };
  }

  /**
   * Store data for correlation
   */
  static storeData(key: string, value: any): void {
    this.dataStore.set(key, value);
  }

  /**
   * Retrieve data for correlation
   */
  static getData(key: string): any {
    return this.dataStore.get(key);
  }

  /**
   * Clear all stored data
   */
  static clearData(): void {
    this.dataStore.clear();
  }

  /**
   * Generate workflow functions for K6 script
   */
  generateWorkflowFunctions(spec: LoadTestSpec): string {
    if (!spec.workflow || spec.workflow.length === 0) {
      return "";
    }

    let functions = "";

    for (const step of spec.workflow) {
      functions += this.generateStepFunction(step);
    }

    return functions;
  }

  /**
   * Generate main function for workflow
   */
  generateWorkflowMainFunction(spec: LoadTestSpec): string {
    if (!spec.workflow || spec.workflow.length === 0) {
      return "";
    }

    let mainFunction = `
export default function () {
  const baseUrl = '${spec.requests[0]?.url || ""}';
  const data = {};
  
`;

    for (const step of spec.workflow) {
      const stepId = step.id || "step";
      mainFunction += `  // Execute step: ${step.name || "Step"}
  const ${stepId}Response = execute${
        stepId.charAt(0).toUpperCase() + stepId.slice(1)
      }(baseUrl, data);
  
`;
    }

    mainFunction += `  // Add think time between steps
  sleep(1);
}
`;

    return mainFunction;
  }

  /**
   * Generate individual step function
   * Generates proper K6 HTTP request code for workflow steps
   */
  private generateStepFunction(step: WorkflowStep): string {
    const stepId = step.id || "step";
    const functionName = `execute${
      stepId.charAt(0).toUpperCase() + stepId.slice(1)
    }`;

    // Check if this is a WorkflowRequest (new structure)
    if ("method" in step && "url" in step) {
      const workflowRequest = step as WorkflowRequest;
      const method = workflowRequest.method.toLowerCase();
      const url = workflowRequest.url;
      const headers = JSON.stringify(workflowRequest.headers || {});
      const body = workflowRequest.body ? JSON.stringify(workflowRequest.body) : "null";
      const requestCount = workflowRequest.requestCount || 1;

      // Generate proper K6 HTTP request
      let requestCode = "";
      if (method === "get") {
        requestCode = `const response = http.get('${url}', { headers: ${headers} });`;
      } else if (method === "post") {
        requestCode = `const response = http.post('${url}', ${body}, { headers: ${headers} });`;
      } else if (method === "put") {
        requestCode = `const response = http.put('${url}', ${body}, { headers: ${headers} });`;
      } else if (method === "delete") {
        requestCode = `const response = http.del('${url}', null, { headers: ${headers} });`;
      } else {
        requestCode = `const response = http.request('${method.toUpperCase()}', '${url}', ${body === "null" ? "null" : body}, { headers: ${headers} });`;
      }

      return `
function ${functionName}(baseUrl, data) {
  // Step: ${step.name || "Step"} - ${method.toUpperCase()} ${url}
  ${requestCode}
  
  // Validate response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 5000ms': (r) => r.timings.duration < 5000,
  });
  
  // Extract data for correlation (if needed)
  let extractedData = {};
  if (response.body) {
    try {
      extractedData = JSON.parse(response.body);
    } catch (e) {
      // Not JSON, skip extraction
    }
  }
  
  // Store in data object for next steps
  data['${stepId}'] = extractedData;
  
  return response;
}
`;
    }

    // Legacy workflow step structure (fallback)
    return `
function ${functionName}(baseUrl, data) {
  // Legacy workflow step: ${step.name || "Step"}
  const response = http.get(baseUrl + '/${stepId}', { headers: {} });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  
  return response;
}
`;
  }

  /**
   * Generate data extraction code for workflow steps
   */
  private generateDataExtraction(step: WorkflowStep): string {
    // Data extraction is now handled inline in generateStepFunction
    // This method is kept for backward compatibility
    return "";
  }
}
