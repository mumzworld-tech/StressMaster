import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  OpenAPISpec,
  OpenAPIParseResult,
  GeneratedEndpoint,
  GeneratedParameter,
  GeneratedRequestBody,
  GeneratedResponse,
  OpenAPISchema,
  OpenAPIPathItem,
  OpenAPIOperation,
} from "./types";

export class OpenAPIParser {
  private spec: OpenAPISpec | null = null;
  private components: Record<string, any> = {};

  /**
   * Parse OpenAPI specification from file
   * File path is resolved from root directory (where CLI is executed)
   */
  async parseFromFile(filePath: string): Promise<OpenAPIParseResult> {
    try {
      // Use centralized file resolver (resolves from root directory)
      const { FileResolver } = await import("../../utils/file-resolver");
      const resolvedPath = FileResolver.resolveFile(filePath, {
        throwIfNotFound: true,
        defaultExtensions: [".yaml", ".yml", ".json"],
      }).resolvedPath;
      
      const content = fs.readFileSync(resolvedPath, "utf8");
      const fileExt = path.extname(resolvedPath).toLowerCase();

      if (fileExt === ".yaml" || fileExt === ".yml") {
        this.spec = yaml.load(content) as OpenAPISpec;
      } else if (fileExt === ".json") {
        this.spec = JSON.parse(content) as OpenAPISpec;
      } else {
        throw new Error(`Unsupported file format: ${fileExt}`);
      }

      return this.parseSpec();
    } catch (error) {
      return {
        spec: {} as OpenAPISpec,
        endpoints: [],
        success: false,
        errors: [
          `Failed to parse OpenAPI spec: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  }

  /**
   * Parse OpenAPI specification from string content
   */
  async parseFromContent(
    content: string,
    format: "yaml" | "json" = "yaml"
  ): Promise<OpenAPIParseResult> {
    try {
      if (format === "yaml") {
        this.spec = yaml.load(content) as OpenAPISpec;
      } else {
        this.spec = JSON.parse(content) as OpenAPISpec;
      }

      return this.parseSpec();
    } catch (error) {
      return {
        spec: {} as OpenAPISpec,
        endpoints: [],
        success: false,
        errors: [
          `Failed to parse OpenAPI spec: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  }

  /**
   * Parse the OpenAPI specification and extract endpoints
   */
  private parseSpec(): OpenAPIParseResult {
    if (!this.spec) {
      return {
        spec: {} as OpenAPISpec,
        endpoints: [],
        success: false,
        errors: ["No OpenAPI specification loaded"],
      };
    }

    try {
      // Store components for reference resolution
      this.components = this.spec.components || {};

      const endpoints: GeneratedEndpoint[] = [];
      const baseUrl = this.spec.servers?.[0]?.url;

      // Parse each path and method
      for (const [path, pathItem] of Object.entries(this.spec.paths)) {
        const methods = ["get", "post", "put", "delete", "patch"] as const;

        for (const method of methods) {
          const operation = pathItem[method];
          if (operation) {
            const endpoint = this.parseOperation(
              path,
              method.toUpperCase(),
              pathItem,
              operation
            );
            if (endpoint) {
              endpoints.push(endpoint);
            }
          }
        }
      }

      return {
        spec: this.spec,
        endpoints,
        baseUrl,
        success: true,
      };
    } catch (error) {
      return {
        spec: this.spec,
        endpoints: [],
        baseUrl: this.spec.servers?.[0]?.url,
        success: false,
        errors: [
          `Failed to parse endpoints: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  }

  /**
   * Parse a single operation
   */
  private parseOperation(
    path: string,
    method: string,
    pathItem: OpenAPIPathItem,
    operation: OpenAPIOperation
  ): GeneratedEndpoint | null {
    try {
      // Combine path-level and operation-level parameters
      const allParameters = [
        ...(pathItem.parameters || []),
        ...(operation.parameters || []),
      ];

      const parameters = allParameters.map((param) =>
        this.parseParameter(param)
      );
      const requestBody = operation.requestBody
        ? this.parseRequestBody(operation.requestBody)
        : undefined;
      const responses = this.parseResponses(operation.responses);

      return {
        path,
        method,
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        parameters,
        requestBody,
        responses,
        tags: operation.tags,
      };
    } catch (error) {
      console.warn(`Failed to parse operation ${method} ${path}:`, error);
      return null;
    }
  }

  /**
   * Parse a parameter
   */
  private parseParameter(param: any): GeneratedParameter {
    const schema = this.resolveSchema(param.schema);
    const type = this.getSchemaType(schema);

    return {
      name: param.name,
      in: param.in,
      required: param.required || false,
      type,
      example: param.example || schema?.example,
      description: param.description,
    };
  }

  /**
   * Parse request body
   */
  private parseRequestBody(requestBody: any): GeneratedRequestBody | undefined {
    try {
      const contentType = Object.keys(requestBody.content)[0];
      const mediaType = requestBody.content[contentType];
      const schema = this.resolveSchema(mediaType.schema);

      return {
        contentType,
        schema: schema || {},
        example: mediaType.example,
        description: requestBody.description,
      };
    } catch (error) {
      console.warn("Failed to parse request body:", error);
      return undefined;
    }
  }

  /**
   * Parse responses
   */
  private parseResponses(responses: Record<string, any>): GeneratedResponse[] {
    return Object.entries(responses).map(([statusCode, response]) => {
      const contentType = response.content
        ? Object.keys(response.content)[0]
        : undefined;
      const mediaType = contentType ? response.content[contentType] : undefined;
      const schema = mediaType?.schema
        ? this.resolveSchema(mediaType.schema)
        : undefined;

      return {
        statusCode,
        description: response.description,
        contentType,
        schema,
        example: mediaType?.example,
      };
    });
  }

  /**
   * Resolve schema references
   */
  private resolveSchema(
    schema: OpenAPISchema | undefined
  ): OpenAPISchema | undefined {
    if (!schema) return undefined;

    if (schema.$ref) {
      const refPath = schema.$ref.replace("#/", "").split("/");
      let ref = this.components;

      for (const path of refPath) {
        ref = ref[path];
        if (!ref) break;
      }

      return ref;
    }

    return schema;
  }

  /**
   * Get the type of a schema
   */
  private getSchemaType(schema: OpenAPISchema | undefined): string {
    if (!schema) return "object";

    if (schema.type) {
      if (schema.type === "array" && schema.items) {
        return `array<${this.getSchemaType(schema.items)}>`;
      }
      return schema.type;
    }

    if (schema.properties) {
      return "object";
    }

    return "object";
  }

  /**
   * Get all available endpoints
   */
  getEndpoints(): GeneratedEndpoint[] {
    if (!this.spec) return [];

    const result = this.parseSpec();
    return result.endpoints;
  }

  /**
   * Get endpoints by tag
   */
  getEndpointsByTag(tag: string): GeneratedEndpoint[] {
    return this.getEndpoints().filter((endpoint) =>
      endpoint.tags?.includes(tag)
    );
  }

  /**
   * Get endpoints by method
   */
  getEndpointsByMethod(method: string): GeneratedEndpoint[] {
    return this.getEndpoints().filter(
      (endpoint) => endpoint.method.toLowerCase() === method.toLowerCase()
    );
  }
}
