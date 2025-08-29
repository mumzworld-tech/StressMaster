// OpenAPI Specification Types
export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  tags?: string[];
}

export interface OpenAPIParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  schema?: OpenAPISchema;
  description?: string;
}

export interface OpenAPIRequestBody {
  description?: string;
  content: Record<string, OpenAPIMediaType>;
  required?: boolean;
}

export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPISchema {
  type?: string;
  format?: string;
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  enum?: any[];
  default?: any;
  example?: any;
  $ref?: string;
  allOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
}

export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: any;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  responses?: Record<string, OpenAPIResponse>;
}

// Generated Payload Types
export interface GeneratedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: GeneratedParameter[];
  requestBody?: GeneratedRequestBody;
  responses: GeneratedResponse[];
  tags?: string[];
}

export interface GeneratedParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  type: string;
  example?: any;
  description?: string;
}

export interface GeneratedRequestBody {
  contentType: string;
  schema: any;
  example?: any;
  description?: string;
}

export interface GeneratedResponse {
  statusCode: string;
  description: string;
  contentType?: string;
  schema?: any;
  example?: any;
}

// Parser Result Types
export interface OpenAPIParseResult {
  spec: OpenAPISpec;
  endpoints: GeneratedEndpoint[];
  baseUrl?: string;
  success: boolean;
  errors?: string[];
}

// Generator Options
export interface PayloadGeneratorOptions {
  includeExamples?: boolean;
  generateRandomData?: boolean;
  maxArrayLength?: number;
  maxStringLength?: number;
  includeOptionalFields?: boolean;
}
