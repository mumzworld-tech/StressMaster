import { GeneratedEndpoint, OpenAPISpec } from "./types";

/**
 * Validate if a file is a valid OpenAPI specification
 */
export function isValidOpenAPIFile(filePath: string): boolean {
  const validExtensions = [".yaml", ".yml", ".json"];
  const ext = filePath.toLowerCase().split(".").pop();
  return validExtensions.includes(`.${ext}`);
}

/**
 * Format endpoint information for display
 */
export function formatEndpointInfo(endpoint: GeneratedEndpoint): string {
  const parts = [
    `${endpoint.method.toUpperCase()} ${endpoint.path}`,
    endpoint.summary ? `- ${endpoint.summary}` : "",
    endpoint.operationId ? `(ID: ${endpoint.operationId})` : "",
  ].filter(Boolean);

  return parts.join(" ");
}

/**
 * Get endpoint statistics
 */
export function getEndpointStats(endpoints: GeneratedEndpoint[]): {
  total: number;
  byMethod: Record<string, number>;
  byTag: Record<string, number>;
} {
  const stats = {
    total: endpoints.length,
    byMethod: {} as Record<string, number>,
    byTag: {} as Record<string, number>,
  };

  for (const endpoint of endpoints) {
    // Count by method
    const method = endpoint.method.toUpperCase();
    stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;

    // Count by tags
    if (endpoint.tags) {
      for (const tag of endpoint.tags) {
        stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
      }
    }
  }

  return stats;
}

/**
 * Filter endpoints by criteria
 */
export function filterEndpoints(
  endpoints: GeneratedEndpoint[],
  criteria: {
    method?: string;
    tag?: string;
    path?: string;
    hasRequestBody?: boolean;
  }
): GeneratedEndpoint[] {
  return endpoints.filter((endpoint) => {
    if (
      criteria.method &&
      endpoint.method.toLowerCase() !== criteria.method.toLowerCase()
    ) {
      return false;
    }
    if (
      criteria.tag &&
      (!endpoint.tags || !endpoint.tags.includes(criteria.tag))
    ) {
      return false;
    }
    if (criteria.path && !endpoint.path.includes(criteria.path)) {
      return false;
    }
    if (
      criteria.hasRequestBody !== undefined &&
      !!endpoint.requestBody !== criteria.hasRequestBody
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Generate a summary of OpenAPI specification
 */
export function generateSpecSummary(spec: OpenAPISpec): {
  title: string;
  version: string;
  description?: string;
  serverCount: number;
  endpointCount: number;
  hasComponents: boolean;
} {
  const endpointCount = Object.values(spec.paths).reduce((count, pathItem) => {
    const methods = ["get", "post", "put", "delete", "patch"] as const;
    return count + methods.filter((method) => pathItem[method]).length;
  }, 0);

  return {
    title: spec.info.title,
    version: spec.info.version,
    description: spec.info.description,
    serverCount: spec.servers?.length || 0,
    endpointCount,
    hasComponents: !!(
      spec.components && Object.keys(spec.components).length > 0
    ),
  };
}

/**
 * Convert endpoint to cURL command
 */
export function endpointToCurl(
  endpoint: GeneratedEndpoint,
  baseUrl: string = "http://localhost:3000",
  payload?: any
): string {
  const url = `${baseUrl}${endpoint.path}`;
  const method = endpoint.method.toUpperCase();

  let curl = `curl -X ${method} "${url}"`;

  // Add headers
  const headers = endpoint.parameters.filter((p) => p.in === "header");
  for (const header of headers) {
    curl += ` \\\n  -H "${header.name}: ${header.example || "value"}"`;
  }

  // Add request body
  if (payload && ["POST", "PUT", "PATCH"].includes(method)) {
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -d '${JSON.stringify(payload, null, 2)}'`;
  }

  return curl;
}

/**
 * Convert endpoint to HTTP request format
 */
export function endpointToHttpRequest(
  endpoint: GeneratedEndpoint,
  baseUrl: string = "http://localhost:3000",
  payload?: any
): string {
  const url = `${baseUrl}${endpoint.path}`;
  const method = endpoint.method.toUpperCase();

  let request = `${method} ${url} HTTP/1.1\n`;
  request += `Host: ${new URL(baseUrl).host}\n`;

  // Add headers
  const headers = endpoint.parameters.filter((p) => p.in === "header");
  for (const header of headers) {
    request += `${header.name}: ${header.example || "value"}\n`;
  }

  // Add request body
  if (payload && ["POST", "PUT", "PATCH"].includes(method)) {
    request += `Content-Type: application/json\n`;
    request += `Content-Length: ${JSON.stringify(payload).length}\n\n`;
    request += JSON.stringify(payload, null, 2);
  } else {
    request += "\n";
  }

  return request;
}

/**
 * Extract path parameters from a path
 */
export function extractPathParameters(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  return matches ? matches.map((match) => match.slice(1, -1)) : [];
}

/**
 * Replace path parameters with values
 */
export function replacePathParameters(
  path: string,
  params: Record<string, any>
): string {
  let result = path;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

/**
 * Validate OpenAPI specification structure
 */
export function validateOpenAPISpec(spec: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!spec.openapi) {
    errors.push("Missing openapi version");
  }

  if (!spec.info) {
    errors.push("Missing info section");
  } else {
    if (!spec.info.title) errors.push("Missing info.title");
    if (!spec.info.version) errors.push("Missing info.version");
  }

  if (!spec.paths) {
    errors.push("Missing paths section");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
