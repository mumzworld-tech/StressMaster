/**
 * Test data sets for messy input handling
 * Covers various input formats and edge cases as specified in requirements 3.1-3.4
 * Moved from tests/unit/parser/test-data/messy-input-datasets.ts
 */

// Simplified interface for test expectations
export interface ExpectedParseResult {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  loadPattern?: {
    users?: number;
    duration?: string;
    rps?: number;
  };
}

export interface TestDataSet {
  category: "clean" | "messy" | "mixed" | "malformed" | "edge_cases";
  inputs: TestInput[];
  expectedOutputs: ExpectedParseResult[];
  acceptableFallbacks: ExpectedParseResult[];
}

export interface TestInput {
  raw: string;
  description: string;
  expectedChallenges: string[];
  minimumConfidence: number;
}

// Test data for requirement 3.1: Handle extra whitespace and line breaks
export const whitespaceNormalizationDataSet: TestDataSet = {
  category: "messy",
  inputs: [
    {
      raw: `
        
        POST     https://api.example.com/users
        
        
        Content-Type:    application/json
        
        
        {
          "name":   "John Doe"    ,
          "email":     "john@example.com"
        }
        
        
        Run for 30 seconds with 10 users
        
      `,
      description: "Input with excessive whitespace and line breaks",
      expectedChallenges: ["whitespace normalization", "structure extraction"],
      minimumConfidence: 0.8,
    },
    {
      raw: `GET\t\t\thttps://api.example.com/data\n\n\nAuthorization:\t\tBearer token123\n\n\nLoad test with\t5 users\tfor\t60 seconds`,
      description: "Input with mixed tabs and newlines",
      expectedChallenges: ["tab normalization", "mixed whitespace"],
      minimumConfidence: 0.8,
    },
  ],
  expectedOutputs: [
    {
      method: "POST",
      url: "https://api.example.com/users",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"John Doe","email":"john@example.com"}',
      loadPattern: { users: 10, duration: "30s" },
    },
    {
      method: "GET",
      url: "https://api.example.com/data",
      headers: { Authorization: "Bearer token123" },
      loadPattern: { users: 5, duration: "60s" },
    },
  ],
  acceptableFallbacks: [],
};

// Test data for requirement 3.2: Handle duplicate/conflicting information
export const conflictingDataSet: TestDataSet = {
  category: "messy",
  inputs: [
    {
      raw: `POST /api/users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Type: application/xml

{"name": "John"}

Also make a POST request to https://api.example.com/users with JSON data {"name": "John", "email": "john@example.com"}

Test with 10 users, no wait 15 users for 30 seconds`,
      description: "Input with duplicate headers and conflicting information",
      expectedChallenges: [
        "duplicate headers",
        "conflicting user counts",
        "information prioritization",
      ],
      minimumConfidence: 0.7,
    },
    {
      raw: `GET https://api.example.com/data
GET https://different.com/api
Authorization: Bearer abc123
Authorization: Bearer xyz789

Load test with 5 users
Actually use 10 users instead
Run for 60 seconds`,
      description: "Multiple URLs and conflicting authorization",
      expectedChallenges: [
        "multiple URLs",
        "conflicting auth",
        "user count changes",
      ],
      minimumConfidence: 0.6,
    },
  ],
  expectedOutputs: [
    {
      method: "POST",
      url: "https://api.example.com/users",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"John","email":"john@example.com"}',
      loadPattern: { users: 15, duration: "30s" },
    },
    {
      method: "GET",
      url: "https://api.example.com/data",
      headers: { Authorization: "Bearer xyz789" },
      loadPattern: { users: 10, duration: "60s" },
    },
  ],
  acceptableFallbacks: [],
};

