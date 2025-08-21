import {
  LoadTestSpec,
  PayloadSpec,
  ValidationResult,
  K6Script,
  K6Options,
  RequestSpec,
  LoadPattern,
  Duration,
} from "../../types";
import { LoadPatternGenerator } from "./load-pattern-generator";
import {
  ScriptTemplateManager,
  TemplateVariable,
  VariableGenerator,
} from "./script-templates";
import { WorkflowGenerator } from "./workflow-generator";

export interface ScriptGenerator {
  generateScript(spec: LoadTestSpec): K6Script;
  generatePayloadTemplate(payloadSpec: PayloadSpec): PayloadTemplate;
  validateScript(script: K6Script): ValidationResult;
}

export interface PayloadTemplate {
  template: string;
  variables: TemplateVariable[];
  generators: Record<string, VariableGenerator>;
}

export class K6ScriptGenerator implements ScriptGenerator {
  private templateManager: ScriptTemplateManager;
  private workflowGenerator: WorkflowGenerator;

  constructor() {
    this.templateManager = new ScriptTemplateManager();
    this.workflowGenerator = new WorkflowGenerator();
  }

  generateScript(spec: LoadTestSpec): K6Script {
    const template = this.selectTemplate(spec);
    const options = this.generateK6Options(spec.loadPattern, spec.duration);
    const imports = this.generateImports(spec);

    // Generate the main script content
    let scriptContent = template.template;

    // Replace template variables
    scriptContent = this.substituteVariables(scriptContent, spec);

    // Generate request functions (for simple requests) or workflow functions (for complex scenarios)
    if (spec.workflow && spec.workflow.length > 0) {
      const workflowFunctions =
        this.workflowGenerator.generateWorkflowFunctions(spec);
      scriptContent = scriptContent.replace(
        "{{REQUEST_FUNCTIONS}}",
        workflowFunctions
      );

      const workflowMainFunction =
        this.workflowGenerator.generateWorkflowMainFunction(spec);
      scriptContent = scriptContent.replace(
        "{{MAIN_FUNCTION}}",
        workflowMainFunction
      );
    } else {
      const requestFunctions = this.generateRequestFunctions(spec.requests);
      scriptContent = scriptContent.replace(
        "{{REQUEST_FUNCTIONS}}",
        requestFunctions
      );

      // Generate main test function
      const mainFunction = this.generateMainFunction(spec);
      scriptContent = scriptContent.replace("{{MAIN_FUNCTION}}", mainFunction);
    }

    return {
      id: `script_${spec.id}`,
      name: `${spec.name}_script`,
      content: scriptContent,
      imports,
      options,
      metadata: {
        generatedAt: new Date(),
        specId: spec.id,
        version: "1.0.0",
        description: spec.description,
        tags: [spec.testType],
      },
    };
  }

  generatePayloadTemplate(payloadSpec: PayloadSpec): PayloadTemplate {
    const variables: TemplateVariable[] = [];
    const generators: Record<string, VariableGenerator> = {};

    payloadSpec.variables.forEach((varDef) => {
      const placeholder = `{{${varDef.name}}}`;
      variables.push({
        name: varDef.name,
        placeholder,
        type: varDef.type,
        required: true,
      });

      const generator = this.createVariableGenerator(varDef);
      generators[varDef.name] = generator;
    });

    return {
      template: payloadSpec.template,
      variables,
      generators,
    };
  }

  validateScript(script: K6Script): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax validation
    if (!script.content.includes("export default function")) {
      errors.push("Script must contain a default export function");
    }

    if (!script.content.includes("import http from")) {
      warnings.push("Script should import http module for HTTP requests");
    }

    // Validate K6 options
    if (script.options.vus !== undefined && script.options.vus < 1) {
      errors.push("Virtual users must be at least 1");
    }

    if (
      script.options.duration &&
      !this.isValidDuration(script.options.duration)
    ) {
      errors.push("Invalid duration format");
    }

    // Check for common K6 patterns
    if (!script.content.includes("check(")) {
      warnings.push("Consider adding checks for response validation");
    }

