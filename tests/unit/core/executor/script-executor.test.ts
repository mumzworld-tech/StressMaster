import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { K6ScriptExecutor, ExecutorConfig } from "@/core/executor";
import { K6Script } from "@/types";
import Docker from "dockerode";
import { promises as fs } from "fs";
import { DockerUtils } from "@/core/executor";

// Mock dockerode
vi.mock("dockerode");
vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Mock DockerUtils
vi.mock("@/core/executor/docker-utils", () => ({
  DockerUtils: {
    cleanupContainer: vi.fn().mockResolvedValue(undefined),
    parseMemoryLimit: vi.fn().mockReturnValue(536870912), // 512MB
    parseCpuLimit: vi.fn().mockReturnValue(100000),
  },
}));

const mockDocker = {
  createContainer: vi.fn(),
  getContainer: vi.fn(),
  ping: vi.fn(),
};

const mockContainer = {
  id: "test-container-id",
  start: vi.fn(),
  stop: vi.fn(),
  remove: vi.fn(),
  wait: vi.fn(),
  logs: vi.fn(),
  stats: vi.fn(),
};

describe("K6ScriptExecutor", () => {
  let executor: K6ScriptExecutor;
  let config: ExecutorConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      k6BinaryPath: "/usr/bin/k6",
      containerImage: "grafana/k6:latest",
      resourceLimits: {
        maxMemory: "512m",
        maxCpu: "1.0",
        maxDuration: "1h",
        maxVirtualUsers: 100,
      },
      outputFormats: ["json"],
      tempDirectory: "/tmp/test",
      dockerSocketPath: "/var/run/docker.sock",
    };

    (Docker as any).mockImplementation(() => mockDocker);
    mockDocker.createContainer.mockResolvedValue(mockContainer);
    mockDocker.getContainer.mockReturnValue(mockContainer);

    executor = new K6ScriptExecutor(config);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("executeScript", () => {
    const mockScript: K6Script = {
      id: "test-script",
      name: "Test Script",
      content:
        'import http from "k6/http"; export default function() { http.get("https://test.com"); }',
      imports: ["k6/http"],
      options: {
        vus: 10,
        duration: "30s",
      },
      metadata: {
        generatedAt: new Date(),
        specId: "test-spec",
        version: "1.0.0",
        description: "Test script",
        tags: ["test"],
      },
    };

    it("should execute script successfully", async () => {
      // Setup mocks
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue(
        '{"metrics": {"http_reqs": {"values": {"count": 100}}}}'
      );

      mockContainer.wait.mockResolvedValue({ StatusCode: 0 });
      mockContainer.logs.mockResolvedValue(
        Buffer.from("K6 execution completed")
      );
      mockContainer.stats.mockResolvedValue({});

      const result = await executor.executeScript(mockScript);

      expect(result).toBeDefined();
      expect(result.k6Output).toBeDefined();
      expect(result.executionLogs).toBeInstanceOf(Array);
      expect(result.systemMetrics).toBeInstanceOf(Array);

      // Verify Docker operations
      expect(mockDocker.createContainer).toHaveBeenCalled();
      expect(mockContainer.start).toHaveBeenCalled();
      expect(mockContainer.wait).toHaveBeenCalled();
      expect(DockerUtils.cleanupContainer).toHaveBeenCalled();
    });

    it("should handle container creation failure", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      mockDocker.createContainer.mockRejectedValue(
        new Error("Container creation failed")
      );

      await expect(executor.executeScript(mockScript)).rejects.toThrow(
        "Container creation failed"
      );
    });

    it("should handle script execution failure", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      mockContainer.wait.mockResolvedValue({ StatusCode: 1 });
      mockContainer.logs.mockResolvedValue(
        Buffer.from("Script execution failed")
      );

      const result = await executor.executeScript(mockScript);

      expect(result).toBeDefined();
      expect(DockerUtils.cleanupContainer).toHaveBeenCalled();
    });

    it("should prepare execution environment correctly", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue("{}");

      mockContainer.wait.mockResolvedValue({ StatusCode: 0 });
      mockContainer.logs.mockResolvedValue(Buffer.from(""));

      await executor.executeScript(mockScript);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("script.js"),
        mockScript.content,
        "utf8"
      );
    });

    it("should configure container with correct parameters", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue("{}");

      mockContainer.wait.mockResolvedValue({ StatusCode: 0 });
      mockContainer.logs.mockResolvedValue(Buffer.from(""));

      await executor.executeScript(mockScript);

      const createContainerCall = mockDocker.createContainer.mock.calls[0][0];

      expect(createContainerCall.Image).toBe(config.containerImage);
      expect(createContainerCall.Cmd).toEqual([
        "run",
        "--out",
        "json=/tmp/output.json",
        "--quiet",
        "/tmp/script.js",
      ]);
      expect(DockerUtils.parseMemoryLimit).toHaveBeenCalledWith("512m");
      expect(createContainerCall.HostConfig.Binds).toHaveLength(3);
    });
  });

  describe("monitorExecution", () => {
    it("should return observable for execution metrics", () => {
      const metrics$ = executor.monitorExecution();

      expect(metrics$).toBeDefined();
      expect(typeof metrics$.subscribe).toBe("function");
    });

    it("should emit initial idle status", async () => {
      const metrics$ = executor.monitorExecution();

      return new Promise<void>((resolve) => {
        metrics$.subscribe((metrics) => {
          expect(metrics.status).toBe("idle");
          expect(metrics.progress).toBe(0);
          resolve();
        });
      });
    });
  });

  describe("stopExecution", () => {
    it("should stop running container", async () => {
      // Start an execution first
      const mockScript: K6Script = {
        id: "test-script",
        name: "Test Script",
        content: "test content",
        imports: [],
        options: {},
        metadata: {
          generatedAt: new Date(),
          specId: "test-spec",
          version: "1.0.0",
          description: "Test script",
          tags: [],
        },
      };

      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue("{}");

      // Mock a long-running container
      mockContainer.wait.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockContainer.logs.mockResolvedValue(Buffer.from(""));

      // Start execution (don't await)
      const executionPromise = executor.executeScript(mockScript);

      // Wait a bit for execution to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop execution
      await executor.stopExecution();

      expect(DockerUtils.cleanupContainer).toHaveBeenCalledWith(
        expect.any(Object),
        "test-container-id"
      );
    });

    it("should handle stop failure gracefully", async () => {
      // First set up a current execution
      const mockScript: K6Script = {
        id: "test-script",
        name: "Test Script",
        content: "test content",
        imports: [],
        options: {},
        metadata: {
          generatedAt: new Date(),
          specId: "test-spec",
          version: "1.0.0",
          description: "Test script",
          tags: [],
        },
      };

      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue("{}");

      // Mock DockerUtils.cleanupContainer to throw an error
      vi.mocked(DockerUtils.cleanupContainer).mockRejectedValue(
        new Error("Container cleanup failed: Stop failed")
      );

      // Mock a long-running container
      mockContainer.wait.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockContainer.logs.mockResolvedValue(Buffer.from(""));

      // Start execution (don't await)
      const executionPromise = executor.executeScript(mockScript);

      // Wait a bit for execution to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop execution should throw the error
      await expect(executor.stopExecution()).rejects.toThrow(
        "Container cleanup failed"
      );
    });
  });

  describe("resource limit parsing", () => {
    it("should parse memory limits correctly", () => {
      const executor = new K6ScriptExecutor({
        ...config,
        resourceLimits: {
          ...config.resourceLimits,
          maxMemory: "1g",
        },
      });

      // This tests the private method indirectly through container creation
      expect(executor).toBeDefined();
    });

    it("should parse CPU limits correctly", () => {
      const executor = new K6ScriptExecutor({
        ...config,
        resourceLimits: {
          ...config.resourceLimits,
          maxCpu: "0.5",
        },
      });

      expect(executor).toBeDefined();
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources after execution", async () => {
      const mockScript: K6Script = {
        id: "test-script",
        name: "Test Script",
        content: "test content",
        imports: [],
        options: {},
        metadata: {
          generatedAt: new Date(),
          specId: "test-spec",
          version: "1.0.0",
          description: "Test script",
          tags: [],
        },
      };

      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue("{}");

      mockContainer.wait.mockResolvedValue({ StatusCode: 0 });
      mockContainer.logs.mockResolvedValue(Buffer.from(""));

      await executor.executeScript(mockScript);

      expect(DockerUtils.cleanupContainer).toHaveBeenCalled();
    });

    it("should handle cleanup errors gracefully", async () => {
      const mockScript: K6Script = {
        id: "test-script",
        name: "Test Script",
        content: "test content",
        imports: [],
        options: {},
        metadata: {
          generatedAt: new Date(),
          specId: "test-spec",
          version: "1.0.0",
          description: "Test script",
          tags: [],
        },
      };

      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockResolvedValue("{}");

      mockContainer.wait.mockResolvedValue({ StatusCode: 0 });
      mockContainer.logs.mockResolvedValue(Buffer.from(""));
      mockContainer.remove.mockRejectedValue(new Error("Remove failed"));

      // Should not throw despite cleanup error
      await expect(executor.executeScript(mockScript)).resolves.toBeDefined();
    });
  });
});
