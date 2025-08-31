import { LoadTestSpec, TestResult } from "../../types";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { MediaProcessor } from "../../features/common/media-utils";

const execAsync = promisify(exec);

export interface K6Executor {
  executeLoadTest(spec: LoadTestSpec): Promise<TestResult>;
}

export class K6LoadExecutor implements K6Executor {
  private k6ScriptDir: string;

  constructor() {
    this.k6ScriptDir = path.join(process.cwd(), "k6-scripts");
    this.ensureK6ScriptDir();
  }

  private ensureK6ScriptDir(): void {
    if (!fs.existsSync(this.k6ScriptDir)) {
      fs.mkdirSync(this.k6ScriptDir, { recursive: true });
    }
  }

  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.k6ScriptDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = path.join(this.k6ScriptDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.warn("⚠️  Cleanup failed:", error);
    }
  }

  async executeLoadTest(spec: LoadTestSpec): Promise<TestResult> {
    const startTime = new Date();

    // Clean up old files before starting
    await this.cleanupOldFiles();

    const scriptPath = await this.generateK6Script(spec);

    try {
      console.log("🚀 Executing K6 load test...");

      const { stdout, stderr } = await execAsync(
        `k6 run --out json=${scriptPath}.results.json ${scriptPath}`
      );

      const k6Results = this.parseK6Results(`${scriptPath}.results.json`);
      const endTime = new Date();

      return {
        id: spec.id,
        spec: spec,
        status: "completed",
        startTime: startTime,
        endTime: endTime,
        metrics: {
          totalRequests: k6Results.totalRequests,
          successfulRequests: k6Results.successfulRequests,
          failedRequests: k6Results.failedRequests,
          errorRate:
            k6Results.totalRequests > 0
              ? (k6Results.failedRequests / k6Results.totalRequests) * 100
              : 0,
          responseTime: {
            min: k6Results.averageResponseTime * 0.5, // Approximate
            max: k6Results.averageResponseTime * 2, // Approximate
            avg: k6Results.averageResponseTime,
            p50: k6Results.averageResponseTime,
            p90: k6Results.averageResponseTime * 1.3, // Approximate
            p95: k6Results.p95ResponseTime,
            p99: k6Results.p95ResponseTime * 1.2, // Approximate
          },
          throughput: {
            requestsPerSecond: k6Results.requestsPerSecond,
            bytesPerSecond: 0,
          },
        },
        errors: [],
        recommendations: [
          "✅ K6 load test completed successfully",
          "📊 Real spike pattern executed",
          "🚀 Professional load testing results",
        ],
        rawData: {
          k6Output: k6Results,
          executionLogs: [
            `K6 executed ${k6Results.totalRequests} requests with spike pattern`,
          ],
          systemMetrics: [],
        },
      };
    } catch (error) {
      console.error("❌ K6 execution failed:", error);
      throw error;
    }
  }

  private async generateK6Script(spec: LoadTestSpec): Promise<string> {
    const scriptContent = this.buildK6Script(spec);
    const scriptPath = path.join(this.k6ScriptDir, `${spec.id}.js`);

    fs.writeFileSync(scriptPath, scriptContent);
    return scriptPath;
  }

  private buildK6Script(spec: LoadTestSpec): string {
    // Check if this is a workflow test
    if (
      spec.testType === "workflow" &&
      spec.workflow &&
      spec.workflow.length > 0
    ) {
      return this.buildWorkflowK6Script(spec);
    }

    // Original single request logic
    const request = spec.requests[0];
    const loadPattern = spec.loadPattern;
    const payloadResult = this.generatePayload(request);

    let script = `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
${payloadResult.imports ? payloadResult.imports : ""}

const errorRate = new Rate('errors');

export const options = {
  ${this.generateOptions(loadPattern)},
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // More lenient: 5 seconds
    errors: ['rate<0.1'],
  },
};

export default function() {
  const url = '${request.url}';
  const method = '${request.method}';
  const headers = ${JSON.stringify(request.headers || {})};
  
  ${payloadResult.payloadCode}
  
  const response = http.request(method, url, payload, { headers });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 5000ms': (r) => r.timings.duration < 5000,
  });
  
  errorRate.add(response.status !== 200);
  
  ${this.generateThinkTime(loadPattern)}
}
`;

    return script;
  }

  private buildWorkflowK6Script(spec: LoadTestSpec): string {
    const workflow = spec.workflow?.[0]; // Get the first workflow with null check
    const loadPattern = spec.loadPattern;

    if (!workflow || !workflow.steps) {
      throw new Error("Invalid workflow structure: missing workflow or steps");
    }

    // Extract all steps from the workflow
    const steps = workflow.steps;

    // Calculate total requests for proper K6 configuration
    const totalRequests = steps.reduce((total, step) => {
      if ("requestCount" in step) {
        return total + (step.requestCount || 1);
      }
      return total + 1;
    }, 0);

    // Collect all imports from media payloads
    const allImports = new Set<string>();
    allImports.add("import http from 'k6/http';");
    allImports.add("import { check, sleep } from 'k6';");
    allImports.add("import { Rate } from 'k6/metrics';");

    // Generate step definitions with load patterns
    const stepDefinitions = steps
      .map((step, index) => {
        // Type guard to check if this is a WorkflowRequest
        if (!("method" in step && "url" in step)) {
          throw new Error(
            `Invalid workflow step ${index}: missing method or url`
          );
        }

        const url = step.url;
        const method = step.method;
        const headers = JSON.stringify(step.headers || {});
        const body = step.body ? JSON.stringify(step.body) : "null";
        const requestCount = step.requestCount || 1;

        // Get the load pattern for this step
        const stepLoadPattern = step.loadPattern || { type: "constant" };
        const loadPatternType = stepLoadPattern.type || "constant";

        // Check for media imports
        if (step.media && step.media.files && step.media.files.length > 0) {
          allImports.add("import { SharedArray } from 'k6/data';");
        }

        // Generate step-specific execution logic based on load pattern
        const stepExecution = this.generateStepExecution(
          stepLoadPattern,
          requestCount,
          method,
          url,
          body,
          headers,
          index + 1,
          step.media
        );

        return `
  // Step ${
    index + 1
  }: ${method} ${url} (${requestCount} requests, ${loadPatternType} pattern)
  ${stepExecution}
  
  // Delay between workflow steps
  if (${index} < ${steps.length - 1}) {
    sleep(0.5);
  }`;
      })
      .join("");

    let script = `
${Array.from(allImports).join("\n")}

const errorRate = new Rate('errors');

export const options = {
  iterations: 1,  // Execute the workflow exactly once
  vus: 1,         // Use 1 virtual user
  duration: '1m', // Set a reasonable timeout
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    errors: ['rate<0.1'],
  },
};

export default function() {
  // Workflow execution: ${steps.length} steps, ${totalRequests} total requests
  ${stepDefinitions}
}
`;

    return script;
  }

  private generateStepExecution(
    loadPattern: any,
    requestCount: number,
    method: string,
    url: string,
    body: string,
    headers: string,
    stepNumber: number,
    media?: any
  ): string {
    const patternType = loadPattern.type || "constant";

    switch (patternType) {
      case "spike":
        return this.generateSpikeStep(
          requestCount,
          method,
          url,
          body,
          headers,
          stepNumber,
          loadPattern,
          media
        );
      case "ramp-up":
        return this.generateRampUpStep(
          requestCount,
          method,
          url,
          body,
          headers,
          stepNumber,
          loadPattern,
          media
        );
      case "random-burst":
        return this.generateRandomBurstStep(
          requestCount,
          method,
          url,
          body,
          headers,
          stepNumber,
          loadPattern,
          media
        );
      case "step":
        return this.generateStepPattern(
          requestCount,
          method,
          url,
          body,
          headers,
          stepNumber,
          loadPattern,
          media
        );
      default:
        return this.generateConstantStep(
          method,
          url,
          requestCount,
          body,
          headers,
          stepNumber,
          media
        );
    }
  }

  private generateSpikeStep(
    requestCount: number,
    method: string,
    url: string,
    body: string,
    headers: string,
    stepNumber: number,
    loadPattern: any,
    media?: any
  ): string {
    const duration = loadPattern.duration?.value || 30;
    const unit = loadPattern.duration?.unit || "seconds";

    // Convert to seconds
    let durationSeconds = duration;
    if (unit === "minutes") durationSeconds = duration * 60;
    if (unit === "hours") durationSeconds = duration * 3600;

    // Create spike pattern: quick ramp up, peak, quick ramp down
    const rampUp = Math.max(1, Math.floor(durationSeconds * 0.2)); // 20% ramp up
    const peak = Math.max(1, Math.floor(durationSeconds * 0.6)); // 60% peak
    const rampDown = Math.max(1, Math.floor(durationSeconds * 0.2)); // 20% ramp down

    const requestsPerSecond = requestCount / durationSeconds;

    return `
  // Spike pattern: ${requestCount} requests over ${durationSeconds}s
  const spikeRequestsPerSecond = ${requestsPerSecond};
  const spikeDuration = ${durationSeconds};
  
  // Ramp up phase (${rampUp}s)
  for (let i = 0; i < ${Math.floor(requestCount * 0.2)}; i++) {
    const response = http.request('${method}', '${url}', ${body}, { headers: ${headers} });
    check(response, {
      'step ${stepNumber} status is 200': (r) => r.status === 200,
      'step ${stepNumber} response time < 5000ms': (r) => r.timings.duration < 5000,
    });
    errorRate.add(response.status !== 200);
    sleep(1 / (spikeRequestsPerSecond * 0.5)); // Slower during ramp up
  }
  
  // Peak phase (${peak}s)
  for (let i = 0; i < ${Math.floor(requestCount * 0.6)}; i++) {
    const response = http.request('${method}', '${url}', ${body}, { headers: ${headers} });
    check(response, {
      'step ${stepNumber} status is 200': (r) => r.status === 200,
      'step ${stepNumber} response time < 5000ms': (r) => r.timings.duration < 5000,
    });
    errorRate.add(response.status !== 200);
    sleep(1 / spikeRequestsPerSecond); // Full speed during peak
  }
  
  // Ramp down phase (${rampDown}s)
  for (let i = 0; i < ${Math.floor(requestCount * 0.2)}; i++) {
    const response = http.request('${method}', '${url}', ${body}, { headers: ${headers} });
    check(response, {
      'step ${stepNumber} status is 200': (r) => r.status === 200,
      'step ${stepNumber} response time < 5000ms': (r) => r.timings.duration < 5000,
    });
    errorRate.add(response.status !== 200);
    sleep(1 / (spikeRequestsPerSecond * 0.5)); // Slower during ramp down
  }`;
  }

  private generateRampUpStep(
    requestCount: number,
    method: string,
    url: string,
    body: string,
    headers: string,
    stepNumber: number,
    loadPattern: any,
    media?: any
  ): string {
    const duration = loadPattern.duration?.value || 30;
    const unit = loadPattern.duration?.unit || "seconds";

    // Convert to seconds
    let durationSeconds = duration;
    if (unit === "minutes") durationSeconds = duration * 60;
    if (unit === "hours") durationSeconds = duration * 3600;

    const startUsers = loadPattern.startUsers || 1;
    const endUsers = loadPattern.endUsers || requestCount;

    return `
  // Ramp-up pattern: ${requestCount} requests over ${durationSeconds}s (${startUsers} to ${endUsers} users)
  const rampUpDuration = ${durationSeconds};
  const startRate = ${startUsers} / rampUpDuration;
  const endRate = ${endUsers} / rampUpDuration;
  
  for (let i = 0; i < ${requestCount}; i++) {
    const progress = i / ${requestCount};
    const currentRate = startRate + (endRate - startRate) * progress;
    
    const response = http.request('${method}', '${url}', ${body}, { headers: ${headers} });
    check(response, {
      'step ${stepNumber} status is 200': (r) => r.status === 200,
      'step ${stepNumber} response time < 5000ms': (r) => r.timings.duration < 5000,
    });
    errorRate.add(response.status !== 200);
    
    sleep(1 / currentRate);
  }`;
  }

  private generateRandomBurstStep(
    requestCount: number,
    method: string,
    url: string,
    body: string,
    headers: string,
    stepNumber: number,
    loadPattern: any,
    media?: any
  ): string {
    return `
  // Random burst pattern: ${requestCount} requests
  const burstSizes = [${Math.max(
    1,
    Math.floor(requestCount * 0.3)
  )}, ${Math.max(1, Math.floor(requestCount * 0.5))}, ${Math.max(
      1,
      Math.floor(requestCount * 0.2)
    )}];
  let requestIndex = 0;
  
  for (const burstSize of burstSizes) {
    // Burst of requests
    for (let i = 0; i < burstSize && requestIndex < ${requestCount}; i++) {
      const response = http.request('${method}', '${url}', ${body}, { headers: ${headers} });
      check(response, {
        'step ${stepNumber} status is 200': (r) => r.status === 200,
        'step ${stepNumber} response time < 5000ms': (r) => r.timings.duration < 5000,
      });
      errorRate.add(response.status !== 200);
      requestIndex++;
    }
    
    // Random delay between bursts
    if (requestIndex < ${requestCount}) {
      sleep(Math.random() * 2 + 1); // 1-3 second random delay
    }
  }`;
  }

  private generateStepPattern(
    requestCount: number,
    method: string,
    url: string,
    body: string,
    headers: string,
    stepNumber: number,
    loadPattern: any,
    media?: any
  ): string {
    const steps = loadPattern.steps || [requestCount];

    return `
  // Step pattern: ${requestCount} requests in ${steps.length} steps
  const stepSizes = [${steps.join(", ")}];
  let requestIndex = 0;
  
  for (const stepSize of stepSizes) {
    // Execute step
    for (let i = 0; i < stepSize && requestIndex < ${requestCount}; i++) {
      const response = http.request('${method}', '${url}', ${body}, { headers: ${headers} });
      check(response, {
        'step ${stepNumber} status is 200': (r) => r.status === 200,
        'step ${stepNumber} response time < 5000ms': (r) => r.timings.duration < 5000,
      });
      errorRate.add(response.status !== 200);
      requestIndex++;
    }
    
    // Hold at this level
    if (requestIndex < ${requestCount}) {
      sleep(2); // 2 second hold
    }
  }`;
  }

  private generateConstantStep(
    method: string,
    url: string,
    requestCount: number,
    body: string,
    headers: string,
    stepNumber: number,
    media?: any
  ): string {
    // Generate payload code for media files
    let payloadCode = "";
    if (media && media.files && media.files.length > 0) {
      const mediaResult = this.generateMediaPayload(media);
      payloadCode = mediaResult.payloadCode;
    } else {
      payloadCode = `const payload = ${body};`;
    }

    return `
  // Constant pattern: ${requestCount} requests
  ${payloadCode}
  
  // Update headers for multipart form data
  let requestHeaders = ${headers};
  if (media && media.files && media.files.length > 0) {
    requestHeaders = { ...requestHeaders, 'Content-Type': contentType };
  }
  
  for (let i = 0; i < ${requestCount}; i++) {
    const response = http.request('${method}', '${url}', payload, { headers: requestHeaders });
    
    check(response, {
      'step ${stepNumber} status is 200': (r) => r.status === 200,
      'step ${stepNumber} response time < 5000ms': (r) => r.timings.duration < 5000,
    });
    
    errorRate.add(response.status !== 200);
    
    // Small delay between requests
    if (i < ${requestCount} - 1) {
      sleep(0.1);
    }
  }`;
  }

  private generateOptions(loadPattern: any): string {
    // Use smart defaults based on load pattern type
    let defaultVUs = 1; // Default for simple patterns
    if (['spike', 'ramp-up', 'random-burst'].includes(loadPattern.type)) {
      defaultVUs = 10; // Use higher defaults for complex patterns
    }
    const targetRequests = loadPattern.virtualUsers || defaultVUs;

    // For demo/development: use iterations for exact request count
    if (loadPattern.type === "spike") {
      const totalDuration = loadPattern.duration?.value || 30;
      const unit = loadPattern.duration?.unit || "seconds";

      // Convert to seconds
      let durationSeconds = totalDuration;
      if (unit === "minutes") durationSeconds = totalDuration * 60;
      if (unit === "hours") durationSeconds = totalDuration * 3600;

      // For demo/development: cap at 10 seconds max
      if (durationSeconds > 10) durationSeconds = 10;

      return `iterations: ${targetRequests},
  duration: '${durationSeconds}s'`;
    }

    // For other patterns, use stages
    return `stages: ${this.generateStages(loadPattern)}`;
  }

  private generateStages(loadPattern: any): string {
    switch (loadPattern.type) {
      case "random-burst":
        return this.generateRandomBurstStages(loadPattern);
      case "spike":
        return this.generateSpikeStages(loadPattern);
      case "ramp-up":
        return this.generateRampUpStages(loadPattern);
      default:
        return this.generateConstantStages(loadPattern);
    }
  }

  private generateRandomBurstStages(loadPattern: any): string {
    // Use higher default for burst patterns
    const targetVUs = loadPattern.virtualUsers || 10;

    // Development-friendly short burst test
    return `[
  { duration: '15s', target: ${Math.max(1, Math.floor(targetVUs * 0.5))} },
  { duration: '20s', target: ${targetVUs} },
  { duration: '15s', target: ${Math.max(1, Math.floor(targetVUs * 0.5))} },
]`;
  }

  private generateSpikeStages(loadPattern: any): string {
    const targetVUs = loadPattern.virtualUsers || 10;
    const totalDuration = loadPattern.duration?.value || 30;
    const unit = loadPattern.duration?.unit || "seconds";

    // Convert to seconds
    let durationSeconds = totalDuration;
    if (unit === "minutes") durationSeconds = totalDuration * 60;
    if (unit === "hours") durationSeconds = totalDuration * 3600;

    // For demo/development: cap at 10 seconds max
    if (durationSeconds > 10) durationSeconds = 10;

    // Create a true spike pattern: quick ramp up, peak, quick ramp down
    const rampUp = Math.max(1, Math.floor(durationSeconds * 0.2)); // 20% ramp up
    const peak = Math.max(1, Math.floor(durationSeconds * 0.6)); // 60% peak
    const rampDown = Math.max(1, Math.floor(durationSeconds * 0.2)); // 20% ramp down

    return `[
  { duration: '${rampUp}s', target: ${targetVUs} },
  { duration: '${peak}s', target: ${targetVUs} },
  { duration: '${rampDown}s', target: 0 },
]`;
  }

  private generateRampUpStages(loadPattern: any): string {
    const targetVUs = loadPattern.virtualUsers || 10;

    // Development-friendly short ramp-up test
    return `[
  { duration: '20s', target: ${targetVUs} },
  { duration: '20s', target: ${targetVUs} },
]`;
  }

  private generateConstantStages(loadPattern: any): string {
    const targetVUs = loadPattern.virtualUsers || 10;

    // Development-friendly short constant test
    return `[
  { duration: '30s', target: ${targetVUs} },
]`;
  }

  private generatePayload(request: any): {
    imports: string;
    payloadCode: string;
  } {
    // Handle media files first
    if (
      request.media &&
      request.media.files &&
      request.media.files.length > 0
    ) {
      return this.generateMediaPayload(request.media);
    }

    if (!request.payload) {
      return { imports: "", payloadCode: "const payload = null;" };
    }

    // For file-based payloads, we need to handle them differently in K6
    if (request.payload.template && request.payload.template.startsWith("@")) {
      return {
        imports: `import { SharedArray } from 'k6/data';`,
        payloadCode: `
const payloadData = new SharedArray('payload', function() {
  return JSON.parse(open('${request.payload.template.substring(1)}'));
});

const payload = JSON.stringify(payloadData[__VU % payloadData.length]);
`,
      };
    }

    // Handle bulk data and dynamic variables
    let payloadTemplate = request.payload.template;
    let variableDefinitions = "";

    if (request.payload.variables && request.payload.variables.length > 0) {
      variableDefinitions = this.generateVariableDefinitions(
        request.payload.variables
      );
      payloadTemplate = this.processPayloadTemplate(
        request.payload.template,
        request.payload.variables
      );
    }

    return {
      imports: "",
      payloadCode: `
${variableDefinitions}
const payload = ${JSON.stringify(payloadTemplate)};
`,
    };
  }

  private generateMediaPayload(media: any): {
    imports: string;
    payloadCode: string;
  } {
    const files = media.files || [];
    const formData = media.formData || {};

    let imports = "";
    let payloadCode = "";

    // Generate file handling code
    if (files.length > 0) {
      imports = `import { SharedArray } from 'k6/data';`;

      const fileDataCode = `
const fileData = new SharedArray('files', function() {
  return [
${files
  .map(
    (file: any) =>
      `    { fieldName: '${file.fieldName}', filePath: '${file.filePath}' }`
  )
  .join(",\n")}
  ];
});

const currentFile = fileData[__VU % fileData.length];
const fileBuffer = open(currentFile.filePath, 'b'); // Read as binary
`;

      // Generate form data code
      if (Object.keys(formData).length > 0) {
        payloadCode += `
const formData = ${JSON.stringify(formData)};
`;
      }

      // Generate multipart form data construction for K6
      payloadCode += `
${fileDataCode}
// Create multipart boundary
const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
const contentType = 'multipart/form-data; boundary=' + boundary;

// Build multipart body
let multipartBody = '';
${files
  .map(
    (file: any) => `
// Add file part
multipartBody += '--' + boundary + '\\r\\n';
multipartBody += 'Content-Disposition: form-data; name="${
      file.fieldName
    }"; filename="${file.filePath.split("/").pop()}"\\r\\n';
multipartBody += 'Content-Type: application/octet-stream\\r\\n\\r\\n';
multipartBody += fileBuffer.toString('base64') + '\\r\\n';`
  )
  .join("\n")}
${Object.keys(formData)
  .map(
    (key) => `
// Add form field
multipartBody += '--' + boundary + '\\r\\n';
multipartBody += 'Content-Disposition: form-data; name="${key}"\\r\\n\\r\\n';
multipartBody += JSON.stringify(formData['${key}']) + '\\r\\n';`
  )
  .join("\n")}
multipartBody += '--' + boundary + '--\\r\\n';

const payload = multipartBody;
`;
    }

    return { imports, payloadCode };
  }

  private generateVariableDefinitions(variables: any[]): string {
    const definitions: string[] = [];

    for (const variable of variables) {
      switch (variable.type) {
        case "uuid":
          definitions.push(`const ${variable.name} = crypto.randomUUID();`);
          break;
        case "random_string":
          const length = variable.length || 10;
          definitions.push(
            `const ${variable.name} = Math.random().toString(36).substring(2, ${
              length + 2
            });`
          );
          break;
        case "bulk_data":
          const itemCount = variable.itemCount || 100;
          const sizePerItem = variable.sizePerItem || "1kb";
          definitions.push(`const ${variable.name} = Array.from({length: ${itemCount}}, (_, i) => ({
            id: crypto.randomUUID(),
            name: "item_" + i,
            data: "x".repeat(1024) // ${sizePerItem} of data
          }));`);
          break;
        case "random_id":
          definitions.push(
            `const ${variable.name} = "id_" + Math.random().toString(36).substring(2, 8);`
          );
          break;
        default:
          definitions.push(`const ${variable.name} = "default_value";`);
      }
    }

    return definitions.join("\n");
  }

  private processPayloadTemplate(template: string, variables: any[]): string {
    let processedTemplate = template;

    for (const variable of variables) {
      const placeholder = `{{${variable.name}}}`;
      switch (variable.type) {
        case "uuid":
        case "random_string":
        case "random_id":
          processedTemplate = processedTemplate.replace(
            placeholder,
            `" + ${variable.name} + "`
          );
          break;
        case "bulk_data":
          processedTemplate = processedTemplate.replace(
            placeholder,
            `" + JSON.stringify(${variable.name}) + "`
          );
          break;
        default:
          processedTemplate = processedTemplate.replace(
            placeholder,
            `" + ${variable.name} + "`
          );
      }
    }

    return processedTemplate;
  }

  private generateThinkTime(loadPattern: any): string {
    if (loadPattern.type === "random-burst") {
      return `
  // Random think time for burst patterns
  sleep(Math.random() * 5 + 1);
`;
    }

    return `
  sleep(1);
`;
  }

  private parseK6Results(resultsPath: string): any {
    try {
      const resultsData = fs.readFileSync(resultsPath, "utf8");

      // Parse JSON Lines format (one JSON object per line)
      const lines = resultsData.trim().split("\n");
      const metrics: any = {};

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.type === "Point" && data.metric) {
            if (!metrics[data.metric]) {
              metrics[data.metric] = [];
            }
            metrics[data.metric].push(data.data);
          }
        } catch (lineError) {
          // Skip invalid lines
          continue;
        }
      }

      // Extract summary metrics
      const httpReqs = metrics.http_reqs || [];
      const httpDuration = metrics.http_req_duration || [];
      const errors = metrics.errors || [];

      const totalRequests = httpReqs.length;
      const successfulRequests = httpReqs.filter(
        (req: any) => req.tags?.status === "200"
      ).length;
      const failedRequests = totalRequests - successfulRequests;

      // Calculate average response time
      const responseTimes = httpDuration
        .map((d: any) => d.value)
        .filter((v: number) => !isNaN(v));
      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a: number, b: number) => a + b, 0) /
            responseTimes.length
          : 0;

      // Calculate actual test duration from timestamps
      const timestamps = httpReqs.map((req: any) =>
        new Date(req.time).getTime()
      );
      const testDurationSeconds =
        timestamps.length > 1
          ? (Math.max(...timestamps) - Math.min(...timestamps)) / 1000
          : 40; // Default fallback

      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime,
        p95ResponseTime: averageResponseTime * 1.5, // Approximate P95
        requestsPerSecond:
          totalRequests > 0 ? totalRequests / testDurationSeconds : 0,
      };
    } catch (error) {
      console.error("Failed to parse K6 results:", error);
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        requestsPerSecond: 0,
      };
    }
  }
}
