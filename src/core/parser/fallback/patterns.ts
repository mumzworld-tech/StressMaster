/**
 * Fallback Parser Patterns and Rules
 *
 * Contains all the regex patterns and parsing rules used by the fallback parser
 */

export interface FallbackParsingRules {
  urlPatterns: RegExp[];
  methodPatterns: RegExp[];
  headerPatterns: RegExp[];
  bodyPatterns: RegExp[];
  loadPatterns: RegExp[];
  workflowPatterns: RegExp[];
  openapiPatterns: RegExp[];
}

export const FALLBACK_PARSING_RULES: FallbackParsingRules = {
  urlPatterns: [
    // More precise URL patterns that don't capture trailing quotes
    /https?:\/\/[^\s,;"\]]+/gi,
    /(?:url|endpoint|host):\s*([^\s,;"\]]+)/gi,
    // Pattern for "to" followed by URL
    /(?:to|at|on|hit|call|ping|reach|access|visit)\s+(https?:\/\/[^\s,;"\]]+)/gi,
  ],
  methodPatterns: [
    /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b(?=\s|$)/gi,
    /method:\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/gi,
  ],
  headerPatterns: [
    // Pattern for x-api-key specifically - most specific first
    /x-api-key\s*[:=]\s*([a-zA-Z0-9-]+)/gi,
    // Pattern for header with colon - but not inside JSON
    /header\s+([a-zA-Z-]+)\s*[:=]\s*([^\r\n,]+)/gi,
    // Pattern for quoted headers - but not inside JSON body
    /(?<!\{[^}]*)"([^"]+)":\s*"([^"]+)"(?!.*\})/g,
    // Pattern for unquoted headers - but not inside JSON body
    /(?<!\{[^}]*)([a-zA-Z-]+):\s*([^\r\n,]+)(?!.*\})/gi,
  ],
  bodyPatterns: [
    // More specific patterns for JSON bodies
    /\{[\s\S]*\}/g,
    /body:\s*(\{[\s\S]*?\})/gi,
    /data:\s*(\{[\s\S]*?\})/gi,
    /JSON\s+body\s*(\{[\s\S]*?\})/gi,
    /payload\s*(\{[\s\S]*?\})/gi,
    /and\s+body\s*(\{[\s\S]*?\})/gi,
    /with\s+body\s*(\{[\s\S]*?\})/gi,
    // More comprehensive patterns for complex JSON
    /and\s+body\s*(\{[\s\S]*\})/gi,
    /with\s+body\s*(\{[\s\S]*\})/gi,
    /body\s*(\{[\s\S]*\})/gi,
    // Specific patterns for requestId/payload structures
    /(\{[^}]*"requestId"[^}]*"payload"[^}]*\})/gi,
    /(\{[^}]*"payload"[^}]*"requestId"[^}]*\})/gi,
    // Nested JSON patterns
    /(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g,
  ],
  loadPatterns: [
    /(\d+)\s*(?:users?|concurrent|parallel)/gi,
    /(?:for|duration)[\s:]*(\d+[smh]?)/gi,
    /rate:\s*(\d+)/gi,
    /ramp[- ]?up:\s*(\d+[smh]?)/gi,
    /(\d+)\s*minutes?/gi,
    /for\s+(\d+)\s*m(?:in)?/gi,
    /(\d+)m\b/gi,
  ],
  workflowPatterns: [
    // Sequential workflow patterns
    /(?:first|start|begin)\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*,?\s*then\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/gi,
    /(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*;\s*(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/gi,
    /(?:•\s*|\*\s*|\d+\.\s*)(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*\n\s*(?:•\s*|\*\s*|\d+\.\s*)(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/gi,
    // Parallel workflow patterns
    /(?:parallel|simultaneously|at\s+the\s+same\s+time)\s*:\s*(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*,\s*(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/gi,
    /(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s+and\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/gi,
  ],
  openapiPatterns: [
    // OpenAPI file patterns
    /(?:with|using|from)\s+@([^\s,]+\.(?:yaml|yml|json))/gi,
    /(?:openapi|api\s+spec|swagger)\s*:\s*@([^\s,]+\.(?:yaml|yml|json))/gi,
    /@([^\s,]+\.(?:yaml|yml|json))/gi,
  ],
};

export const PARSING_PATTERNS = [
  {
    name: "http-method-url",
    pattern:
      /(GET|POST|PUT|DELETE|PATCH)\s+(?:requests?\s+to\s+)?(https?:\/\/[^\s]+|\/[^\s]+)/i,
    extract: (match: RegExpMatchArray) => ({
      method: match[1].toUpperCase(),
      url: match[2].trim(),
    }),
  },
  {
    name: "send-requests",
    pattern:
      /send\s+(\d+)\s+(GET|POST|PUT|DELETE|PATCH)\s+requests?\s+to\s+(https?:\/\/[^\s]+)/i,
    extract: (match: RegExpMatchArray) => ({
      count: parseInt(match[1]),
      method: match[2].toUpperCase(),
      url: match[3].trim(),
    }),
  },
  {
    name: "sequential-workflow",
    pattern:
      /(?:first|start|begin)\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*,?\s*then\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/i,
    extract: (match: RegExpMatchArray) => ({
      type: "sequential",
      steps: [
        { method: match[1].toUpperCase(), url: match[2].trim() },
        ...(match[3]
          ? [{ method: match[3].toUpperCase(), url: match[4].trim() }]
          : []),
      ],
    }),
  },
  {
    name: "semicolon-workflow",
    pattern:
      /(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*;\s*(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/i,
    extract: (match: RegExpMatchArray) => ({
      type: "sequential",
      steps: [
        { method: match[1].toUpperCase(), url: match[2].trim() },
        ...(match[3]
          ? [{ method: match[3].toUpperCase(), url: match[4].trim() }]
          : []),
      ],
    }),
  },
  {
    name: "bullet-point-workflow",
    pattern:
      /(?:•\s*|\*\s*|\d+\.\s*)(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*\n\s*(?:•\s*|\*\s*|\d+\.\s*)(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/i,
    extract: (match: RegExpMatchArray) => ({
      type: "sequential",
      steps: [
        { method: match[1].toUpperCase(), url: match[2].trim() },
        ...(match[3]
          ? [{ method: match[3].toUpperCase(), url: match[4].trim() }]
          : []),
      ],
    }),
  },
  {
    name: "parallel-workflow",
    pattern:
      /(?:parallel|simultaneously|at\s+the\s+same\s+time)\s*:\s*(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s*,\s*(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/i,
    extract: (match: RegExpMatchArray) => ({
      type: "parallel",
      steps: [
        { method: match[1].toUpperCase(), url: match[2].trim() },
        ...(match[3]
          ? [{ method: match[3].toUpperCase(), url: match[4].trim() }]
          : []),
      ],
    }),
  },
  {
    name: "and-workflow",
    pattern:
      /(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+)(?:\s+and\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s,]+))*/i,
    extract: (match: RegExpMatchArray) => ({
      type: "parallel",
      steps: [
        { method: match[1].toUpperCase(), url: match[2].trim() },
        ...(match[3]
          ? [{ method: match[3].toUpperCase(), url: match[4].trim() }]
          : []),
      ],
    }),
  },
  {
    name: "load-test-pattern",
    pattern:
      /load\s+test\s+(?:with\s+)?(\d+)\s+(?:users?|concurrent)\s+(?:for\s+)?(\d+[smh]?)/i,
    extract: (match: RegExpMatchArray) => ({
      virtualUsers: parseInt(match[1]),
      duration: match[2],
    }),
  },
  {
    name: "stress-test-pattern",
    pattern:
      /stress\s+test\s+(?:with\s+)?(\d+)\s+(?:users?|concurrent)\s+(?:for\s+)?(\d+[smh]?)/i,
    extract: (match: RegExpMatchArray) => ({
      virtualUsers: parseInt(match[1]),
      duration: match[2],
      testType: "stress",
    }),
  },
  {
    name: "spike-test-pattern",
    pattern:
      /spike\s+test\s+(?:with\s+)?(\d+)\s+(?:users?|concurrent)\s+(?:for\s+)?(\d+[smh]?)/i,
    extract: (match: RegExpMatchArray) => ({
      virtualUsers: parseInt(match[1]),
      duration: match[2],
      testType: "spike",
    }),
  },
];

export const KEYWORD_MAPPINGS = {
  // Test types
  testTypes: {
    spike: ["spike", "burst", "sudden", "peak"],
    stress: ["stress", "pressure", "overload", "break", "limit"],
    endurance: ["endurance", "long", "sustained", "continuous", "marathon"],
    volume: ["volume", "bulk", "massive", "high-volume"],
    baseline: ["baseline", "normal", "standard", "baseline"],
  },
  // HTTP methods
  methods: {
    GET: ["get", "fetch", "retrieve", "read"],
    POST: ["post", "create", "send", "submit", "add"],
    PUT: ["put", "update", "modify", "replace"],
    DELETE: ["delete", "remove", "destroy", "erase"],
    PATCH: ["patch", "partial", "modify"],
  },
  // Load patterns
  loadPatterns: {
    constant: ["constant", "steady", "fixed", "stable"],
    rampUp: ["ramp", "gradual", "incremental", "step-by-step"],
    spike: ["spike", "burst", "sudden", "peak"],
    step: ["step", "incremental", "progressive"],
  },
  // Time units
  timeUnits: {
    s: ["second", "seconds", "sec", "s"],
    m: ["minute", "minutes", "min", "m"],
    h: ["hour", "hours", "hr", "h"],
  },
};
