/**
 * Configuration management utilities
 */

import { deepMerge, removeNullish } from "./data-utils";
import { isObject, isString, hasProperty } from "./type-utils";
import { createError, ErrorCodes } from "./error-utils";

/**
 * Environment variable parsing utilities
 */
export class EnvUtils {
  /**
   * Gets an environment variable as a string
   */
  static getString(key: string, defaultValue?: string): string | undefined {
    const value = process.env[key];
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Gets an environment variable as a number
   */
  static getNumber(key: string, defaultValue?: number): number | undefined {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }

    const parsed = Number(value);
    if (isNaN(parsed)) {
      throw createError(
        `Environment variable ${key} is not a valid number: ${value}`,
        ErrorCodes.CONFIG_INVALID
      );
    }

    return parsed;
  }

  /**
   * Gets an environment variable as a boolean
   */
  static getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }

    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") {
      return true;
    }

    if (lower === "false" || lower === "0" || lower === "no") {
      return false;
    }

    throw createError(
      `Environment variable ${key} is not a valid boolean: ${value}`,
      ErrorCodes.CONFIG_INVALID
    );
  }

  /**
   * Gets an environment variable as an array (comma-separated)
   */
  static getArray(key: string, defaultValue?: string[]): string[] | undefined {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  /**
   * Gets an environment variable as JSON
   */
  static getJSON<T = any>(key: string, defaultValue?: T): T | undefined {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      throw createError(
        `Environment variable ${key} is not valid JSON: ${value}`,
        ErrorCodes.CONFIG_INVALID,
        { originalError: error }
      );
    }
  }

  /**
   * Validates that required environment variables are present
   */
  static validateRequired(requiredVars: string[]): void {
    const missing = requiredVars.filter(
      (key) => process.env[key] === undefined
    );

    if (missing.length > 0) {
      throw createError(
        `Missing required environment variables: ${missing.join(", ")}`,
        ErrorCodes.CONFIG_MISSING,
        { missingVars: missing }
      );
    }
  }
}

/**
 * Configuration merging and validation utilities
 */
export class ConfigUtils {
  /**
   * Merges multiple configuration objects with deep merging
   */
  static merge<T extends Record<string, any>>(...configs: Partial<T>[]): T {
    return configs.reduce((merged, config) => {
      return deepMerge(merged, removeNullish(config));
    }, {} as any) as T;
  }

  /**
   * Validates a configuration object against a schema
   */
  static validate<T>(
    config: unknown,
    schema: ConfigSchema<T>
  ): { isValid: boolean; errors: string[]; config?: T } {
    const errors: string[] = [];

    if (!isObject(config)) {
      return {
        isValid: false,
        errors: ["Configuration must be an object"],
      };
    }

    const validatedConfig = this.validateObject(config, schema, "", errors);

    return {
      isValid: errors.length === 0,
      errors,
      config: errors.length === 0 ? (validatedConfig as T) : undefined,
    };
  }

  /**
   * Creates a configuration with defaults applied
   */
  static withDefaults<T extends Record<string, any>>(
    config: Partial<T>,
    defaults: T
  ): T {
    return deepMerge(defaults, config);
  }