    // Validate JavaScript syntax (basic check)
    try {
      // Simple syntax check - look for balanced braces
      const openBraces = (script.content.match(/{/g) || []).length;
      const closeBraces = (script.content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push("Unbalanced braces in script");
      }
    } catch (error) {
      errors.push(`Syntax error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private selectTemplate(spec: LoadTestSpec) {
    // Select template based on test type and complexity
    if (spec.loadPattern.type === "ramp-up" || spec.loadPattern.stages) {
      return this.templateManager.getTemplate("load_test")!;
    }
    return this.templateManager.getTemplate("basic_http")!;
  }

  private generateK6Options(
    loadPattern: LoadPattern,
    duration: Duration
  ): K6Options {
    const options: K6Options = {};
    const patternGenerator = new LoadPatternGenerator();

    // Use load pattern generator for complex stage generation
    if (loadPattern.type !== "constant" || loadPattern.stages) {
      // Generate stages based on pattern type
      const stages: Array<{ duration: string; target: number }> = [];

      if (loadPattern.rampUpTime) {
        stages.push({
          duration: `${loadPattern.rampUpTime.value}s`,
          target: loadPattern.virtualUsers || 10,
        });
      }

      if (loadPattern.plateauTime) {
        stages.push({
          duration: `${loadPattern.plateauTime.value}s`,
          target: loadPattern.virtualUsers || 10,
        });
      }

      stages.push({
        duration: "10s",
        target: 0,
      });

      if (stages.length > 0) {
        options.stages = stages;
      }
    } else {
      // Simple constant load
      if (loadPattern.virtualUsers) {
        options.vus = loadPattern.virtualUsers;
      }

      if (duration) {
        options.duration = this.formatDuration(duration);
      }
    }

    // Add RPS if specified
    if (loadPattern.requestsPerSecond) {
      options.rps = loadPattern.requestsPerSecond;
    }

    // Add default thresholds
    options.thresholds = {
      http_req_duration: ["p(95)<500"],
      http_req_failed: ["rate<0.1"],
      errors: ["rate<0.1"],
    };

    return options;
  }

  private generateImports(spec: LoadTestSpec): string[] {
    const imports = [
      "import http from 'k6/http';",
      "import { check, sleep } from 'k6';",
      "import { Rate, Trend } from 'k6/metrics';",
    ];

    // Add additional imports based on spec requirements
    if (spec.requests.some((req) => req.payload)) {
      // No additional imports needed for basic payloads
    }

    return imports;
  }

  private generateRequestFunctions(requests: RequestSpec[]): string {
    return requests
      .map((request, index) => {
        const functionName = `makeRequest${index + 1}`;
        const method = request.method.toLowerCase();

        let payloadCode = "";
        if (request.payload) {
          payloadCode = this.generatePayloadCode(request.payload);
        }

        let headersCode = "";
        if (request.headers) {
          headersCode = `
    const headers = ${JSON.stringify(request.headers, null, 4)};`;
        }

        let validationCode = "";
        if (request.validation && request.validation.length > 0) {
          validationCode = this.generateValidationCode(request.validation);
        }

        return `
function ${functionName}() {${headersCode}${payloadCode}
    
    const response = http.${method}('${request.url}'${
          request.payload ? ", payload" : ""
        }${request.headers ? ", { headers }" : ""});
    
    ${validationCode}
    
    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    
    return response;
}`;
      })
      .join("\n");
  }

  private generatePayloadCode(payloadSpec: PayloadSpec): string {
    const payloadTemplate = this.generatePayloadTemplate(payloadSpec);

    let generatorCode = "";
    Object.entries(payloadTemplate.generators).forEach(([name, generator]) => {
      generatorCode += `
    const ${name} = ${this.generateVariableCode(generator)};`;
    });

    let templateCode = payloadSpec.template;
    payloadTemplate.variables.forEach((variable) => {
      templateCode = templateCode.replace(
        variable.placeholder,
        `\${${variable.name}}`
      );
    });

    return `${generatorCode}
    
    const payload = \`${templateCode}\`;`;
  }

  private generateVariableCode(generator: VariableGenerator): string {
    return this.templateManager.generateVariableCode(generator);
  }

  private generateValidationCode(validations: any[]): string {
    const checks = validations
      .map((validation) => {
        switch (validation.type) {
          case "status_code":
            return `'status is ${validation.expectedValue}': (r) => r.status === ${validation.expectedValue}`;
          case "response_time":
            return `'response time < ${validation.expectedValue}ms': (r) => r.timings.duration < ${validation.expectedValue}`;
          case "content":
            return `'response contains "${validation.expectedValue}"': (r) => r.body.includes('${validation.expectedValue}')`;
          default:
            return `'validation passed': (r) => true`;
        }
      })
      .join(",\n        ");

    return `
    check(response, {
        ${checks}
    });`;
  }

  private generateMainFunction(spec: LoadTestSpec): string {
    const requestCalls = spec.requests
      .map((_, index) => `    makeRequest${index + 1}();`)
      .join("\n");

    return `${requestCalls}
    
    sleep(1);`;
  }

  private createVariableGenerator(varDef: any): VariableGenerator {
    return this.templateManager.createVariableGenerator(varDef);
  }

  private formatDuration(duration: Duration): string {
    const unit =
      duration.unit === "seconds"
        ? "s"
        : duration.unit === "minutes"
        ? "m"
        : "h";
    return `${duration.value}${unit}`;
  }

  private isValidDuration(duration: string): boolean {
    return /^\d+[smh]$/.test(duration);
  }

  private substituteVariables(
    scriptContent: string,
    spec: LoadTestSpec
  ): string {
    // This method can be used for any additional template variable substitution
    // Currently, the main substitutions are handled in generateScript method
    return scriptContent;
  }

  // Workflow-related methods moved to workflow-generator.ts

  private convertDurationToSeconds(duration: Duration): number {
    switch (duration.unit) {
      case "seconds":
        return duration.value;
      case "minutes":
        return duration.value * 60;
      case "hours":
        return duration.value * 3600;
      default:
        return duration.value;
    }
  }
}
