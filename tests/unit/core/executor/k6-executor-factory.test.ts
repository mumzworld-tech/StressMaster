import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { K6ExecutorFactory } from "@/core/executor";
import { K6ScriptExecutor } from "@/core/executor";
import Docker from "dockerode";
import { promises as fs } from "fs";

// Mock dependencies
vi.mock("dockerode");
vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn(),
  },
}));

const mockDocker = {
  ping: vi.fn(),
  getImage: vi.fn(),
  pull: vi.fn(),
  modem: {
    followProgress: vi.fn(),
  },
};

const mockImage = {
  inspect: vi.fn(),
};

describe("K6ExecutorFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Docker as any).mockImplementation(() => mockDocker);
    mockDocker.getImage.mockReturnValue(mockImage);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createExecutor", () => {
    it("should create executor with default config", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockResolvedValue(undefined);
      mockImage.inspect.mockResolvedValue({}); // Image exists

      const executor = await K6ExecutorFactory.createExecutor();

      expect(executor).toBeInstanceOf(K6ScriptExecutor);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    it("should create executor with custom config", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockResolvedValue(undefined);
      mockImage.inspect.mockResolvedValue({});

      const customConfig = {
        containerImage: "custom/k6:latest",
        tempDirectory: "/custom/temp",
      };

      const executor = await K6ExecutorFactory.createExecutor(customConfig);

      expect(executor).toBeInstanceOf(K6ScriptExecutor);
      expect(fs.mkdir).toHaveBeenCalledWith("/custom/temp", {
        recursive: true,
      });
    });

    it("should fail if Docker connection fails", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockRejectedValue(new Error("Docker not available"));

      await expect(K6ExecutorFactory.createExecutor()).rejects.toThrow(
        "Docker connection failed"
      );
    });

    it("should pull K6 image if not present", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockResolvedValue(undefined);
      mockImage.inspect.mockRejectedValue(new Error("Image not found"));

      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation((stream, callback) => {
        callback(null, []);
      });

      const executor = await K6ExecutorFactory.createExecutor();

      expect(executor).toBeInstanceOf(K6ScriptExecutor);
      expect(mockDocker.pull).toHaveBeenCalledWith("grafana/k6:latest");
      expect(mockDocker.modem.followProgress).toHaveBeenCalled();
    });

    it("should handle image pull failure", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockResolvedValue(undefined);
      mockImage.inspect.mockRejectedValue(new Error("Image not found"));

      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation((stream, callback) => {
        callback(new Error("Pull failed"), null);
      });

      await expect(K6ExecutorFactory.createExecutor()).rejects.toThrow(
        "Failed to pull image"
      );
    });

    it("should handle temp directory creation failure", async () => {
      (fs.mkdir as any).mockRejectedValue(new Error("Permission denied"));

      await expect(K6ExecutorFactory.createExecutor()).rejects.toThrow(
        "Permission denied"
      );
    });
  });

  describe("getDefaultConfig", () => {
    it("should return default configuration", () => {
      const config = K6ExecutorFactory.getDefaultConfig();

      expect(config).toBeDefined();
      expect(config.containerImage).toBe("grafana/k6:latest");
      expect(config.resourceLimits.maxMemory).toBe("512m");
      expect(config.resourceLimits.maxCpu).toBe("1.0");
      expect(config.resourceLimits.maxVirtualUsers).toBe(1000);
      expect(config.tempDirectory).toBe("/tmp/k6-executions");
    });

    it("should return a copy of the config", () => {
      const config1 = K6ExecutorFactory.getDefaultConfig();
      const config2 = K6ExecutorFactory.getDefaultConfig();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same content
    });
  });

  describe("validateDockerConnection", () => {
    it("should validate Docker connection successfully", async () => {
      mockDocker.ping.mockResolvedValue(undefined);

      // This is tested indirectly through createExecutor
      await expect(K6ExecutorFactory.createExecutor()).resolves.toBeDefined();
    });

    it("should fail validation if Docker is not available", async () => {
      mockDocker.ping.mockRejectedValue(new Error("Connection refused"));

      await expect(K6ExecutorFactory.createExecutor()).rejects.toThrow(
        "Docker connection failed"
      );
    });
  });

  describe("ensureK6Image", () => {
    it("should skip pull if image exists", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockResolvedValue(undefined);
      mockImage.inspect.mockResolvedValue({}); // Image exists

      await K6ExecutorFactory.createExecutor();

      expect(mockDocker.pull).not.toHaveBeenCalled();
    });

    it("should pull image if it does not exist", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockResolvedValue(undefined);
      mockImage.inspect.mockRejectedValue(new Error("Not found"));

      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation((stream, callback) => {
        callback(null, []);
      });

      await K6ExecutorFactory.createExecutor();

      expect(mockDocker.pull).toHaveBeenCalledWith("grafana/k6:latest");
    });

    it("should handle pull progress correctly", async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      mockDocker.ping.mockResolvedValue(undefined);
      mockImage.inspect.mockRejectedValue(new Error("Not found"));

      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);

      let progressCallback: Function;
      mockDocker.modem.followProgress.mockImplementation((stream, callback) => {
        progressCallback = callback;
        // Simulate successful pull
        setTimeout(() => callback(null, []), 10);
      });

      await K6ExecutorFactory.createExecutor();

      expect(mockDocker.modem.followProgress).toHaveBeenCalledWith(
        mockStream,
        expect.any(Function)
      );
    });
  });
});
