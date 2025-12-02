/**
 * Centralized File Resolver for CLI Tool
 *
 * CRITICAL: This resolver works relative to the CURRENT WORKING DIRECTORY (process.cwd()),
 * which is where the user runs the StressMaster command. This means:
 *
 * - Files are resolved from the project being tested, NOT from StressMaster's installation directory
 * - Users can reference files like @api.yaml, @payload.json from their project directory
 * - Files can be located anywhere in the project - just specify the filename and it will be found
 * - This allows StressMaster to be used as a CLI tool for any project
 *
 * Example:
 *   User is in /path/to/my-api-project/
 *   Runs: stressmaster "test @api.yaml endpoints"
 *   FileResolver searches for api.yaml starting from /path/to/my-api-project/
 *
 * Provides consistent file resolution across the entire application
 */

import * as path from "path";
import * as fs from "fs";
import { fileExists, safeReadFile } from "../features/common/file-utils";
import { StressMasterError, ErrorCodes } from "../features/common/error-utils";

export interface FileResolutionOptions {
  /**
   * Base directory for file resolution (default: process.cwd() - current working directory)
   *
   * NOTE: Files are resolved relative to where the user runs the command (current working directory),
   * NOT relative to StressMaster's installation directory. This allows StressMaster to work with
   * any project the user is testing.
   */
  baseDirectory?: string;

  /**
   * Additional search paths to try if file not found in base directory
   */
  searchPaths?: string[];

  /**
   * File extensions to try if extension is missing
   */
  defaultExtensions?: string[];

  /**
   * Whether to throw error if file not found (default: true)
   */
  throwIfNotFound?: boolean;

  /**
   * Whether to suggest similar filenames if file not found
   */
  suggestAlternatives?: boolean;
}

export interface FileResolutionResult {
  /**
   * Resolved absolute file path
   */
  resolvedPath: string;

  /**
   * Whether file exists
   */
  exists: boolean;

  /**
   * Alternative file paths that were tried
   */
  attemptedPaths: string[];

  /**
   * Suggested similar filenames (if file not found and suggestAlternatives is true)
   */
  suggestions?: string[];
}

/**
 * Centralized file resolver for CLI tool
 *
 * IMPORTANT: Files are resolved relative to the CURRENT WORKING DIRECTORY (where the user runs the command),
 * NOT relative to StressMaster's installation directory. This allows StressMaster to be used as a CLI tool
 * to test any project, with files referenced from that project's directory structure.
 *
 * Searches for file references (@filename) by filename across the project directory
 * Files can be located anywhere - just specify the filename and it will be found
 */
export class FileResolver {
  /**
   * Get the root directory for file search (current working directory where CLI is executed)
   * Files are searched recursively from this directory
   *
   * This is computed dynamically to always use the current working directory at resolution time,
   * ensuring files are resolved relative to the project being tested, not StressMaster's installation.
   */
  static getRootDirectory(): string {
    return process.cwd();
  }

  /**
   * Default file extensions to try
   */
  private static readonly DEFAULT_EXTENSIONS = [
    ".json",
    ".yaml",
    ".yml",
    ".txt",
    ".jpg",
    ".png",
    ".pdf",
  ];

