/**
 * Unified prompt building system that combines smart prompt construction with template management
 * Merges functionality from smart-prompt-builder.ts and prompt-templates.ts
 */

import { LoadTestSpec } from "../../types";

export interface PromptExample {
  input: string;
  output: LoadTestSpec;
  description: string;
  relevanceScore?: number;
}

export interface EnhancedPrompt {
  systemPrompt: string;
  contextualExamples: PromptExample[];
  clarifications: string[];
  parsingInstructions: string[];
  fallbackInstructions: string[];
}

export interface ParseContext {
  originalInput: string;
  confidence: number;
  ambiguities: any[];
  extractedComponents: {
    methods: string[];
    urls: string[];
    counts: number[];
    bodies: string[];
  };
  inferredFields: {
    testType?: string;
    loadPattern?: string;
  };
}

export interface InputFormat {
  natural_language: string;
  mixed_structured: string;
  curl_command: string;
  http_raw: string;
  json_with_text: string;
  concatenated_requests: string;
}

export class PromptBuilder {
  private static readonly SYSTEM_PROMPT = `You are StressMaster's AI assistant that converts natural language descriptions into structured load test specifications. 

Your task is to parse user commands and extract:
- HTTP method (GET, POST, PUT, DELETE, etc.)
- Target URL
- Request payload (if any)
- Media files for upload (if any)
- Load pattern (constant, ramp-up, spike, step)
- Test duration and virtual users
- Test type (baseline, spike, stress, endurance, volume, batch)

WORKFLOW SUPPORT:
- Understand natural language patterns for sequences (first, then, next, finally, start by, etc.)
- Recognize parallel execution (and, also, at the same time, simultaneously, etc.)
- Handle data dependencies between steps (with data from step X, using response from previous step, etc.)
- Support mixed sequential and parallel workflows
- Accept ANY format: bullet points (•), commas, semicolons, newlines, or plain text
- Be flexible with input structure - adapt to user's natural way of writing

BATCH TESTING SUPPORT:
- Recognize batch commands: "batch test:", "test multiple APIs:", "parallel test:", "sequential test:"
- Support multiple API endpoints in single command: "GET api1.com, POST api2.com, PUT api3.com"
- Handle different load patterns per API: "100 requests to api1.com, 50 requests to api2.com"
- Support mixed execution modes: "parallel batch:", "sequential batch:", "run in parallel:", "run sequentially:"
- Support dynamic payloads: "increment user.id by 1", "random values for data.field"
- Support execution options: "max 3 concurrent", "delay 5s between tests", "retry failed tests"
- Support K6 configuration: "generate separate K6 scripts", "custom K6 options"
- Support comprehensive reporting: "individual reports", "combined report", "include raw data"
- Aggregate results from multiple APIs into unified report
- Support batch with media: "POST api1.com with file: @data.json, GET api2.com/status"
- Support assertions: "expect success rate > 95%", "max response time < 500ms"

MEDIA SUPPORT:
- Recognize file upload patterns: "file: @image.jpg", "avatar: @photo.png"
- Support multiple files: "files: @doc1.pdf, @doc2.docx"
- Handle mixed data and files: "avatar: @photo.png and data: {"name": "John"}"
- Support various file types: images, documents, archives, audio, video
- Use appropriate content types: multipart/form-data for multiple files, binary for single files

PAYLOAD SOURCES (All Supported):
1. OpenAPI Files: @api.yaml, @spec.yml, @openapi.json
2. JSON Files: @payload.json, @data.json, @template.json
3. Inline JSON: {"key": "value"}, [{"item": "data"}]
4. Natural Language: "user data", "random items", "test payload"
5. Media Files: @image.jpg, @document.pdf, @video.mp4
6. Mixed Sources: Combine any of the above

RULES:
- Respond with ONLY valid JSON
- Use exact URLs and methods from the command
- For file references like "@filename.json", use that as the payload template
- For media files like "file: @image.jpg", add to media.files array
- For OpenAPI files, generate dynamic payloads based on the schema
- For incrementing fields, add them to an incrementFields array
- Keep load patterns simple - just set type and virtualUsers
- Default to POST for requests with payloads or media, GET otherwise
- Generate realistic test data (names, emails, IDs, etc.) instead of hardcoded values
- For workflows, create a "workflow" array with steps
- For batch tests, create a "batch" object with tests array
- Be flexible with workflow structure - adapt to the user's intent

SINGLE REQUEST OUTPUT:
    {
      "method": "POST",
      "url": "http://api.example.com/endpoint",
      "body": {"name": "John Doe", "email": "john@example.com", "age": 30},
      "media": {
        "files": [
          {
            "fieldName": "avatar",
            "filePath": "photo.png"
          }
        ],
        "formData": {"description": "User profile"}
      },
      "requestCount": 10,
      "loadPattern": {"type": "constant", "virtualUsers": 5},
      "duration": {"value": 60, "unit": "seconds"},
      "incrementFields": ["requestId"]
    }

WORKFLOW OUTPUT:
    {
      "workflow": [
        {
          "type": "sequential",
          "steps": [
            {
              "method": "GET",
              "url": "http://api.example.com/users",
              "requestCount": 1
            },
            {
              "method": "POST",
              "url": "http://api.example.com/orders",
              "body": {"userId": "{{step1.userId}}", "items": [{"name": "Product 1"}]},
              "requestCount": 1
            }
          ]
        }
      ],
      "loadPattern": {"type": "constant", "virtualUsers": 1},
      "duration": {"value": 30, "unit": "seconds"}
    }

IMPORTANT: Generate ACTUAL values, not faker templates. Use realistic data like "John Doe", "john@example.com", 30, etc. Do NOT use {{faker.name.fullName}} or similar templates.`;

