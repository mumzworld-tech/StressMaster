import {
  GeneratedEndpoint,
  GeneratedParameter,
  GeneratedRequestBody,
  OpenAPISchema,
  PayloadGeneratorOptions,
} from "./types";

export class OpenAPIPayloadGenerator {
  private options: PayloadGeneratorOptions;

  constructor(options: PayloadGeneratorOptions = {}) {
    this.options = {
      includeExamples: true,
      generateRandomData: true,
      maxArrayLength: 3,
      maxStringLength: 50,
      includeOptionalFields: true,
      ...options,
    };
  }

  /**
   * Generate a complete request payload for an endpoint
   */
  generateRequestPayload(endpoint: GeneratedEndpoint): any {
    const payload: any = {};

    // Generate path parameters
    const pathParams = endpoint.parameters.filter((p) => p.in === "path");
    if (pathParams.length > 0) {
      payload.pathParams = this.generateParameters(pathParams);
    }

    // Generate query parameters
    const queryParams = endpoint.parameters.filter((p) => p.in === "query");
    if (queryParams.length > 0) {
      payload.queryParams = this.generateParameters(queryParams);
    }

    // Generate headers
    const headerParams = endpoint.parameters.filter((p) => p.in === "header");
    if (headerParams.length > 0) {
      payload.headers = this.generateParameters(headerParams);
    }

    // Generate request body
    if (endpoint.requestBody) {
      payload.body = this.generateRequestBody(endpoint.requestBody);
    }

    return payload;
  }

  /**
   * Generate parameters object
   */
  private generateParameters(
    parameters: GeneratedParameter[]
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const param of parameters) {
      if (param.required || this.options.includeOptionalFields) {
        result[param.name] = this.generateValue(param);
      }
    }

    return result;
  }

  /**
   * Generate request body
   */
  private generateRequestBody(requestBody: GeneratedRequestBody): any {
    if (this.options.includeExamples && requestBody.example) {
      return requestBody.example;
    }

    if (requestBody.schema) {
      return this.generateFromSchema(requestBody.schema);
    }

    return {};
  }

  /**
   * Generate a value for a parameter
   */
  private generateValue(param: GeneratedParameter): any {
    // Use example if available and examples are enabled
    if (this.options.includeExamples && param.example !== undefined) {
      return param.example;
    }

    // Generate based on type
    return this.generateValueByType(param.type, param.name);
  }

  /**
   * Generate value based on type
   */
  private generateValueByType(type: string, name: string): any {
    const baseType = type.split("<")[0]; // Handle array types like array<string>

    switch (baseType) {
      case "string":
        return this.generateString(name);
      case "number":
      case "integer":
        return this.generateNumber();
      case "boolean":
        return this.generateBoolean();
      case "array":
        return this.generateArray(type, name);
      case "object":
        return this.generateObject();
      default:
        return this.generateString(name);
    }
  }

  /**
   * Generate a string value
   */
  private generateString(name: string): string {
    if (this.options.generateRandomData) {
      const maxLength = Math.min(this.options.maxStringLength || 50, 50);
      const randomLength = Math.floor(Math.random() * maxLength) + 1;
      return this.generateRandomString(randomLength);
    }

    // Generate meaningful strings based on parameter name
    const nameLower = name.toLowerCase();
    if (nameLower.includes("id")) return "12345";
    if (nameLower.includes("email")) return "user@example.com";
    if (nameLower.includes("name")) return "Sample Name";
    if (nameLower.includes("title")) return "Sample Title";
    if (nameLower.includes("description")) return "Sample description";
    if (nameLower.includes("url")) return "https://example.com";
    if (nameLower.includes("date")) return new Date().toISOString();
    if (nameLower.includes("token")) return "sample-token-123";
    if (nameLower.includes("key")) return "sample-key-456";

    return "sample-value";
  }

  /**
   * Generate a number value
   */
  private generateNumber(): number {
    if (this.options.generateRandomData) {
      return Math.floor(Math.random() * 1000) + 1;
    }
    return 123;
  }

  /**
   * Generate a boolean value
   */
  private generateBoolean(): boolean {
    if (this.options.generateRandomData) {
      return Math.random() > 0.5;
    }
    return true;
  }

  /**
   * Generate an array value
   */
  private generateArray(type: string, name: string): any[] {
    const maxLength = this.options.maxArrayLength || 3;
    const length = Math.floor(Math.random() * maxLength) + 1;
    const array: any[] = [];

    // Extract item type from array type (e.g., array<string> -> string)
    const itemType = type.includes("<")
      ? type.split("<")[1].replace(">", "")
      : "string";

    for (let i = 0; i < length; i++) {
      array.push(this.generateValueByType(itemType, `${name}_item`));
    }

    return array;
  }

  /**
   * Generate an object value
   */
  private generateObject(): Record<string, any> {
    return {
      id: this.generateNumber(),
      name: this.generateString("name"),
      description: this.generateString("description"),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate value from OpenAPI schema
   */
  private generateFromSchema(schema: OpenAPISchema): any {
    if (schema.example && this.options.includeExamples) {
      return schema.example;
    }

    if (schema.default !== undefined) {
      return schema.default;
    }

    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[Math.floor(Math.random() * schema.enum.length)];
    }

    if (schema.type === "array" && schema.items) {
      return this.generateArray("array<object>", "items");
    }

    if (schema.type === "object" || schema.properties) {
      return this.generateObjectFromSchema(schema);
    }

    return this.generateValueByType(schema.type || "string", "field");
  }

  /**
   * Generate object from schema properties
   */
  private generateObjectFromSchema(schema: OpenAPISchema): Record<string, any> {
    const result: Record<string, any> = {};

    if (!schema.properties) {
      return result;
    }

    for (const [propertyName, propertySchema] of Object.entries(
      schema.properties
    )) {
      const isRequired = schema.required?.includes(propertyName) || false;

      if (isRequired || this.options.includeOptionalFields) {
        result[propertyName] = this.generateFromSchema(propertySchema);
      }
    }

    return result;
  }

  /**
   * Generate a random string
   */
  private generateRandomString(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate multiple payloads for an endpoint
   */
  generateMultiplePayloads(
    endpoint: GeneratedEndpoint,
    count: number = 5
  ): any[] {
    const payloads: any[] = [];

    for (let i = 0; i < count; i++) {
      payloads.push(this.generateRequestPayload(endpoint));
    }

    return payloads;
  }

  /**
   * Generate payloads for multiple endpoints
   */
  generatePayloadsForEndpoints(
    endpoints: GeneratedEndpoint[]
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const endpoint of endpoints) {
      const key = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
      result[key] = this.generateRequestPayload(endpoint);
    }

    return result;
  }
}
