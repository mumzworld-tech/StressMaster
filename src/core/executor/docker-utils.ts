import Docker from "dockerode";
import { ExecutorConfig } from "./script-executor";

export interface DockerContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
}

export class DockerUtils {
  static async createDockerClient(socketPath?: string): Promise<Docker> {
    const docker = new Docker({
      socketPath: socketPath || "/var/run/docker.sock",
    });

    // Validate connection
    await docker.ping();
    return docker;
  }

  static async validateDockerConnection(config: ExecutorConfig): Promise<void> {
    try {
      const docker = await this.createDockerClient(config.dockerSocketPath);
      await docker.ping();
    } catch (error) {
      throw new Error(
        `Docker connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  static async ensureImage(docker: Docker, imageName: string): Promise<void> {
    try {
      await docker.getImage(imageName).inspect();
      return; // Image exists
    } catch (error) {
      // Image doesn't exist, pull it
    }

    console.log(`Pulling Docker image: ${imageName}`);
    const stream = await docker.pull(imageName);

    return new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => {
        if (err) {
          reject(new Error(`Failed to pull image: ${err.message}`));
        } else {
          console.log(`Successfully pulled image: ${imageName}`);
          resolve();
        }
      });
    });
  }

  static calculateCpuUsage(stats: any): number {
    if (!stats.cpu_stats || !stats.precpu_stats) return 0;

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const numberCpus = stats.cpu_stats.online_cpus || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      return (cpuDelta / systemDelta) * numberCpus * 100;
    }
    return 0;
  }

  static parseContainerStats(stats: any): DockerContainerStats {
    const cpuUsage = this.calculateCpuUsage(stats);
    const memoryUsage = stats.memory_stats?.usage || 0;
    const networkRx = stats.networks?.eth0?.rx_bytes || 0;
    const networkTx = stats.networks?.eth0?.tx_bytes || 0;

    return {
      cpuUsage,
      memoryUsage,
      networkIO: {
        bytesIn: networkRx,
        bytesOut: networkTx,
      },
    };
  }

  static parseMemoryLimit(memoryLimit: string): number {
    const match = memoryLimit.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 512 * 1024 * 1024; // Default 512MB

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case "k":
        return value * 1024;
      case "m":
        return value * 1024 * 1024;
      case "g":
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  static parseCpuLimit(cpuLimit: string): number {
    const cpuValue = parseFloat(cpuLimit);
    return Math.floor(cpuValue * 100000); // Docker CPU quota is in microseconds
  }

  static async cleanupContainer(
    docker: Docker,
    containerId: string
  ): Promise<void> {
    try {
      const container = docker.getContainer(containerId);

      // Try to stop container if still running
      try {
        await container.stop({ t: 5 });
      } catch (error) {
        // Container might already be stopped
      }

      // Remove container
      await container.remove({ force: true });
    } catch (error) {
      throw new Error(
        `Container cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  static async killContainer(
    docker: Docker,
    containerId: string
  ): Promise<void> {
    const container = docker.getContainer(containerId);

    // Graceful shutdown first
    await container.kill("SIGTERM");

    // Wait for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Force kill if still running
    try {
      const containerInfo = await container.inspect();
      if (containerInfo.State.Running) {
        await container.kill("SIGKILL");
      }
    } catch (error) {
      // Container might already be stopped
    }
  }
}
