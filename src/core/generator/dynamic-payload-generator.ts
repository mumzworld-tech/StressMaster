/**
 * Dynamic Payload Generator - Generates random and dynamic data
 * for load testing scenarios
 */

import { v4 as uuidv4 } from "uuid";

export interface DynamicVariable {
  name: string;
  type:
    | "uuid"
    | "timestamp"
    | "isoDate"
    | "randomString"
    | "randomNumber"
    | "sequence"
    | "counter"
    | "randomId";
  parameters?: {
    min?: number;
    max?: number;
    length?: number;
    prefix?: string;
    suffix?: string;
    format?: string;
  };
}

export class DynamicPayloadGenerator {
  private static sequenceCounters: Map<string, number> = new Map();

  /**
   * Generate dynamic value based on variable type
   */
  static generateValue(variable: DynamicVariable): string | number {
    switch (variable.type) {
      case "uuid":
        return this.generateUuid();
      case "timestamp":
        return this.generateTimestamp();
      case "isoDate":
        return this.generateIsoDate();
      case "randomString":
        return this.generateRandomString(variable.parameters?.length || 10);
      case "randomNumber":
        return this.generateRandomNumber(
          variable.parameters?.min || 1,
          variable.parameters?.max || 1000
        );
      case "sequence":
        return this.generateSequence(variable.name, variable.parameters);
      case "counter":
        return this.generateCounter(variable.name);
      case "randomId":
        return this.generateRandomId(variable.parameters);
      default:
        return "";
    }
  }

  /**
   * Generate UUID
   */
  private static generateUuid(): string {
    return uuidv4();
  }

  /**
   * Generate timestamp
   */
  private static generateTimestamp(): number {
    return Date.now();
  }

  /**
   * Generate ISO date string
   */
  private static generateIsoDate(): string {
    return new Date().toISOString();
  }

  /**
   * Generate random string
   */
  private static generateRandomString(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random number
   */
  private static generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate sequence with prefix/suffix
   */
  private static generateSequence(name: string, parameters?: any): string {
    const counter = this.sequenceCounters.get(name) || 0;
    this.sequenceCounters.set(name, counter + 1);

    const prefix = parameters?.prefix || "";
    const suffix = parameters?.suffix || "";
    const format = parameters?.format || "d";

    let formattedNumber = counter.toString();
    if (format === "hex") {
      formattedNumber = counter.toString(16);
    } else if (format === "octal") {
      formattedNumber = counter.toString(8);
    }

    return `${prefix}${formattedNumber}${suffix}`;
  }

  /**
   * Generate simple counter
   */
  private static generateCounter(name: string): number {
    const counter = this.sequenceCounters.get(name) || 0;
    this.sequenceCounters.set(name, counter + 1);
    return counter;
  }

  /**
   * Generate random ID with format
   */
  private static generateRandomId(parameters?: any): string {
    const prefix = parameters?.prefix || "ID";
    const length = parameters?.length || 8;
    const randomPart = this.generateRandomString(length);
    return `${prefix}${randomPart}`;
  }

  /**
   * Reset all sequence counters
   */
  static resetCounters(): void {
    this.sequenceCounters.clear();
  }

  /**
   * Reset specific sequence counter
   */
  static resetCounter(name: string): void {
    this.sequenceCounters.delete(name);
  }

  /**
   * Parse template and replace dynamic variables
   */
  static parseTemplate(template: string): {
    variables: DynamicVariable[];
    processedTemplate: string;
  } {
    const variables: DynamicVariable[] = [];
    let processedTemplate = template;

    // Match patterns like {uuid}, {timestamp}, {randomString:10}, etc.
    const variablePattern = /\{([^}]+)\}/g;
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const fullMatch = match[0];
      const variableDef = match[1];

      const variable = this.parseVariableDefinition(variableDef);
      if (variable) {
        variables.push(variable);
        processedTemplate = processedTemplate.replace(
          fullMatch,
          `{{${variable.name}}}`
        );
      }
    }

    return { variables, processedTemplate };
  }

  /**
   * Parse variable definition from string
   */
  private static parseVariableDefinition(def: string): DynamicVariable | null {
    const parts = def.split(":");
    const type = parts[0].trim();

    if (!this.isValidType(type)) {
      return null;
    }

    const variable: DynamicVariable = {
      name: type,
      type: type as any,
    };

    // Parse parameters if provided
    if (parts.length > 1) {
      const params = parts[1].trim();
      variable.parameters = this.parseParameters(params);
    }

    return variable;
  }

  /**
   * Check if type is valid
   */
  private static isValidType(type: string): boolean {
    const validTypes = [
      "uuid",
      "timestamp",
      "isoDate",
      "randomString",
      "randomNumber",
      "sequence",
      "counter",
      "randomId",
    ];
    return validTypes.includes(type);
  }

  /**
   * Parse parameters string
   */
  private static parseParameters(params: string): any {
    const result: any = {};

    // Parse key=value pairs
    const pairs = params.split(",");
    for (const pair of pairs) {
      const [key, value] = pair.split("=").map((s) => s.trim());
      if (key && value) {
        // Try to parse as number if possible
        const numValue = parseFloat(value);
        result[key] = isNaN(numValue) ? value : numValue;
      }
    }

    return result;
  }

  /**
   * Generate complete payload with dynamic variables
   */
  static generatePayload(template: string): any {
    const { variables, processedTemplate } = this.parseTemplate(template);

    let result = processedTemplate;

    // Replace all variables with generated values
    for (const variable of variables) {
      const value = this.generateValue(variable);
      result = result.replace(`{{${variable.name}}}`, String(value));
    }

    try {
      return JSON.parse(result);
    } catch (error) {
      // If not valid JSON, return as string
      return result;
    }
  }

  /**
   * Generate multiple payloads for load testing
   */
  static generatePayloads(template: string, count: number): any[] {
    const payloads: any[] = [];

    for (let i = 0; i < count; i++) {
      payloads.push(this.generatePayload(template));
    }

    return payloads;
  }
}
