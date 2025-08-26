import chalk from "chalk";
import { LoadTestSpec } from "../../types";

export class APIEnhancer {
  /**
   * Dynamic API request enhancement system - detects and enhances various API patterns
   */
  enhanceApiRequest(
    spec: LoadTestSpec,
    input: string
  ): {
    enhanced: boolean;
    message: string;
    summary: string;
  } {
    let enhanced = false;
    const enhancements: string[] = [];
    const messages: string[] = [];

    // 1. Header Enhancement - Detect and add various authentication headers
    const headerEnhancements = this.enhanceHeaders(spec, input);
    if (headerEnhancements.enhanced) {
      enhanced = true;
      enhancements.push(...headerEnhancements.enhancements);
      messages.push(headerEnhancements.message);
    }

    // 2. Payload Enhancement - Detect and structure various payload patterns
    // Skip payload enhancement if fallback parser already created payload with variables
    if (
      !spec.requests[0].payload ||
      !spec.requests[0].payload.variables ||
      spec.requests[0].payload.variables.length === 0
    ) {
      const payloadEnhancements = this.enhancePayload(spec, input);
      if (payloadEnhancements.enhanced) {
        enhanced = true;
        enhancements.push(...payloadEnhancements.enhancements);
        messages.push(payloadEnhancements.message);
      }
    } else {
      console.log(
        chalk.blue("🔧 Preserving fallback parser's payload with variables")
      );
    }

    // 3. URL Enhancement - Detect and enhance URL patterns
    const urlEnhancements = this.enhanceUrl(spec, input);
    if (urlEnhancements.enhanced) {
      enhanced = true;
      enhancements.push(...urlEnhancements.enhancements);
      messages.push(urlEnhancements.message);
    }

    // 4. API-Specific Enhancements - Detect known API patterns
    const apiSpecificEnhancements = this.enhanceApiSpecific(spec, input);
    if (apiSpecificEnhancements.enhanced) {
      enhanced = true;
      enhancements.push(...apiSpecificEnhancements.enhancements);
      messages.push(apiSpecificEnhancements.message);
    }

    return {
      enhanced,
      message: messages.join(", "),
      summary: enhancements.join(", "),
    };
  }

  /**
   * Enhance headers - detects various authentication patterns
   */
  private enhanceHeaders(
    spec: LoadTestSpec,
    input: string
  ): {
    enhanced: boolean;
    enhancements: string[];
    message: string;
  } {
    const enhancements: string[] = [];
    let enhanced = false;

    // Detect API key patterns
    const apiKeyMatch = input.match(/x-api-key\s+([^\s]+)/i);
    if (apiKeyMatch && !spec.requests[0].headers?.["x-api-key"]) {
      spec.requests[0].headers = spec.requests[0].headers || {};
      spec.requests[0].headers["x-api-key"] = apiKeyMatch[1];
      enhancements.push("API key header");
      enhanced = true;
    }

    // Detect Bearer token patterns
    const bearerMatch = input.match(/bearer\s+([^\s]+)/i);
    if (bearerMatch && !spec.requests[0].headers?.Authorization) {
      spec.requests[0].headers = spec.requests[0].headers || {};
      spec.requests[0].headers.Authorization = `Bearer ${bearerMatch[1]}`;
      enhancements.push("Bearer token");
      enhanced = true;
    }

    // Detect Content-Type patterns
    if (
      spec.requests[0].method.toLowerCase() === "post" &&
      !spec.requests[0].headers?.["Content-Type"]
    ) {
      spec.requests[0].headers = spec.requests[0].headers || {};
      spec.requests[0].headers["Content-Type"] = "application/json";
      enhancements.push("Content-Type header");
      enhanced = true;
    }

    return {
      enhanced,
      enhancements,
      message: enhanced ? "Enhanced request headers" : "",
    };
  }

