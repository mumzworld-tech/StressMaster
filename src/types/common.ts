// Common types and enums

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type TestType =
  | "spike"
  | "stress"
  | "endurance"
  | "volume"
  | "baseline"
  | "workflow"
  | "batch";

export type LoadPatternType =
  | "constant"
  | "ramp-up"
  | "spike"
  | "step"
  | "random-burst";

export type VariableType =
  | "random_id"
  | "uuid"
  | "timestamp"
  | "random_string"
  | "sequence"
  | "literal"
  | "incremental"
  | "custom"
  | "array_item"
  | "random_array"
  | "bulk_data";

export type TestStatus = "completed" | "failed" | "cancelled";

export type ExportFormat = "json" | "csv" | "html";

export interface Duration {
  value: number;
  unit: "seconds" | "minutes" | "hours";
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProgressUpdate {
  testId: string;
  progress: number; // 0-100
  currentPhase: string;
  message: string;
  timestamp: Date;
}

export interface ExecutionMetrics {
  status:
    | "idle"
    | "preparing"
    | "starting"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";
  progress: number; // 0-100
  currentVUs: number;
  requestsCompleted: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  timestamp: Date;
}
