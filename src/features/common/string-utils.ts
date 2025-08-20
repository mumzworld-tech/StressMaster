/**
 * String manipulation and formatting utilities
 */

/**
 * Sanitizes input by removing control characters and normalizing whitespace
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Remove null bytes and control characters except newlines and tabs
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");

  // Normalize line endings
  sanitized = sanitized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove excessive spaces but preserve tabs and structure
  sanitized = sanitized.replace(/ +/g, " ");

  // Remove leading/trailing whitespace from each line
  sanitized = sanitized
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Remove excessive empty lines (more than 2 consecutive)
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

  return sanitized.trim();
}

/**
 * Normalizes whitespace in input
 */
export function normalizeWhitespace(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  return input
    .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
    .replace(/\s*\n\s*/g, "\n") // Clean up line breaks
    .trim();
}

/**
 * Cleans JSON response by removing markdown formatting
 */
export function cleanJsonResponse(response: string): string {
  // Remove markdown code blocks
  let cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  // Remove any text before the first {
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }

  // Remove any text after the last }
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }

  return cleaned.trim();
}

/**
 * Attempts to fix common JSON formatting issues
 */
export function attemptJsonFix(jsonString: string): string | null {
  try {
    // Common fixes for malformed JSON
    let fixed = jsonString
      .replace(/'/g, '"') // Replace single quotes with double quotes
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
      .replace(/:\s*([^",\[\]{}]+)([,}])/g, ':"$1"$2'); // Quote unquoted string values

    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
}

/**
 * Extracts template variables from a template string
 */
export function extractTemplateVariables(template: string): string[] {
  const variables: string[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Generates a test name from input text
 */
export function generateTestName(input: string): string {
  // Extract key components for a meaningful name
  const words = input
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 4);

  return words.length > 0 ? words.join("-") : "load-test";
}

/**
 * Converts camelCase or PascalCase to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Converts kebab-case or snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Capitalizes the first letter of each word
 */
export function toTitleCase(str: string): string {
  return str
    .split(/[\s-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Escapes special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
