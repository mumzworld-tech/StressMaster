/**
 * Time and duration utilities
 */

/**
 * Duration units and their conversion factors to milliseconds
 */
const DURATION_UNITS = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  second: 1000,
  seconds: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
} as const;

export type DurationUnit = keyof typeof DURATION_UNITS;

/**
 * Parses a duration string (e.g., "30s", "5m", "2h") into milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const [, valueStr, unit] = match;
  const value = parseFloat(valueStr);
  const unitKey = unit.toLowerCase() as DurationUnit;

  if (!(unitKey in DURATION_UNITS)) {
    throw new Error(`Unknown duration unit: ${unit}`);
  }

  return value * DURATION_UNITS[unitKey];
}

/**
 * Formats milliseconds into a human-readable duration string
 */
export function formatDuration(milliseconds: number, precision = 2): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  if (milliseconds < 60 * 1000) {
    return `${(milliseconds / 1000).toFixed(precision)}s`;
  }

  if (milliseconds < 60 * 60 * 1000) {
    return `${(milliseconds / (60 * 1000)).toFixed(precision)}m`;
  }

  if (milliseconds < 24 * 60 * 60 * 1000) {
    return `${(milliseconds / (60 * 60 * 1000)).toFixed(precision)}h`;
  }

  return `${(milliseconds / (24 * 60 * 60 * 1000)).toFixed(precision)}d`;
}

/**
 * Converts duration to seconds for comparison
 */
export function convertToSeconds(duration: {
  value: number;
  unit: string;
}): number {
  const unitKey = duration.unit.toLowerCase() as DurationUnit;

  if (!(unitKey in DURATION_UNITS)) {
    throw new Error(`Unknown duration unit: ${duration.unit}`);
  }

  return (duration.value * DURATION_UNITS[unitKey]) / 1000;
}

/**
 * Creates a delay promise that resolves after the specified duration
 */
export function delay(duration: string | number): Promise<void> {
  const ms = typeof duration === "string" ? parseDuration(duration) : duration;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a timeout promise that rejects after the specified duration
 */
export function timeout<T>(
  promise: Promise<T>,
  duration: string | number
): Promise<T> {
  const ms = typeof duration === "string" ? parseDuration(duration) : duration;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(new Error(`Operation timed out after ${formatDuration(ms)}`)),
        ms
      );
    }),
  ]);
}

/**
 * Measures the execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * Creates a timestamp string in ISO format
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Creates a timestamp string suitable for filenames
 */
export function createFileTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .split(".")[0];
}

/**
 * Formats a date for display
 */
export function formatDate(
  date: Date,
  format: "short" | "long" | "iso" = "short"
): string {
  switch (format) {
    case "short":
      return date.toLocaleDateString();
    case "long":
      return date.toLocaleString();
    case "iso":
      return date.toISOString();
    default:
      return date.toString();
  }
}

/**
 * Calculates the time difference between two dates
 */
export function timeDifference(
  start: Date,
  end: Date
): {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
} {
  const diff = end.getTime() - start.getTime();

  return {
    milliseconds: diff,
    seconds: diff / 1000,
    minutes: diff / (1000 * 60),
    hours: diff / (1000 * 60 * 60),
    days: diff / (1000 * 60 * 60 * 24),
  };
}

/**
 * Checks if a date is within a specified range
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

/**
 * Adds a duration to a date
 */
export function addDuration(date: Date, duration: string | number): Date {
  const ms = typeof duration === "string" ? parseDuration(duration) : duration;
  return new Date(date.getTime() + ms);
}

/**
 * Subtracts a duration from a date
 */
export function subtractDuration(date: Date, duration: string | number): Date {
  const ms = typeof duration === "string" ? parseDuration(duration) : duration;
  return new Date(date.getTime() - ms);
}

/**
 * Gets the start of the day for a given date
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Gets the end of the day for a given date
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Throttles a function to execute at most once per specified duration
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  duration: string | number
): T {
  const ms = typeof duration === "string" ? parseDuration(duration) : duration;
  let lastCall = 0;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      return fn(...args);
    }
  }) as T;
}

/**
 * Debounces a function to execute only after the specified duration has passed since the last call
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  duration: string | number
): T {
  const ms = typeof duration === "string" ? parseDuration(duration) : duration;
  let timeoutId: NodeJS.Timeout;

  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * Creates a rate limiter that allows a maximum number of calls per time window
 */
export function createRateLimiter(
  maxCalls: number,
  windowDuration: string | number
) {
  const windowMs =
    typeof windowDuration === "string"
      ? parseDuration(windowDuration)
      : windowDuration;
  const calls: number[] = [];

  return {
    canCall(): boolean {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove calls outside the current window
      while (calls.length > 0 && calls[0] < windowStart) {
        calls.shift();
      }

      return calls.length < maxCalls;
    },

    recordCall(): void {
      calls.push(Date.now());
    },

    getRemainingCalls(): number {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove calls outside the current window
      while (calls.length > 0 && calls[0] < windowStart) {
        calls.shift();
      }

      return Math.max(0, maxCalls - calls.length);
    },

    getTimeUntilReset(): number {
      if (calls.length === 0) {
        return 0;
      }

      const oldestCall = calls[0];
      const resetTime = oldestCall + windowMs;
      return Math.max(0, resetTime - Date.now());
    },
  };
}