// Test data for requirement 3.3: Handle partial URLs and relative paths
export const partialUrlDataSet: TestDataSet = {
  category: "messy",
  inputs: [
    {
      raw: `POST /api/users
Host: example.com
Content-Type: application/json

{"name": "John"}

Test with 5 users for 30 seconds`,
      description: "Relative path with separate host header",
      expectedChallenges: ["URL reconstruction", "host header parsing"],
      minimumConfidence: 0.8,
    },
    {
      raw: `GET /search?q=test
Base URL is https://api.service.com
Authorization: Bearer token

Load test with 10 concurrent users`,
      description: "Relative path with base URL mentioned separately",
      expectedChallenges: ["base URL extraction", "path combination"],
      minimumConfidence: 0.7,
    },
    {
      raw: `Make a request to /api/v1/data on the production server (prod.example.com)
Use GET method
Add API key header: x-api-key: secret123
Test with 20 users`,
      description: "Natural language with embedded URL components",
      expectedChallenges: [
        "natural language parsing",
        "URL component extraction",
      ],
      minimumConfidence: 0.6,
    },
  ],
  expectedOutputs: [
    {
      method: "POST",
      url: "https://example.com/api/users",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"John"}',
      loadPattern: { users: 5, duration: "30s" },
    },
    {
      method: "GET",
      url: "https://api.service.com/search?q=test",
      headers: { Authorization: "Bearer token" },
      loadPattern: { users: 10 },
    },
    {
      method: "GET",
      url: "https://prod.example.com/api/v1/data",
      headers: { "x-api-key": "secret123" },
      loadPattern: { users: 20 },
    },
  ],
  acceptableFallbacks: [],
};

// Test data for requirement 3.4: Handle various header formats
export const headerFormatsDataSet: TestDataSet = {
  category: "messy",
  inputs: [
    {
      raw: `POST https://api.example.com/data
Content-Type: application/json
Authorization:Bearer token123
X-Custom-Header:value
x-another-header: another value
ACCEPT: application/json

{"data": "test"}

Load test with 5 users`,
      description: "Mixed header formats and casing",
      expectedChallenges: [
        "header normalization",
        "case handling",
        "spacing issues",
      ],
      minimumConfidence: 0.8,
    },
    {
      raw: `curl -X POST https://api.example.com/submit \\
  -H "Content-Type: application/json" \\
  -H 'Authorization: Bearer abc123' \\
  -H "X-Request-ID: req-123" \\
  -d '{"message": "hello"}'

Test this with 10 users for 60 seconds`,
      description: "Curl command with mixed quote styles",
      expectedChallenges: [
        "curl parsing",
        "quote handling",
        "header extraction",
      ],
      minimumConfidence: 0.7,
    },
  ],
  expectedOutputs: [
    {
      method: "POST",
      url: "https://api.example.com/data",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
        "X-Custom-Header": "value",
        "x-another-header": "another value",
        Accept: "application/json",
      },
      body: '{"data":"test"}',
      loadPattern: { users: 5 },
    },
    {
      method: "POST",
      url: "https://api.example.com/submit",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer abc123",
        "X-Request-ID": "req-123",
      },
      body: '{"message":"hello"}',
      loadPattern: { users: 10, duration: "60s" },
    },
  ],
  acceptableFallbacks: [],
};

// Edge cases and malformed input
export const edgeCasesDataSet: TestDataSet = {
  category: "edge_cases",
  inputs: [
    {
      raw: `POST https://api.example.com/users POST https://api.example.com/data GET https://api.example.com/info Content-Type: application/json Authorization: Bearer token {"name": "John"} {"id": 123} Test with 5 users 10 users 15 users for 30 seconds 60 seconds`,
      description: "Concatenated requests without separators",
      expectedChallenges: [
        "request separation",
        "data association",
        "parameter disambiguation",
      ],
      minimumConfidence: 0.5,
    },
    {
      raw: `🚀 POST https://api.example.com/users 📝 Content-Type: application/json 🔑 Authorization: Bearer token123 📊 {"name": "John Doe", "email": "john@example.com"} ⚡ Load test with 10 users for 30 seconds`,
      description: "Input with emojis and special characters",
      expectedChallenges: ["emoji handling", "special character filtering"],
      minimumConfidence: 0.7,
    },
    {
      raw: `   `,
      description: "Empty input",
      expectedChallenges: ["empty input handling"],
      minimumConfidence: 0.0,
    },
    {
      raw: `POST https://api.example.com/users`.repeat(1000),
      description: "Extremely long repetitive input",
      expectedChallenges: ["input length handling", "repetition detection"],
      minimumConfidence: 0.6,
    },
  ],
  expectedOutputs: [
    {
      method: "POST",
      url: "https://api.example.com/users",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: '{"name":"John"}',
      loadPattern: { users: 15, duration: "60s" },
    },
    {
      method: "POST",
      url: "https://api.example.com/users",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
      },
      body: '{"name":"John Doe","email":"john@example.com"}',
      loadPattern: { users: 10, duration: "30s" },
    },
    {}, // Empty spec for empty input
    {
      method: "POST",
      url: "https://api.example.com/users",
      loadPattern: { users: 1 },
    },
  ],
  acceptableFallbacks: [],
};

