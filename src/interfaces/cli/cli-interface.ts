import { TestResult, ExportFormat, ProgressUpdate } from "../../types";
import { Observable } from "rxjs";

export interface CLIInterface {
  startSession(): Promise<void>;
  processCommand(input: string): Promise<TestResult>;
  displayResults(results: TestResult): void;
  exportResults(results: TestResult, format: ExportFormat): Promise<void>;
  shutdown(): Promise<void>;
}

export interface CLIConfig {
  interactive: boolean;
  outputFormat: ExportFormat;
  verbose: boolean;
  historyFile?: string;
  maxHistoryEntries: number;
  autoComplete: boolean;
}

export interface CommandHistory {
  commands: HistoryEntry[];
  maxEntries: number;
  addEntry(entry: Omit<HistoryEntry, "timestamp">): void;
  getHistory(): HistoryEntry[];
  searchHistory(query: string): HistoryEntry[];
  clearHistory(): void;
  saveToFile(filePath: string): Promise<void>;
  loadFromFile(filePath: string): Promise<void>;
}

export interface HistoryEntry {
  command: string;
  timestamp: Date;
  result: "success" | "error";
  executionTime: number;
  // Enhanced fields for load test requests
  isLoadTest?: boolean;
  testId?: string;
  testName?: string;
  testType?: string;
  status?: string;
  metrics?: {
    totalRequests?: number;
    successRate?: number;
    avgResponseTime?: number;
  };
}

export interface SessionContext {
  sessionId: string;
  startTime: Date;
  lastCommand?: string;
  testHistory: TestResult[];
  currentTest?: {
    id: string;
    status: "running" | "completed" | "failed";
    progress: ProgressUpdate[];
  };
}

export interface CLIPromptOptions {
  message: string;
  suggestions?: string[];
  history?: string[];
  validate?: (input: string) => boolean | string;
}
