import { PromptTemplate } from "./types";

export const COMMAND_PARSER_PROMPT: PromptTemplate = {
  name: "command-parser",
  version: "1.0.0",
  description: "AI prompt for parsing natural language load testing commands",
  template: `You are a parser. Convert the natural language command into a JSON object.

Schema:
{
  "method": "GET|POST|PUT|DELETE|PATCH",
  "url": "extract-actual-url-from-command",
  "headers": {},
  "queryParams": {},
  "body": null OR {...},
  "requestCount": number (optional),
  "loadPattern": { "type": "constant|ramp", "virtualUsers": number } (optional),
  "duration": { "value": number, "unit": "seconds|minutes" } (optional)
}

EXAMPLE INPUT:
Send 2 POST requests to https://api.example.com/users with body { "id": 123 }

EXAMPLE OUTPUT:
{
  "method": "POST",
  "url": "https://api.example.com/users",
  "headers": {},
  "queryParams": {},
  "body": { "id": 123 },
  "requestCount": 2
}

IMPORTANT: Extract the actual URL from the command, do not use placeholder URLs.

Command: "{{input}}"

Return ONLY valid JSON.`,
  variables: ["input"],
};

export const COMPLEX_JSON_PROMPT: PromptTemplate = {
  name: "complex-json-parser",
  version: "1.0.0",
  description:
    "AI prompt for parsing commands with complex nested JSON structures",
  template: `You are a parser specialized in handling complex JSON structures. Convert the natural language command into a JSON object.

CRITICAL RULES FOR COMPLEX JSON:
1. Extract JSON body EXACTLY as provided - preserve all nesting, arrays, and structure
2. Handle deeply nested objects and arrays correctly
3. Preserve all field names and values exactly as written
4. Support incrementing fields when mentioned (e.g., "increment order_id")
5. Extract request count from patterns like "send X requests"

Schema:
{
  "method": "GET|POST|PUT|DELETE|PATCH",
  "url": "exact-url-from-command",
  "headers": {"x-api-key": "key-if-provided"},
  "body": {"exact": "json-structure"},
  "requestCount": number,
  "incrementFields": ["field1", "field2"] (if mentioned)
}

EXAMPLE INPUT:
Send 2 POST requests to https://api.com with body {"data": [{"id": "123", "items": [{"sku": "ABC"}]}]} increment id

EXAMPLE OUTPUT:
{
  "method": "POST",
  "url": "https://api.com",
  "headers": {},
  "body": {"data": [{"id": "123", "items": [{"sku": "ABC"}]}]},
  "requestCount": 2,
  "incrementFields": ["id"]
}

Command: "{{input}}"

Return ONLY valid JSON.`,
  variables: ["input"],
};

export const WORKING_COMMAND_PROMPT: PromptTemplate = {
  name: "working-command-parser",
  version: "1.0.0",
  description: "Simple AI prompt for parsing basic load testing commands",
  template: `You are a parser. Convert the natural language command into a JSON object.

Schema:
{
  "method": "GET|POST|PUT|DELETE|PATCH",
  "url": "extract-actual-url-from-command",
  "headers": {},
  "queryParams": {},
  "body": null OR {...},
  "requestCount": number (optional),
  "loadPattern": { "type": "constant|ramp", "virtualUsers": number } (optional),
  "duration": { "value": number, "unit": "seconds|minutes" } (optional)
}

IMPORTANT: Extract the actual URL from the command, do not use placeholder URLs.

EXAMPLE INPUT:
Send 2 POST requests to https://example.com/api with body { "id": 123 }

EXAMPLE OUTPUT:
{
  "method": "POST",
  "url": "https://example.com/api",
  "headers": {},
  "queryParams": {},
  "body": { "id": 123 },
  "requestCount": 2
}

Command: "{{input}}"

Return ONLY valid JSON.`,
  variables: ["input"],
};

export function buildCommandParserPrompt(input: string): string {
  return COMMAND_PARSER_PROMPT.template.replace("{{input}}", input);
}

export function buildComplexJsonPrompt(input: string): string {
  return COMPLEX_JSON_PROMPT.template.replace("{{input}}", input);
}

export function buildWorkingCommandPrompt(input: string): string {
  return WORKING_COMMAND_PROMPT.template.replace("{{input}}", input);
}

export function selectPromptTemplate(input: string): string | null {
  // Check if input contains natural language body descriptions (not JSON)
  const hasNaturalLanguageBody =
    input.includes("JSON body containing") ||
    input.includes("body containing") ||
    input.includes("payload as array") ||
    input.includes("having externalId") ||
    input.includes("having order_id") ||
    // Very complex JSON structures
    (input.match(/\{[^{}]*\{[^{}]*\{[^{}]*\}/g) || []).length > 0 ||
    // Very large JSON structures (more than 500 characters in body)
    (input.includes("body {") && input.length > 800);

  // For natural language body descriptions, return null to trigger fallback
  if (hasNaturalLanguageBody) {
    console.log("🔄 Natural language body detected - using fallback parser");
    return null; // This will trigger fallback parser
  }

  // For commands with actual JSON bodies, use AI
  return WORKING_COMMAND_PROMPT.template.replace("{{input}}", input);
}