  /**
   * Enhance payload - detects and structures various payload patterns
   */
  private enhancePayload(
    spec: LoadTestSpec,
    input: string
  ): {
    enhanced: boolean;
    enhancements: string[];
    message: string;
  } {
    const enhancements: string[] = [];
    let enhanced = false;

    // Detect user data patterns
    if (input.match(/user\s+data|user\s+info|user\s+profile/i)) {
      spec.requests[0].body = {
        name: "John Doe",
        email: "john.doe@example.com",
        age: 30,
        city: "New York",
      };
      enhancements.push("User data payload");
      enhanced = true;
    }

    // Detect order data patterns
    if (input.match(/order\s+data|order\s+info|purchase/i)) {
      spec.requests[0].body = {
        orderId: "ORD-12345",
        items: [
          { productId: "PROD-001", quantity: 2, price: 29.99 },
          { productId: "PROD-002", quantity: 1, price: 49.99 },
        ],
        total: 109.97,
        customerId: "CUST-001",
      };
      enhancements.push("Order data payload");
      enhanced = true;
    }

    // Detect product data patterns
    if (input.match(/product\s+data|product\s+info|item\s+data/i)) {
      spec.requests[0].body = {
        productId: "PROD-001",
        name: "Sample Product",
        description: "A sample product for testing",
        price: 29.99,
        category: "Electronics",
        inStock: true,
      };
      enhancements.push("Product data payload");
      enhanced = true;
    }

    // Detect simple JSON patterns - only if no body is already present
    if (
      input.match(/json\s+body|json\s+payload/i) &&
      !spec.requests[0].body &&
      !spec.requests[0].payload
    ) {
      spec.requests[0].body = {
        requestId: "req-123",
        timestamp: Date.now(),
        data: "sample data",
      };
      enhancements.push("JSON payload");
      enhanced = true;
    }

    return {
      enhanced,
      enhancements,
      message: enhanced ? "Enhanced request payload" : "",
    };
  }

  /**
   * Enhance URL - detects and enhances URL patterns
   */
  private enhanceUrl(
    spec: LoadTestSpec,
    input: string
  ): {
    enhanced: boolean;
    enhancements: string[];
    message: string;
  } {
    const enhancements: string[] = [];
    let enhanced = false;

    // Detect and fix common URL patterns
    if (spec.requests[0].url && !spec.requests[0].url.startsWith("http")) {
      spec.requests[0].url = `https://${spec.requests[0].url}`;
      enhancements.push("URL protocol");
      enhanced = true;
    }

    // Detect API versioning patterns - only if URL doesn't already have a version path
    if (input.match(/v\d+|version\s+\d+/i) && spec.requests[0].url) {
      const versionMatch = input.match(/v(\d+)|version\s+(\d+)/i);
      if (versionMatch) {
        const version = versionMatch[1] || versionMatch[2];
        // Only add version if URL doesn't already contain a version path
        if (
          !spec.requests[0].url.includes(`/v${version}`) &&
          !spec.requests[0].url.includes(`/V${version}`)
        ) {
          spec.requests[0].url = spec.requests[0].url.replace(
            /(https?:\/\/[^\/]+)/,
            `$1/v${version}`
          );
          enhancements.push(`API version v${version}`);
          enhanced = true;
        }
      }
    }

    return {
      enhanced,
      enhancements,
      message: enhanced ? "Enhanced URL" : "",
    };
  }

  /**
   * Enhance API-specific patterns - detects known API patterns
   */
  private enhanceApiSpecific(
    spec: LoadTestSpec,
    input: string
  ): {
    enhanced: boolean;
    enhancements: string[];
    message: string;
  } {
    const enhancements: string[] = [];
    let enhanced = false;

    // Detect REST API patterns
    if (input.match(/rest\s+api|crud|create|read|update|delete/i)) {
      if (!spec.requests[0].headers?.["Accept"]) {
        spec.requests[0].headers = spec.requests[0].headers || {};
        spec.requests[0].headers.Accept = "application/json";
        enhancements.push("REST API headers");
        enhanced = true;
      }
    }

    // Detect GraphQL patterns
    if (input.match(/graphql|gql/i)) {
      if (!spec.requests[0].headers?.["Content-Type"]) {
        spec.requests[0].headers = spec.requests[0].headers || {};
        spec.requests[0].headers["Content-Type"] = "application/json";
        enhancements.push("GraphQL headers");
        enhanced = true;
      }
    }

    // Detect microservice patterns
    if (input.match(/microservice|service\s+mesh/i)) {
      if (!spec.requests[0].headers?.["X-Request-ID"]) {
        spec.requests[0].headers = spec.requests[0].headers || {};
        spec.requests[0].headers["X-Request-ID"] = "req-" + Date.now();
        enhancements.push("Microservice headers");
        enhanced = true;
      }
    }

    return {
      enhanced,
      enhancements,
      message: enhanced ? "Enhanced API-specific features" : "",
    };
  }

  /**
   * Generate example values for different variable types
   */
  generateExampleValue(variableType: string): string {
    switch (variableType) {
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
        return Math.random().toString(36).substring(2, 12);
      case "sequence":
        return "1";
      default:
        return "example_value";
    }
  }
}
