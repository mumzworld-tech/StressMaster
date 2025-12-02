import { PromptTemplate } from "./types";

export const COMMAND_PARSER_PROMPT: PromptTemplate = {
  name: "command-parser",
  version: "2.0.0",
  description: "AI prompt for parsing natural language load testing commands - uses LoadTestSpec schema",
  template: `You are StressMaster's AI assistant. Convert natural language commands into LoadTestSpec JSON.

CRITICAL: Respond with ONLY valid JSON, no markdown, no code blocks.

REQUIRED SCHEMA (LoadTestSpec):
{
  "id": "string (deterministic: test-{type}-{method}-{hash})",
  "name": "string (descriptive)",
  "description": "string (original command)",
  "testType": "baseline" | "spike" | "stress" | "endurance" | "volume" | "workflow" | "batch",
  "requests": [{
    "method": "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    "url": "string (exact URL from command)",
    "headers": {} (optional),
    "body": {} (optional - for inline JSON)
  }],
  "loadPattern": {
    "type": "constant" | "ramp-up" | "spike" | "step" | "random-burst",
    "virtualUsers": number
  },
  "duration": {"value": number, "unit": "seconds" | "minutes" | "hours"}
}

RULES:
1. Extract exact URLs and methods from command
2. Generate deterministic IDs: "test-{type}-{method}-{hash}"
3. Infer missing values: default to GET, baseline, 1 user, 60 seconds

Command: "{{input}}"

Return ONLY valid JSON.`,
  variables: ["input"],
};

export const COMPLEX_JSON_PROMPT: PromptTemplate = {
  name: "complex-json-parser",
  version: "2.0.0",
  description:
    "AI prompt for parsing commands with complex nested JSON structures - uses LoadTestSpec schema",
  template: `You are StressMaster's AI assistant. Convert natural language commands with complex JSON into LoadTestSpec JSON.

CRITICAL RULES FOR COMPLEX JSON:
1. Extract JSON body EXACTLY as provided - preserve all nesting, arrays, and structure
2. Handle deeply nested objects and arrays correctly
3. Preserve all field names and values exactly as written
4. Support incrementing fields when mentioned (e.g., "increment order_id")

REQUIRED SCHEMA (LoadTestSpec):
{
  "id": "string (deterministic)",
  "name": "string (descriptive)",
  "description": "string (original command)",
  "testType": "baseline" | "spike" | "stress" | "endurance" | "volume" | "workflow" | "batch",
  "requests": [{
    "method": "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    "url": "string (exact URL from command)",
    "headers": {},
    "body": {"exact": "json-structure-with-all-nesting"}
  }],
  "loadPattern": {
    "type": "constant" | "ramp-up" | "spike" | "step" | "random-burst",
    "virtualUsers": number
  },
  "duration": {"value": number, "unit": "seconds" | "minutes" | "hours"}
}

Command: "{{input}}"

Return ONLY valid JSON.`,
  variables: ["input"],
};

export const WORKING_COMMAND_PROMPT: PromptTemplate = {
  name: "working-command-parser",
  version: "2.0.0",
  description: "AI prompt for parsing basic load testing commands - uses LoadTestSpec schema",
  template: `You are StressMaster's AI assistant. Convert natural language commands into LoadTestSpec JSON.

CRITICAL: Respond with ONLY valid JSON, no markdown, no code blocks.

REQUIRED SCHEMA (LoadTestSpec):
{
  "id": "string (deterministic: test-{type}-{method}-{hash})",
  "name": "string (descriptive)",
  "description": "string (original command)",
  "testType": "baseline" | "spike" | "stress" | "endurance" | "volume" | "workflow" | "batch",
  "requests": [{
    "method": "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    "url": "string (exact URL from command - never use placeholders)",
    "headers": {},
    "body": {} (optional - for inline JSON)
  }],
  "loadPattern": {
    "type": "constant" | "ramp-up" | "spike" | "step" | "random-burst",
    "virtualUsers": number
  },
  "duration": {"value": number, "unit": "seconds" | "minutes" | "hours"}
}

RULES:
1. Extract exact URLs and methods from command
2. Generate deterministic IDs
3. Infer missing values: default to GET, baseline, 1 user, 60 seconds

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
