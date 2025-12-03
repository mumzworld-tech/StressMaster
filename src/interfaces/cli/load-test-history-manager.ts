/**
 * Load Test History Manager
 * 
 * Manages history of actual load test requests with full context including
 * parsed specs, test results, and metadata.
 */

import { promises as fs } from "fs";
import { LoadTestSpec } from "../../types/load-test-spec";
import { TestResult } from "../../types/test-result";
import { getResultsDir } from "../../utils/stressmaster-dir";

export interface LoadTestHistoryEntry {
  id: string;
  originalCommand: string;
  timestamp: Date;
  parsedSpec: LoadTestSpec;
  testResult?: TestResult;
  status: "completed" | "failed" | "cancelled";
  executionTime: number;
  metadata: {
    provider?: string;
    model?: string;
    confidence?: number;
  };
}

export interface LoadTestHistoryConfig {
  maxEntries: number;
  historyFile?: string;
}

/**
 * Service for managing load test history
 * Stores actual load test requests with full context
 */
export class LoadTestHistoryManager {
  private entries: LoadTestHistoryEntry[] = [];
  private config: LoadTestHistoryConfig;

  constructor(config: Partial<LoadTestHistoryConfig> = {}) {
    this.config = {
      maxEntries: config.maxEntries || 100,
      historyFile: config.historyFile,
    };
  }

  /**
   * Add a load test entry to history
   */
  addEntry(
    originalCommand: string,
    parsedSpec: LoadTestSpec,
    testResult?: TestResult,
    metadata?: LoadTestHistoryEntry["metadata"]
  ): void {
    const entry: LoadTestHistoryEntry = {
      id: parsedSpec.id || `test-${Date.now()}`,
      originalCommand,
      timestamp: new Date(),
      parsedSpec,
      testResult,
      status: testResult
        ? testResult.status === "completed"
          ? "completed"
          : testResult.status === "failed"
          ? "failed"
          : "cancelled"
        : "completed",
      executionTime: testResult
        ? testResult.endTime.getTime() - testResult.startTime.getTime()
        : 0,
      metadata: metadata || {},
    };

    this.entries.unshift(entry);

    // Maintain history limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(0, this.config.maxEntries);
    }
  }

  /**
   * Get all history entries
   */
  getHistory(): LoadTestHistoryEntry[] {
    return [...this.entries];
  }

  /**
   * Get recent entries
   */
  getRecentEntries(limit: number = 20): LoadTestHistoryEntry[] {
    return this.entries.slice(0, limit);
  }

  /**
   * Get entry by test ID
   */
  getEntryById(testId: string): LoadTestHistoryEntry | undefined {
    return this.entries.find((entry) => entry.id === testId);
  }

  /**
   * Search history by command, test name, or URL
   */
  searchHistory(query: string): LoadTestHistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.entries.filter(
      (entry) =>
        entry.originalCommand.toLowerCase().includes(lowerQuery) ||
        entry.parsedSpec.name.toLowerCase().includes(lowerQuery) ||
        entry.parsedSpec.requests.some((req) =>
          req.url.toLowerCase().includes(lowerQuery)
        )
    );
  }

  /**
   * Get successful tests
   */
  getSuccessfulTests(): LoadTestHistoryEntry[] {
    return this.entries.filter((entry) => entry.status === "completed");
  }

  /**
   * Get failed tests
   */
  getFailedTests(): LoadTestHistoryEntry[] {
    return this.entries.filter((entry) => entry.status === "failed");
  }

  /**
   * Get tests by type
   */
  getTestsByType(testType: string): LoadTestHistoryEntry[] {
    return this.entries.filter(
      (entry) => entry.parsedSpec.testType === testType
    );
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.entries = [];
  }

  /**
   * Save history to file
   */
  async saveToFile(filePath?: string): Promise<void> {
    const targetPath = filePath || this.config.historyFile;
    if (!targetPath) {
      throw new Error("No history file path specified");
    }

    try {
      // Ensure directory exists
      const dir = targetPath.substring(0, targetPath.lastIndexOf("/"));
      if (dir) {
        await fs.mkdir(dir, { recursive: true });
      }

      const data = JSON.stringify(
        this.entries.map((entry) => ({
          ...entry,
          timestamp: entry.timestamp.toISOString(),
          parsedSpec: entry.parsedSpec,
          testResult: entry.testResult
            ? {
                ...entry.testResult,
                startTime: entry.testResult.startTime.toISOString(),
                endTime: entry.testResult.endTime.toISOString(),
              }
            : undefined,
        })),
        null,
        2
      );
      await fs.writeFile(targetPath, data, "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to save load test history to ${targetPath}: ${error}`
      );
    }
  }

  /**
   * Load history from file
   */
  async loadFromFile(filePath?: string): Promise<void> {
    const targetPath = filePath || this.config.historyFile;
    if (!targetPath) {
      return; // No file to load
    }

    try {
      const data = await fs.readFile(targetPath, "utf-8");
      const parsedHistory = JSON.parse(data) as LoadTestHistoryEntry[];

      // Validate and convert timestamps
      this.entries = parsedHistory
        .map((entry) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
          testResult: entry.testResult
            ? {
                ...entry.testResult,
                startTime: new Date(entry.testResult.startTime),
                endTime: new Date(entry.testResult.endTime),
              }
            : undefined,
        }))
        .slice(0, this.config.maxEntries);
    } catch (error) {
      // If file doesn't exist or is invalid, start with empty history
      this.entries = [];
    }
  }

  /**
   * Get statistics about history
   */
  getStatistics(): {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  } {
    const total = this.entries.length;
    const successful = this.entries.filter(
      (e) => e.status === "completed"
    ).length;
    const failed = this.entries.filter((e) => e.status === "failed").length;
    const cancelled = this.entries.filter(
      (e) => e.status === "cancelled"
    ).length;

    const totalExecutionTime = this.entries.reduce(
      (sum, entry) => sum + entry.executionTime,
      0
    );
    const averageExecutionTime =
      total > 0 ? totalExecutionTime / total : 0;

    return {
      total,
      successful,
      failed,
      cancelled,
      averageExecutionTime,
      totalExecutionTime,
    };
  }
}

