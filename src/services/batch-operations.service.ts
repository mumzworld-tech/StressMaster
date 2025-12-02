/**
 * Batch Operations Service
 * Handles running multiple tests from a batch file
 */

import * as path from "path";
import { FileResolver } from "../utils/file-resolver";
import { StressMasterError, ErrorCodes } from "../features/common/error-utils";
import { LoadTestSpec } from "../types";
import { TestResult } from "../types";

export interface BatchTest {
  name: string;
  command: string;
  spec?: LoadTestSpec;
}

export interface BatchFile {
  tests: BatchTest[];
  options?: {
    parallel?: boolean;
    stopOnFailure?: boolean;
    continueOnError?: boolean;
  };
}

export interface BatchResult {
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    test: BatchTest;
    result?: TestResult;
    error?: string;
  }>;
  duration: number;
}

export class BatchOperationsService {
  /**
   * Load batch file
   */
  async loadBatchFile(filePath: string): Promise<BatchFile> {
    try {
      const resolvedPath = FileResolver.resolveFile(filePath, {
        throwIfNotFound: true,
        defaultExtensions: [".json"],
      }).resolvedPath;

      const content = await FileResolver.resolveAndReadFile(resolvedPath);
      const batch = JSON.parse(content) as BatchFile;

      // Validate batch file structure
      if (!batch.tests || !Array.isArray(batch.tests)) {
        throw new StressMasterError(
          "Invalid batch file: 'tests' array is required",
          ErrorCodes.VALIDATION_ERROR,
          { filePath }
        );
      }

      return batch;
    } catch (error) {
      if (error instanceof StressMasterError) {
        throw error;
      }
      throw new StressMasterError(
        `Failed to load batch file: ${(error as Error).message}`,
        ErrorCodes.FILE_NOT_FOUND,
        { filePath }
      );
    }
  }

  /**
   * Validate batch file
   */
  async validateBatchFile(filePath: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      const batch = await this.loadBatchFile(filePath);

      if (batch.tests.length === 0) {
        errors.push("Batch file contains no tests");
      }

      for (let i = 0; i < batch.tests.length; i++) {
        const test = batch.tests[i];
        if (!test.name) {
          errors.push(`Test ${i + 1}: missing 'name' field`);
        }
        if (!test.command) {
          errors.push(`Test ${i + 1}: missing 'command' field`);
        }
      }
    } catch (error) {
      errors.push((error as Error).message);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

