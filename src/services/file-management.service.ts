/**
 * File Management Service
 * Handles file listing, validation, and search operations
 */

import * as path from "path";
import * as fs from "fs";
import { FileResolver } from "../utils/file-resolver";
import { StressMasterError, ErrorCodes } from "../features/common/error-utils";
import { safeReadFile } from "../features/common/file-utils";
import * as yaml from "js-yaml";

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  extension: string;
  type: "json" | "yaml" | "yml" | "text" | "image" | "other";
}

export interface FileValidationResult {
  valid: boolean;
  exists: boolean;
  path: string;
  size: number;
  lastModified: Date;
  format?: "json" | "yaml" | "yml";
  errors?: string[];
  warnings?: string[];
}

export class FileManagementService {
  private readonly rootDirectory: string;

  constructor(rootDirectory: string = process.cwd()) {
    this.rootDirectory = rootDirectory;
  }

  /**
   * List files matching a pattern
   */
  async listFiles(pattern?: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      const searchPattern = pattern || "*";
      const foundFiles = FileResolver.findFilesByPattern(
        searchPattern,
        this.rootDirectory,
        100
      );

      for (const filePath of foundFiles) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const type = this.getFileType(ext);

            files.push({
              name: path.basename(filePath),
              path: path.relative(this.rootDirectory, filePath),
              size: stats.size,
              lastModified: stats.mtime,
              extension: ext,
              type,
            });
          }
        } catch {
          // Skip files we can't access
        }
      }
    } catch (error) {
      throw new StressMasterError(
        `Failed to list files: ${(error as Error).message}`,
        ErrorCodes.FILE_NOT_FOUND,
        { pattern }
      );
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Validate a file reference
   */
  async validateFile(fileReference: string): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const result = FileResolver.resolveFile(fileReference, {
        throwIfNotFound: false,
      });

      if (!result.exists) {
        errors.push(`File not found: ${fileReference}`);
        if (result.suggestions && result.suggestions.length > 0) {
          warnings.push(
            `Similar files found: ${result.suggestions.join(", ")}`
          );
        }
        return {
          valid: false,
          exists: false,
          path: result.resolvedPath,
          size: 0,
          lastModified: new Date(),
          errors,
          warnings,
        };
      }

      const stats = fs.statSync(result.resolvedPath);
      const ext = path.extname(result.resolvedPath).toLowerCase();
      let format: "json" | "yaml" | "yml" | undefined;

      // Validate file format
      if ([".json", ".yaml", ".yml"].includes(ext)) {
        format = ext === ".json" ? "json" : ext === ".yaml" ? "yaml" : "yml";
        const validation = await this.validateFileFormat(
          result.resolvedPath,
          format
        );
        if (!validation.valid) {
          errors.push(...validation.errors);
        }
      }

      return {
        valid: errors.length === 0,
        exists: true,
        path: result.resolvedPath,
        size: stats.size,
        lastModified: stats.mtime,
        format,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      throw new StressMasterError(
        `Failed to validate file: ${(error as Error).message}`,
        ErrorCodes.FILE_NOT_FOUND,
        { fileReference }
      );
    }
  }

  /**
   * Search for files by pattern
   */
  async searchFiles(pattern: string): Promise<FileInfo[]> {
    return this.listFiles(pattern);
  }

  /**
   * Get file type from extension
   */
  private getFileType(extension: string): FileInfo["type"] {
    if ([".json", ".yaml", ".yml"].includes(extension)) {
      return extension === ".json" ? "json" : extension === ".yaml" ? "yaml" : "yml";
    }
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(extension)) {
      return "image";
    }
    if ([".txt", ".md", ".log"].includes(extension)) {
      return "text";
    }
    return "other";
  }

  /**
   * Validate file format
   */
  private async validateFileFormat(
    filePath: string,
    format: "json" | "yaml" | "yml"
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const content = await safeReadFile(filePath);
      if (!content) {
        errors.push("File is empty or cannot be read");
        return { valid: false, errors };
      }

      if (format === "json") {
        try {
          JSON.parse(content);
        } catch (error) {
          errors.push(`Invalid JSON: ${(error as Error).message}`);
        }
      } else {
        try {
          yaml.load(content);
        } catch (error) {
          errors.push(`Invalid YAML: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to read file: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

