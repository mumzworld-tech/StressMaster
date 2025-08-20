/**
 * Network and URL utilities
 */

import { isValidUrl } from "../common/validation-utils";

/**
 * Parses a URL and extracts its components
 */
export function parseUrl(url: string): {
  protocol: string;
  hostname: string;
  port?: number;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
} {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      origin: parsed.origin,
    };
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Builds a URL from components
 */
export function buildUrl(components: {
  protocol?: string;
  hostname: string;
  port?: number;
  pathname?: string;
  search?: string;
  hash?: string;
}): string {
  const {
    protocol = "https:",
    hostname,
    port,
    pathname = "",
    search = "",
    hash = "",
  } = components;

  let url = `${protocol}//${hostname}`;

  if (port) {
    url += `:${port}`;
  }

  if (pathname && !pathname.startsWith("/")) {
    url += "/";
  }
  url += pathname;

  if (search && !search.startsWith("?")) {
    url += "?";
  }
  url += search;

  if (hash && !hash.startsWith("#")) {
    url += "#";
  }
  url += hash;

  return url;
}

/**
 * Extracts URLs from text using regex patterns
 */
export function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlPattern) || [];
  return Array.from(new Set(matches)); // Remove duplicates
}

/**
 * Validates and normalizes a URL
 */
export function normalizeUrl(url: string): string {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  try {
    const parsed = new URL(url);

    // Normalize protocol to lowercase
    parsed.protocol = parsed.protocol.toLowerCase();

    // Normalize hostname to lowercase
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = "";
    }

    // Normalize pathname
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = "/";
    }

    return parsed.toString();
  } catch (error) {
    throw new Error(`Failed to normalize URL: ${url}`);
  }
}

/**
 * Joins URL paths safely
 */
export function joinUrlPaths(...paths: string[]): string {
  return paths
    .map((path, index) => {
      // Remove leading slash from all but the first path
      if (index > 0 && path.startsWith("/")) {
        path = path.slice(1);
      }

      // Remove trailing slash from all but the last path
      if (index < paths.length - 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
      }

      return path;
    })
    .filter((path) => path.length > 0)
    .join("/");
}

/**
 * Adds query parameters to a URL
 */
export function addQueryParams(
  url: string,
  params: Record<string, string | number | boolean>
): string {
  const parsed = new URL(url);

  Object.entries(params).forEach(([key, value]) => {
    parsed.searchParams.set(key, String(value));
  });

  return parsed.toString();
}

/**
 * Removes query parameters from a URL
 */
export function removeQueryParams(
  url: string,
  ...paramNames: string[]
): string {
  const parsed = new URL(url);

  paramNames.forEach((name) => {
    parsed.searchParams.delete(name);
  });

  return parsed.toString();
}

/**
 * Gets query parameters from a URL as an object
 */
export function getQueryParams(url: string): Record<string, string> {
  const parsed = new URL(url);
  const params: Record<string, string> = {};

  parsed.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

/**
 * Checks if a URL is absolute
 */
export function isAbsoluteUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a relative URL against a base URL
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch (error) {
    throw new Error(`Failed to resolve URL: ${relativeUrl} against ${baseUrl}`);
  }
}

/**
 * Checks if two URLs are from the same origin
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const parsed1 = new URL(url1);
    const parsed2 = new URL(url2);
    return parsed1.origin === parsed2.origin;
  } catch {
    return false;
  }
}

/**
 * Extracts the domain from a URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (error) {
    throw new Error(`Failed to extract domain from URL: ${url}`);
  }
}

/**
 * Checks if a URL uses HTTPS
 */
export function isHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Converts HTTP URL to HTTPS
 */
export function toHttps(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.protocol = "https:";

    // Remove port 80 if present (default HTTP port)
    if (parsed.port === "80") {
      parsed.port = "";
    }

    return parsed.toString();
  } catch (error) {
    throw new Error(`Failed to convert URL to HTTPS: ${url}`);
  }
}

/**
 * Sanitizes a URL by removing potentially dangerous components
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }

    // Remove username and password
    parsed.username = "";
    parsed.password = "";

    // Remove hash for security
    parsed.hash = "";

    return parsed.toString();
  } catch (error) {
    throw new Error(`Failed to sanitize URL: ${url}`);
  }
}

/**
 * Checks if a hostname is a valid IP address
 */
export function isIpAddress(hostname: string): boolean {
  // IPv4 pattern
  const ipv4Pattern =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 pattern (simplified)
  const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
}

/**
 * Gets the default port for a protocol
 */
export function getDefaultPort(protocol: string): number | undefined {
  const protocolPorts: Record<string, number> = {
    "http:": 80,
    "https:": 443,
    "ftp:": 21,
    "ssh:": 22,
    "telnet:": 23,
    "smtp:": 25,
    "dns:": 53,
  };

  return protocolPorts[protocol.toLowerCase()];
}

/**
 * Formats a URL for display (truncates if too long)
 */
export function formatUrlForDisplay(url: string, maxLength = 50): string {
  if (url.length <= maxLength) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    const path = parsed.pathname + parsed.search;

    if (domain.length >= maxLength - 3) {
      return domain.slice(0, maxLength - 3) + "...";
    }

    const availableLength = maxLength - domain.length - 3; // 3 for "..."
    if (path.length > availableLength) {
      return domain + path.slice(0, availableLength) + "...";
    }

    return url;
  } catch {
    // If URL parsing fails, just truncate the string
    return url.slice(0, maxLength - 3) + "...";
  }
}
