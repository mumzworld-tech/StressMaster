/**
 * Type checking and type guard utilities
 */

/**
 * Checks if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Checks if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Checks if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Checks if a value is an object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Checks if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Checks if a value is a function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

/**
 * Checks if a value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Checks if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Checks if a value is a Date object
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Checks if a value is a RegExp
 */
export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/**
 * Checks if a value is a Promise
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value instanceof Promise ||
    (isObject(value) &&
      isFunction((value as any).then) &&
      isFunction((value as any).catch))
  );
}

/**
 * Checks if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Checks if a value is a plain object (created by {} or new Object())
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (!isObject(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Checks if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (isNullish(value)) {
    return true;
  }

  if (isString(value) || isArray(value)) {
    return value.length === 0;
  }

  if (isObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * Checks if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

/**
 * Checks if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * Checks if a value is a non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

/**
 * Checks if a value is an integer
 */
export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

/**
 * Checks if a value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

/**
 * Checks if a value has a specific property
 */
export function hasProperty<T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> {
  return isObject(obj) && prop in obj;
}

/**
 * Checks if a value has all specified properties
 */
export function hasProperties<T extends string>(
  obj: unknown,
  props: T[]
): obj is Record<T, unknown> {
  return isObject(obj) && props.every((prop) => prop in obj);
}

/**
 * Type guard for checking if an object matches a specific shape
 */
export function hasShape<T extends Record<string, (value: unknown) => boolean>>(
  obj: unknown,
  shape: T
): obj is {
  [K in keyof T]: T[K] extends (value: unknown) => value is infer U ? U : never;
} {
  if (!isObject(obj)) {
    return false;
  }

  return Object.entries(shape).every(([key, validator]) => {
    return key in obj && validator(obj[key]);
  });
}

/**
 * Safely casts a value to a specific type with validation
 */
export function safeCast<T>(
  value: unknown,
  validator: (value: unknown) => value is T
): T | null {
  return validator(value) ? value : null;
}

/**
 * Asserts that a value is of a specific type, throwing an error if not
 */
export function assertType<T>(
  value: unknown,
  validator: (value: unknown) => value is T,
  errorMessage?: string
): asserts value is T {
  if (!validator(value)) {
    throw new Error(errorMessage || `Type assertion failed`);
  }
}

/**
 * Creates a type guard for checking array element types
 */
export function isArrayOf<T>(
  elementValidator: (value: unknown) => value is T
): (value: unknown) => value is T[] {
  return (value: unknown): value is T[] => {
    return isArray(value) && value.every(elementValidator);
  };
}

/**
 * Creates a type guard for checking if a value is one of several types
 */
export function isOneOf<T extends readonly unknown[]>(
  ...validators: { [K in keyof T]: (value: unknown) => value is T[K] }
): (value: unknown) => value is T[number] {
  return (value: unknown): value is T[number] => {
    return validators.some((validator) => validator(value));
  };
}

/**
 * Utility type for extracting the type from a type guard function
 */
export type TypeFromGuard<T> = T extends (value: unknown) => value is infer U
  ? U
  : never;

/**
 * Utility type for making all properties of an object optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type for making all properties of an object required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Utility type for getting the keys of an object that have values of a specific type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];
