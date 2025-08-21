/**
 * Error handling and formatting utilities
 */

/**
 * Base error class for StressMaster errors
 */
export class StressMasterError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = "StressMasterError";
  }
}

/**
 * Error codes for different types of errors
 */
export const ErrorCodes = {
  // Parser errors
  PARSER_INVALID_INPUT: "PARSER_INVALID_INPUT",
  PARSER_AI_PROVIDER_ERROR: "PARSER_AI_PROVIDER_ERROR",
  PARSER_VALIDATION_ERROR: "PARSER_VALIDATION_ERROR",

  // Executor errors
  EXECUTOR_DOCKER_ERROR: "EXECUTOR_DOCKER_ERROR",
  EXECUTOR_SCRIPT_ERROR: "EXECUTOR_SCRIPT_ERROR",
  EXECUTOR_TIMEOUT_ERROR: "EXECUTOR_TIMEOUT_ERROR",

  // Configuration errors
  CONFIG_INVALID: "CONFIG_INVALID",
  CONFIG_MISSING: "CONFIG_MISSING",
  CONFIG_VALIDATION_ERROR: "CONFIG_VALIDATION_ERROR",

  // Network errors
  NETWORK_CONNECTION_ERROR: "NETWORK_CONNECTION_ERROR",
  NETWORK_TIMEOUT_ERROR: "NETWORK_TIMEOUT_ERROR",
  NETWORK_INVALID_URL: "NETWORK_INVALID_URL",

  // File system errors
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_PERMISSION_ERROR: "FILE_PERMISSION_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",

  // General errors
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  OPERATION_CANCELLED: "OPERATION_CANCELLED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Creates a StressMaster error with appropriate code and suggestions
 */
export function createError(
  message: string,
  code: ErrorCode,
  context?: any,
  suggestions?: string[]
): StressMasterError {
  return new StressMasterError(message, code, context, suggestions);
}

/**
 * Wraps an unknown error into a StressMaster error
 */
export function wrapError(
  error: unknown,
  code: ErrorCode = ErrorCodes.UNKNOWN_ERROR,
  context?: any
): StressMasterError {
  if (error instanceof StressMasterError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const suggestions = getSuggestionsForError(code, error);

  return new StressMasterError(message, code, context, suggestions);
}

/**
 * Formats an error for display to users
 */
export function formatError(error: StressMasterError): string {
  let formatted = `Error (${error.code}): ${error.message}`;

  if (error.context) {
    formatted += `\nContext: ${JSON.stringify(error.context, null, 2)}`;
  }

  if (error.suggestions && error.suggestions.length > 0) {
    formatted += "\nSuggestions:";
    error.suggestions.forEach((suggestion) => {
      formatted += `\n  - ${suggestion}`;
    });
  }

  return formatted;
}

/**
 * Formats an error for logging (includes stack trace)
 */
export function formatErrorForLogging(error: Error): string {
  let formatted = `${error.name}: ${error.message}`;

  if (error.stack) {
    formatted += `\nStack trace:\n${error.stack}`;
  }

  if (error instanceof StressMasterError) {
    formatted += `\nError code: ${error.code}`;

    if (error.context) {
      formatted += `\nContext: ${JSON.stringify(error.context, null, 2)}`;
    }
  }

  return formatted;
}

/**
 * Checks if an error is of a specific type
 */
export function isErrorOfType(error: unknown, code: ErrorCode): boolean {
  return error instanceof StressMasterError && error.code === code;
}

/**
 * Extracts error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error occurred";
}

/**
 * Safely executes a function and returns either result or error
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode = ErrorCodes.UNKNOWN_ERROR
): Promise<
  { success: true; data: T } | { success: false; error: StressMasterError }
> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: wrapError(error, errorCode) };
  }
}

/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw wrapError(lastError!, ErrorCodes.UNKNOWN_ERROR);
}

/**
 * Gets appropriate suggestions based on error code and context
 */
function getSuggestionsForError(code: ErrorCode, error?: unknown): string[] {
  const suggestions: string[] = [];

  switch (code) {
    case ErrorCodes.PARSER_INVALID_INPUT:
      suggestions.push(
        "Check that your input contains valid HTTP request information",
        "Ensure URLs are properly formatted",
        "Verify that JSON payloads are valid"
      );
      break;

    case ErrorCodes.PARSER_AI_PROVIDER_ERROR:
      suggestions.push(
        "Check your AI provider configuration",
        "Verify API keys and endpoints are correct",
        "Ensure the AI service is running and accessible"
      );
      break;

    case ErrorCodes.EXECUTOR_DOCKER_ERROR:
      suggestions.push(
        "Ensure Docker is running and accessible",
        "Check Docker socket permissions",
        "Verify Docker image availability"
      );
      break;

    case ErrorCodes.CONFIG_INVALID:
      suggestions.push(
        "Check configuration file syntax",
        "Verify all required fields are present",
        "Ensure configuration values are within valid ranges"
      );
      break;

    case ErrorCodes.NETWORK_CONNECTION_ERROR:
      suggestions.push(
        "Check network connectivity",
        "Verify firewall settings",
        "Ensure the target service is running"
      );
      break;

    case ErrorCodes.FILE_NOT_FOUND:
      suggestions.push(
        "Check that the file path is correct",
        "Verify file permissions",
        "Ensure the file exists"
      );
      break;

    default:
      suggestions.push("Check the logs for more detailed error information");
  }

  return suggestions;
}

/**
 * Aggregates multiple errors into a single error
 */
export function aggregateErrors(
  errors: Error[],
  message = "Multiple errors occurred"
): StressMasterError {
  const errorMessages = errors.map(getErrorMessage);
  const fullMessage = `${message}:\n${errorMessages
    .map((msg) => `  - ${msg}`)
    .join("\n")}`;

  return createError(fullMessage, ErrorCodes.VALIDATION_ERROR, {
    errorCount: errors.length,
    errors: errorMessages,
  });
}
