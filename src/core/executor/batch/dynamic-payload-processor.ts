import {
  BatchTestSpec,
  DynamicIncrementRule,
} from "../../../types/load-test-spec";

export class DynamicPayloadProcessor {
  processBatchPayloads(batchSpec: BatchTestSpec): void {
    if (!batchSpec.dynamicPayloads?.enabled) return;

    const { incrementStrategy, baseValues, incrementRules } =
      batchSpec.dynamicPayloads;
    let currentValues = { ...baseValues };

    for (const test of batchSpec.tests) {
      // Apply dynamic payload processing to test requests
      for (const request of test.requests) {
        if (request.payload?.template) {
          request.payload.template = this.processPayloadTemplate(
            request.payload.template,
            currentValues,
            incrementRules,
            incrementStrategy
          );
        }
      }

      // Update values for next test based on strategy
      currentValues = this.incrementValues(
        currentValues,
        incrementRules,
        incrementStrategy
      );
    }
  }

  private processPayloadTemplate(
    template: string,
    values: Record<string, any>,
    rules: DynamicIncrementRule[],
    strategy: string
  ): string {
    let processedTemplate = template;

    // Replace placeholders with current values
    for (const [key, value] of Object.entries(values)) {
      const placeholder = `{{${key}}}`;
      processedTemplate = processedTemplate.replace(
        new RegExp(placeholder, "g"),
        String(value)
      );
    }

    return processedTemplate;
  }

  private incrementValues(
    currentValues: Record<string, any>,
    rules: DynamicIncrementRule[],
    strategy: string
  ): Record<string, any> {
    const newValues = { ...currentValues };

    for (const rule of rules) {
      const currentValue = this.getNestedValue(newValues, rule.fieldPath);
      const newValue = this.calculateIncrementedValue(
        currentValue,
        rule,
        strategy
      );
      this.setNestedValue(newValues, rule.fieldPath, newValue);
    }

    return newValues;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => {
      const match = key.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const [, arrayKey, index] = match;
        return current[arrayKey]?.[parseInt(index)];
      }
      return current?.[key];
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      const match = key.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const [, arrayKey, index] = match;
        if (!current[arrayKey]) current[arrayKey] = [];
        if (!current[arrayKey][parseInt(index)])
          current[arrayKey][parseInt(index)] = {};
        return current[arrayKey][parseInt(index)];
      }
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);

    const match = lastKey.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const [, arrayKey, index] = match;
      if (!target[arrayKey]) target[arrayKey] = [];
      target[arrayKey][parseInt(index)] = value;
    } else {
      target[lastKey] = value;
    }
  }

  private calculateIncrementedValue(
    currentValue: any,
    rule: DynamicIncrementRule,
    strategy: string
  ): any {
    switch (rule.incrementType) {
      case "number":
        return this.incrementNumber(currentValue, rule, strategy);
      case "string":
        return this.incrementString(currentValue, rule, strategy);
      case "uuid":
        return this.generateUUID();
      case "timestamp":
        return this.generateTimestamp(rule.format);
      case "random":
        return this.generateRandomValue(rule.randomRange);
      default:
        return currentValue;
    }
  }

  private incrementNumber(
    value: any,
    rule: DynamicIncrementRule,
    strategy: string
  ): number {
    const current = typeof value === "number" ? value : rule.startValue || 0;
    const increment = rule.incrementValue || 1;
    const max = rule.maxValue || Number.MAX_SAFE_INTEGER;

    let newValue: number;
    switch (strategy) {
      case "linear":
        newValue = current + increment;
        break;
      case "exponential":
        newValue = current * (increment || 2);
        break;
      case "random":
        newValue = current + Math.random() * increment;
        break;
      default:
        newValue = current + increment;
    }

    return Math.min(newValue, max);
  }

  private incrementString(
    value: any,
    rule: DynamicIncrementRule,
    strategy: string
  ): string {
    const current = String(value || rule.startValue || "");
    const increment = rule.incrementValue || 1;

    // Try to extract number from string and increment
    const match = current.match(/(\d+)$/);
    if (match) {
      const number = parseInt(match[1]);
      const prefix = current.substring(0, match.index);
      return prefix + (number + increment);
    }

    return current + increment;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  private generateTimestamp(format?: string): string {
    const now = new Date();
    if (format) {
      return now.toISOString(); // Simple implementation
    }
    return now.getTime().toString();
  }

  private generateRandomValue(range?: { min: any; max: any }): any {
    if (!range) return Math.random();

    const min = typeof range.min === "number" ? range.min : 0;
    const max = typeof range.max === "number" ? range.max : 100;

    return Math.random() * (max - min) + min;
  }
}
