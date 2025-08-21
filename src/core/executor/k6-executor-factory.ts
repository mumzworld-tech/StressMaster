import { K6ScriptExecutor, ExecutorConfig } from "./script-executor";
import { MonitoringConfig } from "./execution-monitor";
import { WebSocketMonitorConfig } from "./websocket-monitor";
import { DockerUtils } from "./docker-utils";
import path from "path";
import { promises as fs } from "fs";

export class K6ExecutorFactory {
  private static defaultConfig: ExecutorConfig = {
    k6BinaryPath: "/usr/bin/k6",
    containerImage: "grafana/k6:latest",
    resourceLimits: {
      maxMemory: "512m",
      maxCpu: "1.0",
      maxDuration: "1h",
      maxVirtualUsers: 1000,
    },
    outputFormats: ["json"],
    tempDirectory: "/tmp/k6-executions",
    dockerSocketPath: "/var/run/docker.sock",
    monitoring: {
      updateInterval: 1000, // 1 second
      resourceThresholds: {
        maxMemoryUsage: 80, // 80%
        maxCpuUsage: 90, // 90%
        maxNetworkIO: 100 * 1024 * 1024, // 100 MB/s
      },
      enableWebSocket: true,
      webSocketPort:
        process.env.NODE_ENV === "test"
          ? Math.floor(Math.random() * 10000) + 10000
          : 8080,
    },
    webSocket:
      process.env.NODE_ENV === "test"
        ? undefined
        : {
            port: 8080,
            path: "/monitor",
            heartbeatInterval: 30000, // 30 seconds
          },
  };

  static async createExecutor(
    config?: Partial<ExecutorConfig>
  ): Promise<K6ScriptExecutor> {
    const finalConfig = { ...this.defaultConfig, ...config };

    // Ensure temp directory exists
    await fs.mkdir(finalConfig.tempDirectory, { recursive: true });

    // Validate Docker connection
    await this.validateDockerConnection(finalConfig);

    // Pull K6 image if not present
    await this.ensureK6Image(finalConfig);

    return new K6ScriptExecutor(finalConfig);
  }

  private static async validateDockerConnection(
    config: ExecutorConfig
  ): Promise<void> {
    await DockerUtils.validateDockerConnection(config);
  }

  private static async ensureK6Image(config: ExecutorConfig): Promise<void> {
    const docker = await DockerUtils.createDockerClient(
      config.dockerSocketPath
    );
    await DockerUtils.ensureImage(docker, config.containerImage);
  }

  static getDefaultConfig(): ExecutorConfig {
    return { ...this.defaultConfig };
  }
}
