import {
  HttpMethod,
  TestType,
  LoadPatternType,
  VariableType,
  Duration,
} from "./common";

export interface LoadTestSpec {
  id: string;
  name: string;
  description: string;
  testType: TestType;

  requests: RequestSpec[];
  workflow?: WorkflowStep[];
  batch?: BatchTestSpec; // New: Batch testing support
  loadPattern: LoadPattern;
  duration?: Duration; // Optional - if not specified, execute immediately

  // For multi-step scenarios
  dataCorrelation?: CorrelationRule[];
}

// Enhanced: Batch test specification
export interface BatchTestSpec {
  id: string;
  name: string;
  description: string;
  tests: BatchTestItem[];
  executionMode: "parallel" | "sequential";
  aggregationMode: "combined" | "separate";
  globalLoadPattern?: LoadPattern; // Optional global load pattern
  globalDuration?: Duration; // Optional global duration

  // Enhanced features
  executionOptions?: {
    parallelConcurrency?: number; // Max concurrent tests (for parallel mode)
    sequentialDelay?: Duration; // Delay between sequential tests
    retryFailedTests?: boolean; // Retry failed tests
    maxRetries?: number; // Maximum retry attempts
  };

  // Dynamic payload configuration
  dynamicPayloads?: {
    enabled: boolean;
    incrementStrategy: "linear" | "exponential" | "random";
    baseValues: Record<string, any>; // Base values for dynamic fields
    incrementRules: DynamicIncrementRule[];
  };

  // K6 specific configuration
  k6Config?: {
    generateSeparateScripts: boolean; // Generate separate K6 script for each test
    scriptOutputDir?: string; // Directory for K6 scripts
    customK6Options?: Record<string, any>; // Custom K6 options
  };

  // Reporting configuration
  reporting?: {
    generateIndividualReports: boolean; // Generate individual test reports
    combinedReportFormat: "html" | "json" | "csv" | "all";
    includeRawData: boolean; // Include raw response data in reports
    customMetrics?: string[]; // Custom metrics to track
  };
}

// Enhanced: Individual batch test item
export interface BatchTestItem {
  id: string;
  name: string;
  description: string;
  testType: TestType;
  requests: RequestSpec[];
  workflow?: WorkflowStep[];
  loadPattern?: LoadPattern; // Per-test load pattern (overrides global)
  duration?: Duration; // Per-test duration (overrides global)
  weight?: number; // Relative weight for resource allocation (1-100)
  priority?: "high" | "medium" | "low"; // Execution priority

  // Enhanced features
  executionOrder?: number; // Order for sequential execution
  dependencies?: string[]; // Test IDs this test depends on

  // Dynamic payload overrides
  dynamicPayloadOverrides?: {
    enabled: boolean;
    customIncrements?: Record<string, DynamicIncrementRule>;
    payloadVariables?: Record<string, any>; // Test-specific payload variables
  };

  // K6 specific overrides
  k6Overrides?: {
    customScript?: string; // Custom K6 script content
    customOptions?: Record<string, any>; // Custom K6 options for this test
  };

  // Validation and assertions
  assertions?: BatchTestAssertion[];
  expectedResults?: {
    minSuccessRate: number;
    maxResponseTime: number;
    expectedThroughput: number;
  };
}

// New: Dynamic increment rule for payload values
export interface DynamicIncrementRule {
  fieldPath: string; // JSON path to the field (e.g., "user.id", "data.items[0].value")
  incrementType: "number" | "string" | "uuid" | "timestamp" | "random";
  startValue?: any; // Starting value
  incrementValue?: any; // Value to increment by
  maxValue?: any; // Maximum value (for number types)
  format?: string; // Format string (for timestamp, string types)
  randomRange?: {
    min: any;
    max: any;
  }; // Range for random values
}

// New: Batch test assertion
export interface BatchTestAssertion {
  name: string;
  type:
    | "response_time"
    | "success_rate"
    | "throughput"
    | "error_rate"
    | "custom";
  condition:
    | "less_than"
    | "greater_than"
    | "equals"
    | "not_equals"
    | "contains";
  expectedValue: any;
  tolerance?: number; // Tolerance for numeric comparisons
  customExpression?: string; // Custom assertion expression
}

export interface RequestSpec {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  payload?: PayloadSpec;
  media?: MediaSpec; // Media files for upload
  validation?: ResponseValidation[];
}

export interface LoadPattern {
  type: LoadPatternType;
  virtualUsers?: number;
  requestsPerSecond?: number;
  rampUpTime?: Duration;
  plateauTime?: Duration;
  rampDownTime?: Duration;

  // Spike testing specific
  baselineVUs?: number;
  spikeIntensity?: number;

  // Volume testing specific
  volumeTarget?: number;

  // Random burst testing specific
  burstConfig?: {
    minBurstSize: number;
    maxBurstSize: number;
    minIntervalSeconds: number;
    maxIntervalSeconds: number;
    burstProbability: number; // 0-1, probability of burst occurring
  };

  // K6 stages for complex patterns
  stages?: Array<{
    duration: string;
    target: number;
  }>;
}

export interface PayloadSpec {
  template: string;
  variables: VariableDefinition[];
}

export interface VariableDefinition {
  name: string;
  type: VariableType;
  parameters?: Record<string, any>;
}

export interface WorkflowStep {
  id?: string;
  name?: string;
  type: "sequential" | "parallel";
  steps: (WorkflowRequest | WorkflowStep)[];
  thinkTime?: Duration;
  conditions?: StepCondition[];
}

export interface WorkflowRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  payload?: PayloadSpec;
  media?: MediaSpec; // Media files for upload
  validation?: ResponseValidation[];
  extractData?: string[];
  useData?: Record<string, string>;
  requestCount?: number;
  loadPattern?: LoadPattern; // Per-step load pattern
}

export interface CorrelationRule {
  sourceStep: string;
  sourceField: string;
  targetStep: string;
  targetField: string;
}

export interface ResponseValidation {
  type: "status_code" | "response_time" | "content" | "header";
  condition: string;
  expectedValue: any;
}

export interface StepCondition {
  type: "response_code" | "response_content" | "response_time";
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value: any;
  action: "continue" | "skip" | "fail";
}

export interface DataExtraction {
  name: string;
  source: "response_body" | "response_header" | "status_code";
  extractor: "json_path" | "regex" | "xpath";
  expression: string;
}

export interface MediaSpec {
  files?: MediaFile[];
  formData?: Record<string, any>; // Additional form fields
  contentType?: "multipart/form-data" | "application/octet-stream";
}

export interface MediaFile {
  fieldName: string; // Form field name (e.g., "file", "avatar", "document")
  filePath: string; // Path to the file
  fileName?: string; // Optional custom filename
  mimeType?: string; // Optional MIME type override
}
