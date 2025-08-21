/**
 * Natural Language JSON Builder - Constructs JSON from human descriptions
 * Makes StressMaster understand complex JSON requirements in plain English
 */

export interface JsonField {
  name: string;
  value: any;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description: string;
}

export interface JsonTemplate {
  structure: Record<string, any>;
  fields: JsonField[];
  examples: string[];
}

export class NaturalJsonBuilder {
  private static readonly FIELD_PATTERNS = [
    // Basic field patterns
    {
      pattern: /(\w+)\s+(?:is|should\s+be|needs\s+to\s+be)\s+([^,\s]+)/gi,
      type: "string",
    },
    { pattern: /(\w+)\s+(?:equals?|=\s*)\s*([^,\s]+)/gi, type: "string" },
    { pattern: /(\w+)\s+(?:number|int|integer)\s+(\d+)/gi, type: "number" },
    { pattern: /(\w+)\s+(?:boolean|bool)\s+(true|false)/gi, type: "boolean" },

    // Array patterns
    {
      pattern: /(\w+)\s+(?:array|list)\s+with\s+(\d+)\s+(?:items?|objects?)/gi,
      type: "array",
    },
    {
      pattern: /(\w+)\s+(?:array|list)\s+containing\s+([^,\s]+)/gi,
      type: "array",
    },

    // Object patterns
    { pattern: /(\w+)\s+(?:object|struct)\s+with\s+(\w+)/gi, type: "object" },
    { pattern: /(\w+)\s+(?:nested|complex)\s+(\w+)/gi, type: "object" },
  ];

  private static readonly COMMON_STRUCTURES: Record<string, JsonTemplate> = {
    order: {
      structure: {
        orderId: "string",
        customerId: "string",
        items: "array",
        total: "number",
        status: "string",
      },
      fields: [
        {
          name: "orderId",
          value: "",
          type: "string",
          required: true,
          description: "Unique order identifier",
        },
        {
          name: "customerId",
          value: "",
          type: "string",
          required: true,
          description: "Customer identifier",
        },
        {
          name: "items",
          value: [],
          type: "array",
          required: true,
          description: "Order items",
        },
        {
          name: "total",
          value: 0,
          type: "number",
          required: true,
          description: "Order total",
        },
        {
          name: "status",
          value: "pending",
          type: "string",
          required: false,
          description: "Order status",
        },
      ],
      examples: [
        "order with orderId ORD123 and customerId CUST456",
        "order containing items array with 3 objects",
        "order with total 99.99 and status completed",
      ],
    },
    user: {
      structure: {
        userId: "string",
        name: "string",
        email: "string",
        active: "boolean",
      },
      fields: [
        {
          name: "userId",
          value: "",
          type: "string",
          required: true,
          description: "User identifier",
        },
        {
          name: "name",
          value: "",
          type: "string",
          required: true,
          description: "User name",
        },
        {
          name: "email",
          value: "",
          type: "string",
          required: true,
          description: "User email",
        },
        {
          name: "active",
          value: true,
          type: "boolean",
          required: false,
          description: "User active status",
        },
      ],
      examples: [
        "user with userId U123 and name John Doe",
        "user with email john@example.com and active true",
      ],
    },
    product: {
      structure: {
        productId: "string",
        name: "string",
        price: "number",
        category: "string",
        inStock: "boolean",
      },
      fields: [
        {
          name: "productId",
          value: "",
          type: "string",
          required: true,
          description: "Product identifier",
        },
        {
          name: "name",
          value: "",
          type: "string",
          required: true,
          description: "Product name",
        },
        {
          name: "price",
          value: 0,
          type: "number",
          required: true,
          description: "Product price",
        },
        {
          name: "category",
          value: "",
          type: "string",
          required: false,
          description: "Product category",
        },
        {
          name: "inStock",
          value: true,
          type: "boolean",
          required: false,
          description: "Stock availability",
        },
      ],
      examples: [
        "product with productId PROD123 and name iPhone",
        "product with price 999.99 and category electronics",
      ],
    },
  };

  /**
   * Build JSON from natural language description
   */
  static buildFromDescription(description: string): string | null {
    const normalized = description.toLowerCase();

    // Try to match common structures
    for (const [structureName, template] of Object.entries(
      this.COMMON_STRUCTURES
    )) {
      if (normalized.includes(structureName)) {
        return this.buildFromTemplate(template, description);
      }
    }

    // Try to build from scratch
    return this.buildFromScratch(description);
  }

