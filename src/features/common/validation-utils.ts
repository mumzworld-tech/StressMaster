/**
 * Validation utilities for common data types and formats
 */

/**
 * Validates if a URL is properly formatted
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    // Check if it's a relative URL
    return url.startsWith("/") && url.length > 1;
  }
}

/**
 * Validates if a string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid HTTP method
 */
export function isValidHttpMethod(method: string): boolean {
  const validMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
  ];
  return validMethods.includes(method.toUpperCase());
}

/**
 * Validates if a string is a valid email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string is a valid port number
 */
export function isValidPort(port: string | number): boolean {
  const portNum = typeof port === "string" ? parseInt(port, 10) : port;
  return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
}

/**
 * Validates if a string is a valid IPv4 address
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Validates if a string is a valid hostname
 */
export function isValidHostname(hostname: string): boolean {
  const hostnameRegex =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return hostnameRegex.test(hostname) && hostname.length <= 253;
}

/**
 * Validates if a number is within a specified range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validates if a string matches a pattern
 */
export function matchesPattern(str: string, pattern: RegExp): boolean {
  return pattern.test(str);
}

/**
 * Validates if an object has all required properties
 */
export function hasRequiredProperties<T extends Record<string, any>>(
  obj: T,
  requiredProps: (keyof T)[]
): boolean {
  return requiredProps.every(
    (prop) => prop in obj && obj[prop] !== undefined && obj[prop] !== null
  );
}

/**
 * Validates if a value is not empty (handles strings, arrays, objects)
 */
export function isNotEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return true;
}

/**
 * Validates if a string is a valid duration format (e.g., "30s", "5m", "2h")
 */
export function isValidDuration(duration: string): boolean {
  const durationRegex = /^\d+[smh]$/;
  return durationRegex.test(duration);
}

/**
 * Validates if a string is a valid memory size format (e.g., "512m", "2g")
 */
export function isValidMemorySize(size: string): boolean {
  const memorySizeRegex = /^\d+[kmg]?$/i;
  return memorySizeRegex.test(size);
}

/**
 * Validates if a string is a valid CPU limit format (e.g., "0.5", "2")
 */
export function isValidCpuLimit(cpu: string): boolean {
  const cpuValue = parseFloat(cpu);
  return !isNaN(cpuValue) && cpuValue > 0 && cpuValue <= 32;
}

/**
 * Validates if a value is a positive integer
 */
export function isPositiveInteger(value: any): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Validates if a value is a non-negative number
 */
export function isNonNegativeNumber(value: any): boolean {
  return typeof value === "number" && !isNaN(value) && value >= 0;
}

/**
 * Validates if an array contains only unique values
 */
export function hasUniqueValues<T>(array: T[]): boolean {
  return new Set(array).size === array.length;
}

/**
 * Validates if a string contains only alphanumeric characters and allowed special chars
 */
export function isAlphanumericWithSpecial(
  str: string,
  allowedChars = "-_"
): boolean {
  const regex = new RegExp(
    `^[a-zA-Z0-9${allowedChars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]+$`
  );
  return regex.test(str);
}

/**
 * Validates if a file path is safe (no directory traversal)
 */
export function isSafeFilePath(path: string): boolean {
  // Check for directory traversal attempts
  if (path.includes("..") || path.includes("~")) {
    return false;
  }

  // Check for absolute paths (should be relative)
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    return false;
  }

  return true;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Creates a validation result
 */
export function createValidationResult(
  isValid: boolean,
  errors: string[] = [],
  warnings: string[] = []
): ValidationResult {
  return { isValid, errors, warnings };
}

/**
 * Combines multiple validation results
 */
export function combineValidationResults(
  ...results: ValidationResult[]
): ValidationResult {
  const allErrors = results.flatMap((r) => r.errors);
  const allWarnings = results.flatMap((r) => r.warnings || []);

  return {
    isValid: results.every((r) => r.isValid),
    errors: allErrors,
    warnings: allWarnings,
  };
}