  /**
   * Resolve a file reference (e.g., "@file.json" or "file.json")
   * Searches for files by filename across the project directory
   *
   * @param fileReference - File reference with or without @ prefix
   * @param options - Resolution options
   * @returns FileResolutionResult with resolved path and metadata
   */
  static resolveFile(
    fileReference: string,
    options: FileResolutionOptions = {}
  ): FileResolutionResult {
    // Remove @ prefix if present
    const cleanReference = fileReference.startsWith("@")
      ? fileReference.substring(1)
      : fileReference;

    // Always use current working directory (where user runs the command)
    // This ensures files are resolved from the project being tested, not StressMaster's installation
    const baseDir = options.baseDirectory || this.getRootDirectory();
    const searchPaths = options.searchPaths || [];
    const defaultExtensions =
      options.defaultExtensions || this.DEFAULT_EXTENSIONS;
    const throwIfNotFound = options.throwIfNotFound !== false;
    const suggestAlternatives = options.suggestAlternatives !== false;

    const attemptedPaths: string[] = [];
    let suggestions: string[] = [];

    // Strategy 1: Use reference as-is if absolute path
    if (path.isAbsolute(cleanReference)) {
      attemptedPaths.push(cleanReference);
      if (fs.existsSync(cleanReference)) {
        return {
          resolvedPath: cleanReference,
          exists: true,
          attemptedPaths: [cleanReference],
        };
      }
    } else {
      // Strategy 2: Search by filename across project directory (recursive)
      const foundFile = this.searchFileByName(
        cleanReference,
        baseDir,
        defaultExtensions
      );
      if (foundFile) {
        attemptedPaths.push(foundFile);
        return {
          resolvedPath: foundFile,
          exists: true,
          attemptedPaths: [foundFile],
        };
      }

      // Strategy 3: Try relative to base directory (for backward compatibility)
      const basePath = path.resolve(baseDir, cleanReference);
      attemptedPaths.push(basePath);
      if (fs.existsSync(basePath)) {
        return {
          resolvedPath: basePath,
          exists: true,
          attemptedPaths: [basePath],
        };
      }

      // Strategy 4: Try with default extensions if no extension provided
      if (!path.extname(cleanReference)) {
        for (const ext of defaultExtensions) {
          const foundWithExt = this.searchFileByName(
            cleanReference + ext,
            baseDir,
            []
          );
          if (foundWithExt) {
            attemptedPaths.push(foundWithExt);
            return {
              resolvedPath: foundWithExt,
              exists: true,
              attemptedPaths,
            };
          }
        }
      }

      // Strategy 5: Try additional search paths
      for (const searchPath of searchPaths) {
        const foundInSearchPath = this.searchFileByName(
          cleanReference,
          searchPath,
          defaultExtensions
        );
        if (foundInSearchPath) {
          attemptedPaths.push(foundInSearchPath);
          return {
            resolvedPath: foundInSearchPath,
            exists: true,
            attemptedPaths,
          };
        }
      }
    }

    // File not found - generate suggestions if enabled
    if (suggestAlternatives) {
      suggestions = this.findSimilarFiles(cleanReference, baseDir);
    }

    // Throw error if requested
    if (throwIfNotFound) {
      const errorMessage = this.createErrorMessage(
        cleanReference,
        attemptedPaths,
        suggestions
      );
      throw new StressMasterError(
        errorMessage,
        ErrorCodes.FILE_NOT_FOUND,
        {
          fileReference: cleanReference,
          attemptedPaths,
          baseDirectory: baseDir,
        },
        suggestions.length > 0
          ? suggestions.map((s) => `Did you mean: ${s}?`)
          : [
              `Check if file exists in: ${baseDir}`,
              `Use absolute path if file is in different location`,
            ]
      );
    }

    // Return result even if file not found (for non-throwing scenarios)
    return {
      resolvedPath: path.resolve(baseDir, cleanReference),
      exists: false,
      attemptedPaths,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Resolve and read file content
   *
   * @param fileReference - File reference with or without @ prefix
   * @param options - Resolution options
   * @returns File content as string
   */
  static async resolveAndReadFile(
    fileReference: string,
    options: FileResolutionOptions = {}
  ): Promise<string> {
    const result = this.resolveFile(fileReference, {
      ...options,
      throwIfNotFound: true,
    });

    const content = await safeReadFile(result.resolvedPath);
    if (content === null) {
      throw new StressMasterError(
        `File exists but could not be read: ${result.resolvedPath}`,
        ErrorCodes.FILE_PERMISSION_ERROR,
        { filePath: result.resolvedPath }
      );
    }

    return content;
  }

  /**
   * Resolve file synchronously (for compatibility)
   */
  static resolveFileSync(
    fileReference: string,
    options: FileResolutionOptions = {}
  ): string {
    const result = this.resolveFile(fileReference, {
      ...options,
      throwIfNotFound: true,
    });

    try {
      return fs.readFileSync(result.resolvedPath, "utf8");
    } catch (error) {
      throw new StressMasterError(
        `Failed to read file: ${result.resolvedPath}`,
        ErrorCodes.FILE_PERMISSION_ERROR,
        { filePath: result.resolvedPath, error: (error as Error).message }
      );
    }
  }

  /**
   * Search for a file by name across the project directory (recursive)
   *
   * @param filename - Filename to search for (e.g., "payload.json")
   * @param searchDirectory - Directory to search in (default: root)
   * @param extensions - Extensions to try if filename has no extension
   * @returns Full path to file if found, null otherwise
   */
  private static searchFileByName(
    filename: string,
    searchDirectory: string,
    extensions: string[]
  ): string | null {
    try {
      if (
        !fs.existsSync(searchDirectory) ||
        !fs.statSync(searchDirectory).isDirectory()
      ) {
        return null;
      }

      const filenameLower = filename.toLowerCase();
      const basename = path.basename(filename);
      const basenameLower = basename.toLowerCase();

      // Search recursively
      const found = this.searchRecursive(
        searchDirectory,
        basenameLower,
        filenameLower
      );

      if (found) {
        return found;
      }

      // If no extension and extensions provided, try with extensions
      if (!path.extname(filename) && extensions.length > 0) {
        for (const ext of extensions) {
          const withExt = filename + ext;
          const foundWithExt = this.searchRecursive(
            searchDirectory,
            basenameLower + ext.toLowerCase(),
            withExt.toLowerCase()
          );
          if (foundWithExt) {
            return foundWithExt;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Recursively search for a file in a directory
   */
  private static searchRecursive(
    dir: string,
    basenameLower: string,
    fullnameLower: string,
    maxDepth: number = 10,
    currentDepth: number = 0
  ): string | null {
    // Prevent infinite recursion and limit depth
    if (currentDepth >= maxDepth) {
      return null;
    }

    // Skip common directories that shouldn't be searched
    const skipDirs = [
      "node_modules",
      ".git",
      ".vscode",
      ".idea",
      "dist",
      "build",
      ".next",
      ".cache",
      "coverage",
      ".nyc_output",
    ];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files/directories and common build/cache directories
        if (entry.name.startsWith(".") && entry.name !== ".stressmaster") {
          continue;
        }

        if (skipDirs.includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const found = this.searchRecursive(
            fullPath,
            basenameLower,
            fullnameLower,
            maxDepth,
            currentDepth + 1
          );
          if (found) {
            return found;
          }
        } else if (entry.isFile()) {
          // Check if filename matches (case-insensitive)
          const entryNameLower = entry.name.toLowerCase();
          if (
            entryNameLower === fullnameLower ||
            entryNameLower === basenameLower
          ) {
            return fullPath;
          }
        }
      }
    } catch {
      // Ignore permission errors and continue
    }

    return null;
  }

  /**
   * Find similar files across the project (for suggestions)
   * Searches recursively to find files with similar names
   */
  private static findSimilarFiles(
    filename: string,
    searchDirectory: string,
    maxResults: number = 5
  ): string[] {
    const filenameLower = filename.toLowerCase();
    const basename = path.basename(filenameLower);
    const suggestions: Array<{ file: string; path: string; score: number }> =
      [];

    try {
      const search = (dir: string, depth: number = 0): void => {
        if (depth > 5) return; // Limit depth for performance

        const skipDirs = [
          "node_modules",
          ".git",
          ".vscode",
          ".idea",
          "dist",
          "build",
        ];

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.name.startsWith(".") && entry.name !== ".stressmaster") {
              continue;
            }

            if (skipDirs.includes(entry.name)) {
              continue;
            }

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              search(fullPath, depth + 1);
            } else if (entry.isFile()) {
              const fileLower = entry.name.toLowerCase();
              let score = 0;

              // Exact match (case-insensitive)
              if (fileLower === filenameLower) {
                score = 100;
              }
              // Starts with filename
              else if (fileLower.startsWith(basename)) {
                score = 80;
              }
              // Contains filename
              else if (fileLower.includes(basename)) {
                score = 60;
              }
              // Similar extension
              else if (
                path.extname(fileLower) === path.extname(filenameLower)
              ) {
                score = 40;
              }

              if (score > 0 && suggestions.length < maxResults * 2) {
                suggestions.push({ file: entry.name, path: fullPath, score });
              }
            }
          }
        } catch {
          // Ignore permission errors
        }
      };

      search(searchDirectory);

      // Sort by score and return top matches (relative paths)
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map((s) => path.relative(searchDirectory, s.path));
    } catch {
      return [];
    }
  }

  /**
   * Create user-friendly error message
   */
  private static createErrorMessage(
    fileReference: string,
    attemptedPaths: string[],
    suggestions: string[]
  ): string {
    let message = `File not found: ${fileReference}`;

    if (attemptedPaths.length > 0) {
      message += `\n\nSearched in:\n${attemptedPaths
        .map((p) => `  - ${p}`)
        .join("\n")}`;
    }

    if (suggestions.length > 0) {
      message += `\n\nSimilar files found:\n${suggestions
        .map((s) => `  - ${s}`)
        .join("\n")}`;
    }

    return message;
  }

  /**
   * Get all files matching a pattern (for autocomplete/suggestions)
   */
  static findFilesByPattern(
    pattern: string,
    searchDirectory: string = this.getRootDirectory(),
    maxResults: number = 20
  ): string[] {
    const results: string[] = [];
    const patternLower = pattern.toLowerCase();

    try {
      const search = (dir: string, depth: number = 0): void => {
        if (depth > 5) return; // Limit depth for performance

        const skipDirs = [
          "node_modules",
          ".git",
          ".vscode",
          ".idea",
          "dist",
          "build",
        ];

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.name.startsWith(".") && entry.name !== ".stressmaster") {
              continue;
            }

            if (skipDirs.includes(entry.name)) {
              continue;
            }

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              search(fullPath, depth + 1);
            } else if (entry.isFile()) {
              const nameLower = entry.name.toLowerCase();

              // Handle wildcard patterns
              let matches = false;

              if (pattern === "*" || patternLower === "*") {
                // Match all files (when no pattern specified)
                matches = true;
              } else if (patternLower.includes("*")) {
                // Convert wildcard pattern to regex
                const regexPattern = patternLower
                  .replace(/\./g, "\\.")
                  .replace(/\*/g, ".*");
                const regex = new RegExp(`^${regexPattern}$`, "i");
                matches = regex.test(entry.name);
              } else if (patternLower.startsWith("*.")) {
                // Pattern like "*.json" - match by extension
                const ext = patternLower.substring(1); // Remove the *
                matches = nameLower.endsWith(ext);
              } else {
                // Simple substring match for partial patterns
                matches = nameLower.includes(patternLower);
              }

              if (matches && results.length < maxResults) {
                results.push(fullPath);
              }
            }
          }
        } catch {
          // Ignore permission errors
        }
      };

      search(searchDirectory);
    } catch {
      // Ignore errors
    }

    return results;
  }

  /**
   * Check if a file exists without throwing
   */
  static fileExists(
    fileReference: string,
    options: FileResolutionOptions = {}
  ): boolean {
    try {
      const result = this.resolveFile(fileReference, {
        ...options,
        throwIfNotFound: false,
      });
      return result.exists;
    } catch {
      return false;
    }
  }

  /**
   * Extract all file references from a command string
   */
  static extractFileReferences(command: string): string[] {
    const fileReferences: string[] = [];

    // Pattern 1: @filename.ext
    const atPattern =
      /@([\w\-_\/\.]+\.(json|yaml|yml|txt|jpg|png|pdf|jpeg|gif|doc|docx|pdf|csv))/gi;
    let match;
    while ((match = atPattern.exec(command)) !== null) {
      fileReferences.push(match[1]);
    }

    // Pattern 2: file: @filename (media files)
    const mediaPattern = /\w+:\s*@([\w\-_\/\.]+)/gi;
    while ((match = mediaPattern.exec(command)) !== null) {
      if (!fileReferences.includes(match[1])) {
        fileReferences.push(match[1]);
      }
    }

    return fileReferences;
  }

  /**
   * Validate all file references in a command exist
   */
  static validateFileReferences(
    command: string,
    options: FileResolutionOptions = {}
  ): {
    valid: boolean;
    missing: string[];
    resolved: Map<string, string>;
  } {
    const references = this.extractFileReferences(command);
    const missing: string[] = [];
    const resolved = new Map<string, string>();

    for (const ref of references) {
      try {
        const result = this.resolveFile(ref, {
          ...options,
          throwIfNotFound: true,
        });
        resolved.set(ref, result.resolvedPath);
      } catch {
        missing.push(ref);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      resolved,
    };
  }
}
