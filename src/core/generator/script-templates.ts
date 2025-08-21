import { VariableDefinition } from "../../types";

export interface TemplateVariable {
  name: string;
  placeholder: string;
  type: string;
  required: boolean;
}

export interface VariableGenerator {
  type: string;
  config: Record<string, any>;
  generate(): any;
}

export interface ScriptTemplate {
  name: string;
  description: string;
  template: string;
  requiredVariables: string[];
  optionalVariables: string[];
}

export class ScriptTemplateManager {
  private templates: Map<string, ScriptTemplate> = new Map();
  private variableGenerators: Map<string, VariableGenerator> = new Map();

  constructor() {
    this.initializeTemplates();
    this.initializeVariableGenerators();
  }

  getTemplate(name: string): ScriptTemplate | undefined {
    return this.templates.get(name);
  }

  getVariableGenerator(type: string): VariableGenerator | undefined {
    return this.variableGenerators.get(type);
  }

  createVariableGenerator(varDef: VariableDefinition): VariableGenerator {
    const baseGenerator = this.variableGenerators.get(varDef.type);
    if (!baseGenerator) {
      throw new Error(`Unknown variable type: ${varDef.type}`);
    }

    return {
      ...baseGenerator,
      config: { ...baseGenerator.config, ...varDef.parameters },
    };
  }

  generateVariableCode(generator: VariableGenerator): string {
    switch (generator.type) {
      case "random_id":
        return "Math.floor(Math.random() * 1000000)";
      case "uuid":
        return `'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        })`;
      case "timestamp":
        return "Date.now()";
      case "random_string":
        const length = generator.config.length || 10;
        return `Math.random().toString(36).substring(2, ${length + 2})`;
      case "sequence":
        return `(__VU - 1) * __ITER + __ITER`;
      default:
        return "null";
    }
  }

  private initializeTemplates(): void {
    // Basic HTTP request template
    this.templates.set("basic_http", {
      name: "Basic HTTP Request",
      description: "Simple HTTP request template",
      template: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

{{REQUEST_FUNCTIONS}}

export default function () {
{{MAIN_FUNCTION}}
}`,
      requiredVariables: ["REQUEST_FUNCTIONS", "MAIN_FUNCTION"],
      optionalVariables: [],
    });

    // Load testing template with stages
    this.templates.set("load_test", {
      name: "Load Test with Stages",
      description: "Template for load testing with ramp-up stages",
      template: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

{{REQUEST_FUNCTIONS}}

export default function () {
{{MAIN_FUNCTION}}
}

export function setup() {
  console.log('Starting load test setup...');
  return {};
}

export function teardown(data) {
  console.log('Load test completed');
}`,
      requiredVariables: ["REQUEST_FUNCTIONS", "MAIN_FUNCTION"],
      optionalVariables: [],
    });
  }

  private initializeVariableGenerators(): void {
    this.variableGenerators.set("random_id", {
      type: "random_id",
      config: {},
      generate: () => Math.floor(Math.random() * 1000000),
    });

    this.variableGenerators.set("uuid", {
      type: "uuid",
      config: {},
      generate: () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
    });

    this.variableGenerators.set("timestamp", {
      type: "timestamp",
      config: {},
      generate: () => Date.now(),
    });

    this.variableGenerators.set("random_string", {
      type: "random_string",
      config: { length: 10 },
      generate: () => Math.random().toString(36).substring(2, 12),
    });

    this.variableGenerators.set("sequence", {
      type: "sequence",
      config: { start: 1, step: 1 },
      generate: (() => {
        let counter = 1;
        return () => counter++;
      })(),
    });
  }
}