  /**
   * Extracts configuration from environment variables with a prefix
   */
  static fromEnvironment<T extends Record<string, any>>(
    prefix: string,
    schema: ConfigSchema<T>
  ): Partial<T> {
    const config: any = {};
    const prefixUpper = prefix.toUpperCase() + "_";

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefixUpper)) {
        const configKey = key.slice(prefixUpper.length).toLowerCase();
        const schemaField = schema[configKey as keyof T];

        if (schemaField) {
          try {
            config[configKey] = this.parseEnvValue(value!, schemaField);
          } catch (error) {
            // Skip invalid values
          }
        }
      }
    }

    return config;
  }

  private static validateObject(
    obj: Record<string, any>,
    schema: Record<string, ConfigFieldSchema>,
    path: string,
    errors: string[]
  ): Record<string, any> {
    const result: Record<string, any> = {};

    // Check required fields
    for (const [key, fieldSchema] of Object.entries(schema)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      if (fieldSchema.required && (value === undefined || value === null)) {
        errors.push(`Required field missing: ${fieldPath}`);
        continue;
      }

      if (value !== undefined && value !== null) {
        const validatedValue = this.validateField(
          value,
          fieldSchema,
          fieldPath,
          errors
        );
        if (validatedValue !== undefined) {
          result[key] = validatedValue;
        }
      } else if (fieldSchema.default !== undefined) {
        result[key] = fieldSchema.default;
      }
    }

    return result;
  }

  private static validateField(
    value: any,
    schema: ConfigFieldSchema,
    path: string,
    errors: string[]
  ): any {
    // Type validation
    if (schema.type && !this.validateType(value, schema.type)) {
      errors.push(
        `Invalid type for ${path}: expected ${schema.type}, got ${typeof value}`
      );
      return undefined;
    }

    // Custom validation
    if (schema.validate && !schema.validate(value)) {
      errors.push(
        `Validation failed for ${path}: ${
          schema.errorMessage || "Invalid value"
        }`
      );
      return undefined;
    }

    // Nested object validation
    if (schema.type === "object" && schema.properties) {
      return this.validateObject(value, schema.properties, path, errors);
    }

    // Array validation
    if (schema.type === "array" && schema.items) {
      if (!Array.isArray(value)) {
        errors.push(`Invalid type for ${path}: expected array`);
        return undefined;
      }

      return value
        .map((item, index) =>
          this.validateField(item, schema.items!, `${path}[${index}]`, errors)
        )
        .filter((item) => item !== undefined);
    }

    return value;
  }

  private static validateType(value: any, type: ConfigFieldType): boolean {
    switch (type) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "object":
        return isObject(value);
      case "array":
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private static parseEnvValue(value: string, schema: ConfigFieldSchema): any {
    switch (schema.type) {
      case "number":
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${value}`);
        }
        return num;

      case "boolean":
        const lower = value.toLowerCase();
        if (lower === "true" || lower === "1") return true;
        if (lower === "false" || lower === "0") return false;
        throw new Error(`Invalid boolean: ${value}`);

      case "array":
        return value.split(",").map((item) => item.trim());

      case "object":
        return JSON.parse(value);

      default:
        return value;
    }
  }
}

/**
 * Configuration schema types
 */
export type ConfigFieldType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export interface ConfigFieldSchema {
  type?: ConfigFieldType;
  required?: boolean;
  default?: any;
  validate?: (value: any) => boolean;
  errorMessage?: string;
  properties?: Record<string, ConfigFieldSchema>;
  items?: ConfigFieldSchema;
}

export type ConfigSchema<T> = {
  [K in keyof T]: ConfigFieldSchema;
};

/**
 * Creates a configuration field schema
 */
export function field(options: ConfigFieldSchema): ConfigFieldSchema {
  return options;
}

/**
 * Creates a string field schema
 */
export function stringField(
  options: Omit<ConfigFieldSchema, "type"> = {}
): ConfigFieldSchema {
  return { ...options, type: "string" };
}

/**
 * Creates a number field schema
 */
export function numberField(
  options: Omit<ConfigFieldSchema, "type"> = {}
): ConfigFieldSchema {
  return { ...options, type: "number" };
}

/**
 * Creates a boolean field schema
 */
export function booleanField(
  options: Omit<ConfigFieldSchema, "type"> = {}
): ConfigFieldSchema {
  return { ...options, type: "boolean" };
}

/**
 * Creates an object field schema
 */
export function objectField(
  properties: Record<string, ConfigFieldSchema>,
  options: Omit<ConfigFieldSchema, "type" | "properties"> = {}
): ConfigFieldSchema {
  return { ...options, type: "object", properties };
}

/**
 * Creates an array field schema
 */
export function arrayField(
  items: ConfigFieldSchema,
  options: Omit<ConfigFieldSchema, "type" | "items"> = {}
): ConfigFieldSchema {
  return { ...options, type: "array", items };
}