  private static readonly USER_PROMPT_TEMPLATE = `Parse this StressMaster command and convert it to a LoadTestSpec JSON:

Command: "{input}"

Respond with only valid JSON, no additional text or explanation.`;

  private static readonly EXAMPLES: PromptExample[] = [
    // Workflow Examples
    {
      input:
        "first GET https://api.example.com/users, then POST https://api.example.com/orders",
      output: {
        id: "workflow_" + Date.now(),
        name: "User Order Workflow",
        description: "Simple sequential workflow: get users, create order",
        testType: "workflow",
        requests: [], // Empty for workflow tests
        workflow: [
          {
            type: "sequential",
            steps: [
              {
                method: "GET",
                url: "https://api.example.com/users",
                requestCount: 1,
              },
              {
                method: "POST",
                url: "https://api.example.com/orders",
                body: { userId: "user123", items: [{ name: "Product 1" }] },
                requestCount: 1,
              },
            ],
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "Simple sequential workflow",
    },
    {
      input:
        "• GET https://api.example.com/users\n• POST https://api.example.com/orders",
      output: {
        id: "workflow_" + Date.now(),
        name: "Bullet Point Workflow",
        description: "Workflow with bullet point format",
        testType: "workflow",
        requests: [], // Empty for workflow tests
        workflow: [
          {
            type: "sequential",
            steps: [
              {
                method: "GET",
                url: "https://api.example.com/users",
                requestCount: 1,
              },
              {
                method: "POST",
                url: "https://api.example.com/orders",
                body: { userId: "user123", items: [{ name: "Product 1" }] },
                requestCount: 1,
              },
            ],
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "Bullet point workflow format",
    },
    {
      input:
        "GET https://api.example.com/users; POST https://api.example.com/orders",
      output: {
        id: "workflow_" + Date.now(),
        name: "Semicolon Workflow",
        description: "Workflow with semicolon separator",
        testType: "workflow",
        requests: [], // Empty for workflow tests
        workflow: [
          {
            type: "sequential",
            steps: [
              {
                method: "GET",
                url: "https://api.example.com/users",
                requestCount: 1,
              },
              {
                method: "POST",
                url: "https://api.example.com/orders",
                body: { userId: "user123", items: [{ name: "Product 1" }] },
                requestCount: 1,
              },
            ],
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "Semicolon separated workflow",
    },
    {
      input:
        "start by getting auth token, then fetch products and categories, then create order",
      output: {
        id: "workflow_" + Date.now(),
        name: "Auth Product Order Workflow",
        description: "Sequential workflow with auth, products, and order",
        testType: "workflow",
        requests: [], // Empty for workflow tests
        workflow: [
          {
            type: "sequential",
            steps: [
              {
                method: "GET",
                url: "https://api.example.com/auth/token",
                requestCount: 1,
              },
              {
                method: "GET",
                url: "https://api.example.com/products",
                requestCount: 1,
              },
              {
                method: "POST",
                url: "https://api.example.com/orders",
                body: { productId: "prod123", token: "auth123" },
                requestCount: 1,
              },
            ],
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "Simple sequential workflow",
    },
    {
      input:
        'first GET https://httpbin.org/get, then POST https://httpbin.org/post with {"test": "workflow"}',
      output: {
        id: "workflow_" + Date.now(),
        name: "Simple Workflow Test",
        description: "Simple sequential workflow with GET then POST",
        testType: "workflow",
        requests: [], // Empty for workflow tests
        workflow: [
          {
            type: "sequential",
            steps: [
              {
                method: "GET",
                url: "https://httpbin.org/get",
                requestCount: 1,
              },
              {
                method: "POST",
                url: "https://httpbin.org/post",
                body: { test: "workflow" },
                requestCount: 1,
              },
            ],
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "Simple sequential workflow",
    },
    {
      input: "POST /upload with file: @image.jpg",
      output: {
        id: "media_" + Date.now(),
        name: "Single File Upload",
        description: "Upload single image file",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/upload",
            media: {
              files: [
                {
                  fieldName: "file",
                  filePath: "image.jpg",
                },
              ],
              contentType: "multipart/form-data",
            },
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "Single file upload",
    },
    {
      input:
        'POST /documents with files: @doc1.pdf, @doc2.docx and data: {"category": "legal"}',
      output: {
        id: "media_" + Date.now(),
        name: "Multiple File Upload",
        description: "Upload multiple documents with metadata",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/documents",
            media: {
              files: [
                {
                  fieldName: "files",
                  filePath: "doc1.pdf",
                },
                {
                  fieldName: "files",
                  filePath: "doc2.docx",
                },
              ],
              formData: { category: "legal" },
              contentType: "multipart/form-data",
            },
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "Multiple file upload with metadata",
    },
    {
      input:
        'POST /profile with avatar: @photo.png and data: {"name": "John", "email": "john@example.com"}',
      output: {
        id: "media_" + Date.now(),
        name: "Profile Upload",
        description: "Upload profile with avatar and user data",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/profile",
            media: {
              files: [
                {
                  fieldName: "avatar",
                  filePath: "photo.png",
                },
              ],
              formData: { name: "John", email: "john@example.com" },
              contentType: "multipart/form-data",
            },
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 1 },
        duration: { value: 30, unit: "seconds" },
      },
      description: "File upload with form data",
    },
    // Single Request Examples
    {
      input:
        'send 3 POST requests to http://backbone.mumz.io/magento/qcomm-order with header x-api-key 2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9 and body {"requestId": "demo-testing—10", "payload": [{"externalId": "ord#1"}]} increment requestId',
      output: {
        id: "test_" + Date.now(),
        name: "Magento Order Test",
        description:
          'send 3 POST requests to http://backbone.mumz.io/magento/qcomm-order with header x-api-key 2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9 and body {"requestId": "demo-testing—10", "payload": [{"externalId": "ord#1"}]} increment requestId',
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "http://backbone.mumz.io/magento/qcomm-order",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9",
            },
            payload: {
              template:
                '{"requestId": "{{requestId}}", "payload": [{"externalId": "ord#1"}]}',
              variables: [
                {
                  name: "requestId",
                  type: "incremental",
                  parameters: {
                    baseValue: "demo-testing—10",
                  },
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 3,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      },
      description: "JSON payload with requestId incrementing",
    },
    {
      input:
        'send 2 POST requests to http://backbone.mumz.io/magento/qcomm-order with header x-api-key 2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9 and body {"requestId": "seller-req1", "payload": [{"externalId": "Seller#1", "order_id": "5783136", "increment_id": "1202500044"}]} increment order_id and increment_id',
      output: {
        id: "test_" + Date.now(),
        name: "Magento Order Test",
        description:
          'send 2 POST requests to http://backbone.mumz.io/magento/qcomm-order with header x-api-key 2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9 and body {"requestId": "seller-req1", "payload": [{"externalId": "Seller#1", "order_id": "5783136", "increment_id": "1202500044"}]} increment order_id and increment_id',
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "http://backbone.mumz.io/magento/qcomm-order",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9",
            },
            payload: {
              template:
                '{"requestId": "seller-req1", "payload": [{"externalId": "Seller#1", "order_id": "{{order_id}}", "increment_id": "{{increment_id}}"}]}',
              variables: [
                {
                  name: "order_id",
                  type: "incremental",
                  parameters: {
                    baseValue: "5783136",
                  },
                },
                {
                  name: "increment_id",
                  type: "incremental",
                  parameters: {
                    baseValue: "1202500044",
                  },
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 2,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      },
      description: "Complex JSON payload with variable incrementing",
    },
    {
      input:
        "Send 100 POST requests to https://api.example.com/orders with random orderIds",
      output: {
        id: "test_" + Date.now(),
        name: "POST Orders Test",
        description:
          "Send 100 POST requests to https://api.example.com/orders with random orderIds",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/orders",
            headers: {
              "Content-Type": "application/json",
            },
            payload: {
              template: '{"orderId": "{{orderId}}"}',
              variables: [
                {
                  name: "orderId",
                  type: "random_id",
                  parameters: {},
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 100,
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      },
      description: "Simple POST request with concurrent users",
    },
    {
      input:
        'send 6 POST requests with spike pattern to https://httpbin.org/post with body {"test":"spike-data"}',
      output: {
        id: "test_" + Date.now(),
        name: "Spike Test",
        description: "Spike pattern test with POST requests",
        testType: "spike",
        requests: [
          {
            method: "POST",
            url: "https://httpbin.org/post",
            payload: {
              template: '{"test":"spike-data"}',
              variables: [],
            },
          },
        ],
        loadPattern: {
          type: "spike",
          virtualUsers: 6,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      },
      description: "Simple spike pattern test with specified request count",
    },
    {
      input:
        "Stress test gradually increasing from 10 to 100 users over 5 minutes for POST /api/login",
      output: {
        id: "test_" + Date.now(),
        name: "Stress Test Login API",
        description:
          "Stress test gradually increasing from 10 to 100 users over 5 minutes for POST /api/login",
        testType: "stress",
        requests: [
          {
            method: "POST",
            url: "/api/login",
            headers: {
              "Content-Type": "application/json",
            },
            payload: {
              template:
                '{"username": "{{username}}", "password": "{{password}}"}',
              variables: [
                {
                  name: "username",
                  type: "random_string",
                  parameters: { length: 8 },
                },
                {
                  name: "password",
                  type: "random_string",
                  parameters: { length: 12 },
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "ramp-up",
          virtualUsers: 100,
          rampUpTime: {
            value: 5,
            unit: "minutes",
          },
        },
        duration: {
          value: 10,
          unit: "minutes",
        },
      },
      description: "Gradual ramp-up stress test",
    },
    {
      input:
        'send 3 POST requests to https://api.example.com/orders with header x-api-key abc123 {"requestId": "order-123", "payload": [{"externalId": "ORD#1"}]}',
      output: {
        id: "test_" + Date.now(),
        name: "Load Test API",
        description:
          "Send 3 POST requests to API endpoint with specific JSON payload",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/orders",
            headers: {
              "x-api-key": "abc123",
              "Content-Type": "application/json",
            },
            body: {
              requestId: "order-123",
              payload: [{ externalId: "ORD#1" }],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 3,
        },
        duration: {
          value: 30,
          unit: "seconds",
        },
      },
      description: "Curl command with JSON payload",
    },
    {
      input:
        "Send X requests at random intervals to simulate unpredictable real-world traffic patterns",
      output: {
        id: "test_" + Date.now(),
        name: "Random Burst Traffic Test",
        description:
          "Send X requests at random intervals to simulate unpredictable real-world traffic patterns",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/health",
            headers: {
              "Content-Type": "application/json",
            },
          },
        ],
        loadPattern: {
          type: "random-burst",
          virtualUsers: 50,
          burstConfig: {
            minBurstSize: 5,
            maxBurstSize: 20,
            minIntervalSeconds: 2,
            maxIntervalSeconds: 15,
            burstProbability: 0.3,
          },
        },
        duration: {
          value: 10,
          unit: "minutes",
        },
      },
      description: "Random burst pattern for unpredictable traffic simulation",
    },
    {
      input:
        "Push 1,000 requests, each carrying 100 items per payload to stress test bulk data handling",
      output: {
        id: "test_" + Date.now(),
        name: "High-Volume Bulk Data Test",
        description:
          "Push 1,000 requests, each carrying 100 items per payload to stress test bulk data handling",
        testType: "volume",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/bulk-data",
            headers: {
              "Content-Type": "application/json",
            },
            payload: {
              template: '{"batchId": "{{batchId}}", "items": {{items}}}',
              variables: [
                {
                  name: "batchId",
                  type: "uuid",
                  parameters: {},
                },
                {
                  name: "items",
                  type: "bulk_data",
                  parameters: {
                    itemCount: 100,
                    itemTemplate:
                      '{"id": "{{itemId}}", "name": "{{itemName}}", "value": "{{itemValue}}"}',
                    itemVariables: [
                      {
                        name: "itemId",
                        type: "random_id",
                        parameters: { min: 1000, max: 999999 },
                      },
                      {
                        name: "itemName",
                        type: "random_string",
                        parameters: { length: 10 },
                      },
                      {
                        name: "itemValue",
                        type: "random_string",
                        parameters: { length: 8 },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 1000,
        },
        duration: {
          value: 5,
          unit: "minutes",
        },
      },
      description: "High-volume bulk data payload test",
    },
    {
      input:
        "batch test: GET https://api1.com/users, POST https://api2.com/orders, PUT https://api3.com/inventory",
      output: {
        id: "batch_" + Date.now(),
        name: "Multi-API Batch Test",
        description: "Batch test with multiple API endpoints",
        testType: "batch",
        requests: [], // Empty for batch tests
        batch: {
          id: "batch_" + Date.now(),
          name: "Multi-API Batch Test",
          description: "Batch test with multiple API endpoints",
          tests: [
            {
              id: "test1_" + Date.now(),
              name: "Users API Test",
              description: "GET request to users API",
              testType: "baseline",
              requests: [
                {
                  method: "GET",
                  url: "https://api1.com/users",
                  headers: { "Content-Type": "application/json" },
                },
              ],
              loadPattern: { type: "constant", virtualUsers: 10 },
              duration: { value: 60, unit: "seconds" },
            },
            {
              id: "test2_" + Date.now(),
              name: "Orders API Test",
              description: "POST request to orders API",
              testType: "baseline",
              requests: [
                {
                  method: "POST",
                  url: "https://api2.com/orders",
                  headers: { "Content-Type": "application/json" },
                  body: { userId: "user123", items: [{ name: "Product 1" }] },
                },
              ],
              loadPattern: { type: "constant", virtualUsers: 10 },
              duration: { value: 60, unit: "seconds" },
            },
            {
              id: "test3_" + Date.now(),
              name: "Inventory API Test",
              description: "PUT request to inventory API",
              testType: "baseline",
              requests: [
                {
                  method: "PUT",
                  url: "https://api3.com/inventory",
                  headers: { "Content-Type": "application/json" },
                  body: { productId: "prod123", quantity: 5 },
                },
              ],
              loadPattern: { type: "constant", virtualUsers: 10 },
              duration: { value: 60, unit: "seconds" },
            },
          ],
          executionMode: "parallel",
          aggregationMode: "combined",
        },
        loadPattern: { type: "constant", virtualUsers: 30 },
        duration: { value: 60, unit: "seconds" },
      },
      description: "Batch test with multiple APIs",
    },
    {
      input:
        "batch: 100 requests to https://api1.com/users, 50 requests to https://api2.com/orders",
      output: {
        id: "batch_" + Date.now(),
        name: "Different Load Batch Test",
        description: "Batch test with different load patterns",
        testType: "batch",
        requests: [], // Empty for batch tests
        batch: {
          id: "batch_" + Date.now(),
          name: "Different Load Batch Test",
          description: "Batch test with different load patterns",
          tests: [
            {
              id: "test1_" + Date.now(),
              name: "Users API Test",
              description: "100 requests to users API",
              testType: "baseline",
              requests: [
                {
                  method: "GET",
                  url: "https://api1.com/users",
                  headers: { "Content-Type": "application/json" },
                },
              ],
              loadPattern: { type: "constant", virtualUsers: 100 },
              duration: { value: 60, unit: "seconds" },
            },
            {
              id: "test2_" + Date.now(),
              name: "Orders API Test",
              description: "50 requests to orders API",
              testType: "baseline",
              requests: [
                {
                  method: "GET",
                  url: "https://api2.com/orders",
                  headers: { "Content-Type": "application/json" },
                },
              ],
              loadPattern: { type: "constant", virtualUsers: 50 },
              duration: { value: 60, unit: "seconds" },
            },
          ],
          executionMode: "sequential",
          aggregationMode: "combined",
        },
        loadPattern: { type: "constant", virtualUsers: 150 },
        duration: { value: 60, unit: "seconds" },
      },
      description: "Batch test with different request counts",
    },
    {
      input:
        "sequential batch: 20 requests to https://api1.com/get, 15 requests to https://api2.com/post with dynamic payload increment user.id by 1, expect success rate > 95%",
      output: {
        id: "batch_" + Date.now(),
        name: "Sequential Batch with Dynamic Payloads",
        description:
          "Sequential batch test with dynamic payloads and assertions",
        testType: "batch",
        requests: [],
        batch: {
          id: "batch_" + Date.now(),
          name: "Sequential Batch with Dynamic Payloads",
          description:
            "Sequential batch test with dynamic payloads and assertions",
          executionMode: "sequential",
          dynamicPayloads: {
            enabled: true,
            incrementStrategy: "linear",
            baseValues: { "user.id": 1 },
            incrementRules: [
              {
                fieldPath: "user.id",
                incrementType: "number",
                incrementValue: 1,
              },
            ],
          },
          tests: [
            {
              id: "test1_" + Date.now(),
              name: "GET API Test",
              description: "20 requests to GET API",
              testType: "baseline",
              requests: [{ method: "GET", url: "https://api1.com/get" }],
              loadPattern: { type: "constant", virtualUsers: 20 },
              assertions: [
                {
                  name: "Success Rate",
                  type: "success_rate",
                  condition: "greater_than",
                  expectedValue: 0.95,
                },
              ],
            },
            {
              id: "test2_" + Date.now(),
              name: "POST API Test",
              description: "15 requests to POST API",
              testType: "baseline",
              requests: [{ method: "POST", url: "https://api2.com/post" }],
              loadPattern: { type: "constant", virtualUsers: 15 },
              assertions: [
                {
                  name: "Success Rate",
                  type: "success_rate",
                  condition: "greater_than",
                  expectedValue: 0.95,
                },
              ],
            },
          ],
          aggregationMode: "combined",
        },
        loadPattern: { type: "constant", virtualUsers: 35 },
        duration: { value: 60, unit: "seconds" },
      },
      description: "Sequential batch with dynamic payloads and assertions",
    },
    {
      input:
        "parallel batch with K6 scripts: 100 requests to https://api1.com/get, 75 requests to https://api2.com/post, max 3 concurrent, generate individual reports",
      output: {
        id: "batch_" + Date.now(),
        name: "Parallel Batch with K6 and Reports",
        description:
          "Parallel batch test with K6 scripts and individual reports",
        testType: "batch",
        requests: [],
        batch: {
          id: "batch_" + Date.now(),
          name: "Parallel Batch with K6 and Reports",
          description:
            "Parallel batch test with K6 scripts and individual reports",
          executionMode: "parallel",
          executionOptions: { parallelConcurrency: 3 },
          k6Config: { generateSeparateScripts: true },
          reporting: {
            generateIndividualReports: true,
            combinedReportFormat: "html",
            includeRawData: false,
          },
          tests: [
            {
              id: "test1_" + Date.now(),
              name: "GET API Test",
              description: "100 requests to GET API",
              testType: "baseline",
              requests: [{ method: "GET", url: "https://api1.com/get" }],
              loadPattern: { type: "constant", virtualUsers: 100 },
            },
            {
              id: "test2_" + Date.now(),
              name: "POST API Test",
              description: "75 requests to POST API",
              testType: "baseline",
              requests: [{ method: "POST", url: "https://api2.com/post" }],
              loadPattern: { type: "constant", virtualUsers: 75 },
            },
          ],
          aggregationMode: "combined",
        },
        loadPattern: { type: "constant", virtualUsers: 175 },
        duration: { value: 60, unit: "seconds" },
      },
      description: "Parallel batch with K6 scripts and reporting",
    },
  ];

  private static readonly CONTEXTUAL_INSTRUCTIONS = {
    natural_language:
      "Focus on extracting intent from natural language descriptions. Infer technical details from context clues.",
    mixed_structured:
      "Parse both structured data and natural language. Prioritize explicit structured data over inferred values.",
    curl_command:
      "Extract all parameters from the curl command. Pay attention to headers, method, and data flags.",
    http_raw:
      "Parse the raw HTTP request format. Extract method, path, headers, and body from the HTTP structure.",
    json_with_text:
      "Extract JSON blocks as request bodies. Use surrounding text for context and configuration.",
    concatenated_requests:
      "Identify and separate multiple requests. Create appropriate test scenarios for each.",
  };

  static buildPrompt(context: ParseContext): EnhancedPrompt {
    const formatInstructions = this.getFormatInstructions(context);
    const systemPrompt = this.buildSystemPrompt(context, formatInstructions);
    const contextualExamples = this.selectRelevantExamples(context);
    const clarifications = this.addClarifications(context);
    const parsingInstructions = this.createParsingInstructions(context);
    const fallbackInstructions = this.createFallbackInstructions(context);

    return {
      systemPrompt,
      contextualExamples,
      clarifications,
      parsingInstructions,
      fallbackInstructions,
    };
  }

  static getSystemPrompt(): string {
    return this.SYSTEM_PROMPT;
  }

  static getUserPrompt(input: string): string {
    return this.USER_PROMPT_TEMPLATE.replace("{input}", input);
  }

  static getExamples(): PromptExample[] {
    return this.EXAMPLES;
  }

  static buildFullPrompt(input: string): string {
    const examples = this.EXAMPLES.map(
      (example) =>
        `Input: "${example.input}"\nOutput: ${JSON.stringify(
          example.output,
          null,
          2
        )}`
    ).join("\n\n");

    return `${this.SYSTEM_PROMPT}

Here are some examples:

${examples}

Now parse this command:
${this.getUserPrompt(input)}`;
  }

  private static selectRelevantExamples(
    context: ParseContext
  ): PromptExample[] {
    const selectedExamples: PromptExample[] = [];

    // Score examples based on relevance
    const scoredExamples = this.EXAMPLES.map((example) => ({
      ...example,
      relevanceScore: this.calculateRelevanceScore(example, context),
    }));

    // Sort by relevance and select top examples
    scoredExamples
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 3)
      .forEach((example) => selectedExamples.push(example));

    return selectedExamples;
  }

  private static calculateRelevanceScore(
    example: PromptExample,
    context: ParseContext
  ): number {
    let score = 0;

    // Method matching
    if (
      example.output.requests[0]?.method &&
      context.extractedComponents.methods.includes(
        example.output.requests[0].method
      )
    ) {
      score += 0.3;
    }

    // Test type matching
    if (example.output.testType === context.inferredFields.testType) {
      score += 0.3;
    }

    // Load pattern matching
    if (
      example.output.loadPattern.type === context.inferredFields.loadPattern
    ) {
      score += 0.2;
    }

    // URL pattern matching
    const exampleUrl = example.output.requests[0]?.url || "";
    const hasMatchingUrlPattern = context.extractedComponents.urls.some(
      (url) =>
        url.includes(exampleUrl.split("/").pop() || "") ||
        exampleUrl.includes(url.split("/").pop() || "")
    );
    if (hasMatchingUrlPattern) {
      score += 0.2;
    }

    return score;
  }

  private static addClarifications(context: ParseContext): string[] {
    const clarifications: string[] = [];

    // Add clarifications for each ambiguity
    context.ambiguities.forEach((ambiguity) => {
      const clarification = this.generateClarificationForAmbiguity(ambiguity);
      if (clarification) {
        clarifications.push(clarification);
      }
    });

    // Add format-specific clarifications
    const formatClarifications = this.getFormatSpecificClarifications(context);
    clarifications.push(...formatClarifications);

    // Add confidence-based clarifications
    if (context.confidence < 0.6) {
      clarifications.push(
        "Input appears ambiguous or incomplete. Make reasonable assumptions and document them clearly."
      );
    }

    return clarifications;
  }

  private static generateClarificationForAmbiguity(
    ambiguity: any
  ): string | null {
    switch (ambiguity.field) {
      case "method":
        return `HTTP method not specified. Will default to ${ambiguity.possibleValues[0]} based on context.`;
      case "url":
        return `URL incomplete or missing. ${ambiguity.reason}`;
      case "userCount":
        return `User count not specified. Will use default of ${ambiguity.possibleValues[0]} concurrent users.`;
      case "duration":
        return `Test duration not specified. Will use default of ${ambiguity.possibleValues[0]}.`;
      case "content-type":
        return `Content-Type header missing for request with body. Will default to ${ambiguity.possibleValues[0]}.`;
      default:
        return `${ambiguity.field}: ${ambiguity.reason}`;
    }
  }

  private static getFormatInstructions(context: ParseContext): string {
    const format = this.inferInputFormat(context);
    return (
      this.CONTEXTUAL_INSTRUCTIONS[format] ||
      this.CONTEXTUAL_INSTRUCTIONS.natural_language
    );
  }

  private static inferInputFormat(
    context: ParseContext
  ): keyof typeof PromptBuilder.CONTEXTUAL_INSTRUCTIONS {
    const input = context.originalInput.toLowerCase();

    if (input.includes("curl")) return "curl_command";
    if (input.match(/^(get|post|put|delete)\s+\/\S*\s+http\/\d\.\d/m))
      return "http_raw";
    if (context.extractedComponents.bodies.length > 0 && input.length > 100)
      return "json_with_text";
    if (
      context.extractedComponents.urls.length > 1 ||
      context.extractedComponents.methods.length > 1
    )
      return "concatenated_requests";
    if (
      context.extractedComponents.urls.length > 0 ||
      context.extractedComponents.methods.length > 0
    )
      return "mixed_structured";

    return "natural_language";
  }

  private static buildSystemPrompt(
    context: ParseContext,
    formatInstructions: string
  ): string {
    let systemPrompt = this.SYSTEM_PROMPT;

    // Add format-specific instructions
    systemPrompt += `\n\nFormat-specific instructions: ${formatInstructions}`;

    // Add confidence-based instructions
    if (context.confidence < 0.5) {
      systemPrompt +=
        "\n\nNote: Input appears to have low confidence. Make conservative assumptions and clearly document them.";
    }

    // Add ambiguity handling instructions
    if (context.ambiguities.length > 0) {
      systemPrompt +=
        "\n\nAmbiguity handling: When multiple values are possible, choose the most common or reasonable default. Document all assumptions made during parsing.";
    }

    return systemPrompt;
  }

  private static getFormatSpecificClarifications(
    context: ParseContext
  ): string[] {
    const clarifications: string[] = [];
    const format = this.inferInputFormat(context);

    switch (format) {
      case "curl_command":
        clarifications.push(
          "Parsing curl command - extracting all flags and parameters."
        );
        break;
      case "http_raw":
        clarifications.push(
          "Parsing raw HTTP request format - extracting method, headers, and body."
        );
        break;
      case "concatenated_requests":
        clarifications.push(
          "Multiple requests detected - will create separate test scenarios."
        );
        break;
      case "json_with_text":
        clarifications.push(
          "JSON data found with descriptive text - using JSON as request body."
        );
        break;
      case "mixed_structured":
        clarifications.push(
          "Mixed structured and natural language input - prioritizing structured data."
        );
        break;
    }

    return clarifications;
  }

  private static createParsingInstructions(context: ParseContext): string[] {
    const instructions: string[] = [];

    // Add instructions based on extracted components
    if (context.extractedComponents.methods.length > 0) {
      instructions.push(
        `Use HTTP method: ${context.extractedComponents.methods[0]}`
      );
    }

    if (context.extractedComponents.urls.length > 0) {
      instructions.push(`Target URL: ${context.extractedComponents.urls[0]}`);
    }

    if (context.extractedComponents.counts.length > 0) {
      instructions.push(`User count: ${context.extractedComponents.counts[0]}`);
    }

    // Add instructions based on inferred fields
    if (context.inferredFields.testType) {
      instructions.push(`Test type: ${context.inferredFields.testType}`);
    }

    if (context.inferredFields.loadPattern) {
      instructions.push(`Load pattern: ${context.inferredFields.loadPattern}`);
    }

    return instructions;
  }

  private static createFallbackInstructions(context: ParseContext): string[] {
    const instructions = [
      "If parsing fails, extract whatever components are clearly identifiable",
      "Use reasonable defaults for missing required fields",
      "Maintain valid JSON structure even with incomplete data",
      "Provide helpful error messages in the response",
    ];

    // Add context-specific fallback instructions
    if (context.confidence < 0.3) {
      instructions.push(
        "Very low confidence input - use minimal viable test configuration"
      );
    }

    if (context.ambiguities.length > 3) {
      instructions.push(
        "High ambiguity input - prioritize most critical components (method, URL)"
      );
    }

    return instructions;
  }

  // Utility methods from prompt-templates.ts
  static extractVariablesFromPayload(
    payloadDescription: string
  ): Array<{ name: string; type: string; parameters?: any }> {
    const variables: Array<{ name: string; type: string; parameters?: any }> =
      [];

    // Common patterns for variable extraction
    const patterns = [
      { regex: /random\s+(\w+)/gi, type: "random_string" },
      { regex: /(\w+)Id/gi, type: "random_id" },
      { regex: /uuid/gi, type: "uuid" },
      { regex: /timestamp/gi, type: "timestamp" },
      { regex: /sequence/gi, type: "sequence" },
    ];

    patterns.forEach((pattern) => {
      const matches = payloadDescription.matchAll(pattern.regex);
      for (const match of matches) {
        const name = match[1] || match[0];
        if (!variables.some((v) => v.name === name)) {
          variables.push({
            name: name.toLowerCase(),
            type: pattern.type as any,
            parameters: pattern.type === "random_string" ? { length: 10 } : {},
          });
        }
      }
    });

    return variables;
  }

  static inferTestType(input: string): string {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes("spike")) return "spike";
    if (
      lowerInput.includes("stress") ||
      lowerInput.includes("gradually") ||
      lowerInput.includes("ramp")
    )
      return "stress";
    if (
      lowerInput.includes("endurance") ||
      lowerInput.includes("sustained") ||
      lowerInput.includes("long")
    )
      return "endurance";
    if (
      lowerInput.includes("volume") ||
      lowerInput.includes("high volume") ||
      lowerInput.includes("many users")
    )
      return "volume";
    if (lowerInput.includes("baseline") || lowerInput.includes("benchmark"))
      return "baseline";

    return "baseline"; // default
  }

  static inferHttpMethod(input: string): string {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes("post") ||
      lowerInput.includes("create") ||
      lowerInput.includes("submit")
    )
      return "POST";
    if (lowerInput.includes("put") || lowerInput.includes("update"))
      return "PUT";
    if (lowerInput.includes("delete") || lowerInput.includes("remove"))
      return "DELETE";
    if (lowerInput.includes("patch") || lowerInput.includes("modify"))
      return "PATCH";
    if (
      lowerInput.includes("get") ||
      lowerInput.includes("fetch") ||
      lowerInput.includes("retrieve")
    )
      return "GET";

    // If payload is mentioned, likely POST
    if (
      lowerInput.includes("payload") ||
      lowerInput.includes("data") ||
      lowerInput.includes("body")
    )
      return "POST";

    return "GET"; // default
  }

  static extractDuration(input: string): {
    value: number;
    unit: "seconds" | "minutes" | "hours";
  } {
    const patterns = [
      { regex: /(\d+)\s*seconds?/i, unit: "seconds" as const },
      { regex: /(\d+)\s*minutes?/i, unit: "minutes" as const },
      { regex: /(\d+)\s*hours?/i, unit: "hours" as const },
      { regex: /(\d+)\s*secs?/i, unit: "seconds" as const },
      { regex: /(\d+)\s*mins?/i, unit: "minutes" as const },
      { regex: /(\d+)\s*hrs?/i, unit: "hours" as const },
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern.regex);
      if (match) {
        return {
          value: parseInt(match[1]),
          unit: pattern.unit,
        };
      }
    }

    // Default duration
    return { value: 1, unit: "minutes" };
  }

  static extractRequestCount(input: string): number {
    const patterns = [
      /send\s+(\d+)\s+(?:POST|GET|PUT|DELETE|PATCH)\s+requests?/i,
      /(\d+)\s*requests?/i,
      /(\d+)\s*calls?/i,
      /(\d+)\s*times?/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return 1; // default to 1 instead of 100
  }

  static extractRPS(input: string): number | undefined {
    const patterns = [
      /(\d+)\s*rps/i,
      /(\d+)\s*requests?\s*per\s*second/i,
      /(\d+)\s*req\/s/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return undefined;
  }
}

// ============================================================================
// SMART PROMPT BUILDER (Legacy compatibility)
// ============================================================================

export interface SmartPromptBuilder {
  buildPrompt(context: ParseContext): Promise<EnhancedPrompt>;
}

export class DefaultSmartPromptBuilder implements SmartPromptBuilder {
  async buildPrompt(context: ParseContext): Promise<EnhancedPrompt> {
    return PromptBuilder.buildPrompt(context);
  }
}

// ============================================================================
// PROMPT TEMPLATE MANAGER (Legacy compatibility)
// ============================================================================

export class PromptTemplateManager {
  static getSystemPrompt(): string {
    return PromptBuilder.getSystemPrompt();
  }

  static buildPrompt(input: string): string {
    return PromptBuilder.buildFullPrompt(input);
  }
}
