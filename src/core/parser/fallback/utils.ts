/**
 * Fallback Parser Utilities
 *
 * Contains utility functions used by the fallback parser
 */

export function normalizeTimeUnit(timeStr: string): string {
  const unit = timeStr.slice(-1).toLowerCase();
  const value = timeStr.slice(0, -1);

  if (unit === "s" || unit === "m" || unit === "h") {
    return timeStr;
  }

  // Default to seconds if no unit specified
  return `${timeStr}s`;
}

export function normalizeMethod(method: string): string {
  const normalized = method.toUpperCase().trim();
  const validMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
  ];

  if (validMethods.includes(normalized)) {
    return normalized;
  }

  // Default to GET for unrecognized methods
  return "GET";
}

export function normalizeUrl(url: string): string {
  // Remove any trailing quotes, commas, or other punctuation
  let cleanedUrl = url.trim().replace(/[",;\]\s]+$/, "");

  // Ensure proper protocol
  if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
    cleanedUrl = `https://${cleanedUrl}`;
  }

  return cleanedUrl;
}

export function extractVariablesFromPayload(payload: any): string[] {
  const variables: string[] = [];

  if (typeof payload === "string") {
    return extractVariablesFromString(payload);
  }

  if (typeof payload === "object" && payload !== null) {
    return extractVariablesFromJsonObject(payload);
  }

  return variables;
}

export function extractVariablesFromJsonObject(
  obj: any,
  path: string = ""
): string[] {
  const variables: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (
      typeof value === "string" &&
      value.includes("{{") &&
      value.includes("}}")
    ) {
      const matches = value.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        variables.push(...matches.map((match) => match.slice(2, -2)));
      }
    } else if (typeof value === "object" && value !== null) {
      variables.push(...extractVariablesFromJsonObject(value, currentPath));
    }
  }

  return variables;
}

export function extractVariablesFromString(str: string): string[] {
  const variables: string[] = [];
  const matches = str.match(/\{\{([^}]+)\}\}/g);

  if (matches) {
    variables.push(...matches.map((match) => match.slice(2, -2)));
  }

  return variables;
}

export function detectIncrementIntent(input: string): {
  shouldIncrement: boolean;
  fields: string[];
} {
  const incrementKeywords = [
    "increment",
    "auto-increment",
    "auto increment",
    "increasing",
    "sequential",
    "sequence",
    "next",
    "progressive",
  ];

  const hasIncrementKeyword = incrementKeywords.some((keyword) =>
    input.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!hasIncrementKeyword) {
    return { shouldIncrement: false, fields: [] };
  }

  // Extract field names that should be incremented
  // Handle patterns like: "increment order_id and increment_id" or "increment order_id, increment_id"
  const fieldPatterns = [
    /increment\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+and\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /increment\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /increment\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  ];

  let fields: string[] = [];

  // Try the multi-field patterns first
  for (let i = 0; i < fieldPatterns.length; i++) {
    const pattern = fieldPatterns[i];

    const matches = Array.from(input.matchAll(pattern));

    if (matches.length > 0) {
      for (const match of matches) {
        // Extract all captured groups (field names)
        for (let j = 1; j < match.length; j++) {
          if (match[j]) {
            fields.push(match[j]);
          }
        }
      }
      break; // Use the first pattern that matches
    }
  }

  // Remove duplicates and filter out empty strings
  fields = [...new Set(fields)].filter((field) => field.length > 0);

  // If no specific fields mentioned, look for common patterns
  if (fields.length === 0) {
    const commonFields = ["id", "requestId", "orderId", "userId", "sessionId"];
    const foundFields = commonFields.filter((field) =>
      input.toLowerCase().includes(field.toLowerCase())
    );
    return { shouldIncrement: true, fields: foundFields };
  }

  return { shouldIncrement: true, fields };
}

export function shouldIncrementField(
  fieldName: string,
  incrementFields: string[]
): boolean {
  if (incrementFields.length === 0) {
    return false;
  }

  return incrementFields.some(
    (field) =>
      fieldName.toLowerCase().includes(field.toLowerCase()) ||
      field.toLowerCase().includes(fieldName.toLowerCase())
  );
}