// Mixed format data combining natural language with structured data
export const mixedFormatDataSet: TestDataSet = {
  category: "mixed",
  inputs: [
    {
      raw: `I need to test the user creation endpoint. It's a POST request to https://api.example.com/users and requires these headers:
      
Content-Type: application/json
Authorization: Bearer abc123

The request body should be:
{
  "name": "Test User",
  "email": "test@example.com",
  "role": "admin"
}

Please run this load test with 25 concurrent users for 2 minutes.`,
      description: "Natural language mixed with structured data",
      expectedChallenges: [
        "natural language parsing",
        "structured data extraction",
      ],
      minimumConfidence: 0.8,
    },
    {
      raw: `Here's the curl command from our API docs:

curl -X POST https://api.service.com/orders \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token" \\
  -d '{
    "product_id": 123,
    "quantity": 2,
    "customer_id": 456
  }'

Can you create a load test that simulates 50 users placing orders simultaneously? Run it for about 5 minutes to see how the system handles the load.`,
      description: "Curl command embedded in natural language",
      expectedChallenges: ["curl extraction", "natural language parameters"],
      minimumConfidence: 0.8,
    },
  ],
  expectedOutputs: [
    {
      method: "POST",
      url: "https://api.example.com/users",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer abc123",
      },
      body: '{"name":"Test User","email":"test@example.com","role":"admin"}',
      loadPattern: { users: 25, duration: "2m" },
    },
    {
      method: "POST",
      url: "https://api.service.com/orders",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: '{"product_id":123,"quantity":2,"customer_id":456}',
      loadPattern: { users: 50, duration: "5m" },
    },
  ],
  acceptableFallbacks: [],
};

// Clean input data for baseline testing
export const cleanInputDataSet: TestDataSet = {
  category: "clean",
  inputs: [
    {
      raw: `POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123

{"name": "John Doe", "email": "john@example.com"}

Load test with 10 users for 30 seconds`,
      description: "Well-formatted structured input",
      expectedChallenges: ["JSON parsing"],
      minimumConfidence: 0.95,
    },
    {
      raw: `GET https://api.example.com/data
Authorization: Bearer token456

Test with 5 users for 60 seconds`,
      description: "Simple GET request with clear parameters",
      expectedChallenges: ["natural language parsing"],
      minimumConfidence: 0.9,
    },
  ],
  expectedOutputs: [
    {
      method: "POST",
      url: "https://api.example.com/users",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
      },
      body: '{"name":"John Doe","email":"john@example.com"}',
      loadPattern: { users: 10, duration: "30s" },
    },
    {
      method: "GET",
      url: "https://api.example.com/data",
      headers: { Authorization: "Bearer token456" },
      loadPattern: { users: 5, duration: "60s" },
    },
  ],
  acceptableFallbacks: [],
};

export const allTestDataSets: TestDataSet[] = [
  cleanInputDataSet,
  whitespaceNormalizationDataSet,
  conflictingDataSet,
  partialUrlDataSet,
  headerFormatsDataSet,
  edgeCasesDataSet,
  mixedFormatDataSet,
];
