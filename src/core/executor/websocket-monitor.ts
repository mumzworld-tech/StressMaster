import { WebSocketServer, WebSocket } from "ws";
import { ExecutionProgress } from "./execution-monitor";
import { Observable } from "rxjs";

export interface WebSocketMonitorConfig {
  port: number;
  path?: string;
  heartbeatInterval?: number;
}

export interface WebSocketMessage {
  type: "progress" | "error" | "heartbeat" | "subscribe" | "unsubscribe";
  testId?: string;
  data?: any;
  timestamp: number;
}

export class WebSocketMonitor {
  private wss: WebSocketServer;
  private config: WebSocketMonitorConfig;
  private clients = new Map<WebSocket, Set<string>>(); // WebSocket -> subscribed test IDs
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: WebSocketMonitorConfig) {
    this.config = config;
    this.wss = new WebSocketServer({
      port: config.port,
      path: config.path || "/monitor",
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  subscribeToExecution(
    testId: string,
    progress$: Observable<ExecutionProgress>
  ): void {
    progress$.subscribe({
      next: (progress) => {
        this.broadcastToSubscribers(testId, {
          type: "progress",
          testId,
          data: progress,
          timestamp: Date.now(),
        });
      },
      error: (error) => {
        this.broadcastToSubscribers(testId, {
          type: "error",
          testId,
          data: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          timestamp: Date.now(),
        });
      },
      complete: () => {
        // Execution completed, no need to unsubscribe clients automatically
        // They can choose to unsubscribe or keep listening for final status
      },
    });
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.wss.clients.forEach((ws) => {
      ws.close();
    });

    this.wss.close();
  }

  getConnectedClients(): number {
    return this.wss.clients.size;
  }

  getSubscriptions(): Map<string, number> {
    const subscriptions = new Map<string, number>();

    this.clients.forEach((testIds) => {
      testIds.forEach((testId) => {
        subscriptions.set(testId, (subscriptions.get(testId) || 0) + 1);
      });
    });

    return subscriptions;
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("WebSocket client connected");
      this.clients.set(ws, new Set());

      ws.on("message", (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          this.sendError(ws, "Invalid message format");
        }
      });

      ws.on("close", () => {
        console.log("WebSocket client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });

      // Send welcome message
      this.sendMessage(ws, {
        type: "heartbeat",
        data: { message: "Connected to execution monitor" },
        timestamp: Date.now(),
      });
    });

    this.wss.on("error", (error) => {
      console.error("WebSocket server error:", error);
    });

    console.log(`WebSocket monitor listening on port ${this.config.port}`);
  }

  private handleClientMessage(ws: WebSocket, message: WebSocketMessage): void {
    const clientSubscriptions = this.clients.get(ws);
    if (!clientSubscriptions) return;

    switch (message.type) {
      case "subscribe":
        if (message.testId) {
          clientSubscriptions.add(message.testId);
          this.sendMessage(ws, {
            type: "heartbeat",
            data: { message: `Subscribed to test ${message.testId}` },
            timestamp: Date.now(),
          });
        } else {
          this.sendError(ws, "Test ID required for subscription");
        }
        break;

      case "unsubscribe":
        if (message.testId) {
          clientSubscriptions.delete(message.testId);
          this.sendMessage(ws, {
            type: "heartbeat",
            data: { message: `Unsubscribed from test ${message.testId}` },
            timestamp: Date.now(),
          });
        } else {
          this.sendError(ws, "Test ID required for unsubscription");
        }
        break;

      case "heartbeat":
        // Respond to client heartbeat
        this.sendMessage(ws, {
          type: "heartbeat",
          data: { message: "pong" },
          timestamp: Date.now(),
        });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private broadcastToSubscribers(
    testId: string,
    message: WebSocketMessage
  ): void {
    this.clients.forEach((subscriptions, ws) => {
      if (subscriptions.has(testId) && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error sending WebSocket message:", error);
      }
    }
  }

  private sendError(ws: WebSocket, errorMessage: string): void {
    this.sendMessage(ws, {
      type: "error",
      data: { message: errorMessage },
      timestamp: Date.now(),
    });
  }

  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000; // 30 seconds default

    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendMessage(ws, {
            type: "heartbeat",
            data: { message: "ping" },
            timestamp: Date.now(),
          });
        }
      });
    }, interval);
  }
}