  /**
   * Build JSON using a predefined template
   */
  private static buildFromTemplate(
    template: JsonTemplate,
    description: string
  ): string {
    const result: Record<string, any> = {};
    const normalized = description.toLowerCase();

    // Extract field values from description
    for (const field of template.fields) {
      const value = this.extractFieldValue(field.name, normalized, field.type);
      if (value !== null) {
        result[field.name] = value;
      } else if (field.required) {
        // Use default value for required fields
        result[field.name] = field.value;
      }
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Build JSON from scratch using patterns
   */
  private static buildFromScratch(description: string): string | null {
    const result: Record<string, any> = {};
    const normalized = description.toLowerCase();

    // Extract fields using patterns
    for (const pattern of this.FIELD_PATTERNS) {
      const matches = normalized.matchAll(pattern.pattern);
      for (const match of matches) {
        const fieldName = match[1];
        const fieldValue = this.parseValue(match[2], pattern.type);
        if (fieldValue !== null) {
          result[fieldName] = fieldValue;
        }
      }
    }

    // Extract special patterns
    this.extractSpecialPatterns(normalized, result);

    return Object.keys(result).length > 0
      ? JSON.stringify(result, null, 2)
      : null;
  }

  /**
   * Extract field value from description
   */
  private static extractFieldValue(
    fieldName: string,
    description: string,
    type: string
  ): any {
    const patterns = [
      new RegExp(
        `${fieldName}\\s+(?:is|should\\s+be|needs\\s+to\\s+be)\\s+([^,\\s]+)`,
        "gi"
      ),
      new RegExp(`${fieldName}\\s+(?:equals?|=)\\s*([^,\\s]+)`, "gi"),
      new RegExp(`${fieldName}\\s+([^,\\s]+)`, "gi"),
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return this.parseValue(match[1], type);
      }
    }

    return null;
  }

  /**
   * Parse value based on type
   */
  private static parseValue(value: string, type: string): any {
    switch (type) {
      case "number":
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      case "boolean":
        return value.toLowerCase() === "true";
      case "array":
        return [];
      case "object":
        return {};
      default:
        return value;
    }
  }

  /**
   * Extract special patterns like "payload as array with one object"
   */
  private static extractSpecialPatterns(
    description: string,
    result: Record<string, any>
  ): void {
    // Payload as array pattern
    const payloadMatch = description.match(
      /payload\s+as\s+array\s+with\s+(\d+)\s+objects?/
    );
    if (payloadMatch) {
      const count = parseInt(payloadMatch[1]);
      result.payload = Array(count).fill({});
    }

    // Payload as array with one object having specific fields
    const payloadObjectMatch = description.match(
      /payload\s+as\s+array\s+with\s+one\s+object\s+having\s+(\w+)\s+([^,\s]+)/
    );
    if (payloadObjectMatch) {
      const fieldName = payloadObjectMatch[1];
      const fieldValue = payloadObjectMatch[2];
      result.payload = [{ [fieldName]: fieldValue }];
    }

    // RequestId pattern
    const requestIdMatch = description.match(/requestid\s+([^,\s]+)/);
    if (requestIdMatch) {
      result.requestId = requestIdMatch[1];
    }

    // Type pattern
    const typeMatch = description.match(/type\s+([^,\s]+)/);
    if (typeMatch) {
      result.type = typeMatch[1];
    }
  }

  /**
   * Generate examples for a given structure
   */
  static generateExamples(structureName: string): string[] {
    const template = this.COMMON_STRUCTURES[structureName];
    return template ? template.examples : [];
  }

  /**
   * Validate JSON structure against description
   */
  static validateStructure(
    json: string,
    description: string
  ): {
    valid: boolean;
    missing: string[];
    extra: string[];
    suggestions: string[];
  } {
    try {
      const parsed = JSON.parse(json);
      const normalized = description.toLowerCase();
      const result = {
        valid: true,
        missing: [] as string[],
        extra: [] as string[],
        suggestions: [] as string[],
      };

      // Check for mentioned fields that are missing
      for (const field of Object.keys(this.COMMON_STRUCTURES)) {
        if (normalized.includes(field) && !parsed[field]) {
          result.missing.push(field);
          result.valid = false;
        }
      }

      // Check for extra fields
      for (const field of Object.keys(parsed)) {
        if (!normalized.includes(field)) {
          result.extra.push(field);
        }
      }

      // Generate suggestions
      if (result.missing.length > 0) {
        result.suggestions.push(
          `Add missing fields: ${result.missing.join(", ")}`
        );
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        missing: [],
        extra: [],
        suggestions: ["Invalid JSON format"],
      };
    }
  }

  /**
   * Smart JSON completion
   */
  static completeJson(partialJson: string, description: string): string {
    try {
      const parsed = JSON.parse(partialJson);
      const normalized = description.toLowerCase();

      // Add missing common fields
      if (normalized.includes("requestid") && !parsed.requestId) {
        parsed.requestId = "req-" + Date.now();
      }

      if (normalized.includes("type") && !parsed.type) {
        parsed.type = "default";
      }

      if (normalized.includes("payload") && !parsed.payload) {
        parsed.payload = [];
      }

      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return partialJson;
    }
  }
}
