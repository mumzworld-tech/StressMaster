export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    commandType?: string;
    fileUploads?: FileUpload[];
    testResults?: LoadTestResult;
  };
}

export interface FileUpload {
  id: string;
  name: string;
  type: "openapi" | "json" | "media" | "other";
  size: number;
  content?: string;
  url?: string;
}

export interface LoadTestCommand {
  type: "http" | "websocket" | "batch" | "custom";
  target: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  duration: number;
  users: number;
  rampUp?: number;
  payload?: Record<string, unknown>;
}

export interface LoadTestResult {
  id: string;
  command: LoadTestCommand | string;
  status: "running" | "completed" | "failed";
  startTime: Date;
  endTime?: Date;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
  };
  errors?: string[];
  reportUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  testResults: LoadTestResult[];
}

export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}
