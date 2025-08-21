import { describe, it, expect, beforeEach } from "vitest";
import { CommandHistoryManager } from "@/interfaces/cli";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("CommandHistoryManager", () => {
  let history: CommandHistoryManager;
  let tempFile: string;

  beforeEach(() => {
    history = new CommandHistoryManager(5); // Small limit for testing
    tempFile = join(tmpdir(), `test-history-${Date.now()}.json`);
  });

  it("should add entries to history", () => {
    history.addEntry({
      command: "test command",
      result: "success",
      executionTime: 100,
    });

    const entries = history.getHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].command).toBe("test command");
    expect(entries[0].result).toBe("success");
    expect(entries[0].executionTime).toBe(100);
    expect(entries[0].timestamp).toBeInstanceOf(Date);
  });

  it("should maintain max entries limit", () => {
    // Add more entries than the limit
    for (let i = 0; i < 10; i++) {
      history.addEntry({
        command: `command ${i}`,
        result: "success",
        executionTime: 100,
      });
    }

    const entries = history.getHistory();
    expect(entries).toHaveLength(5); // Should be limited to 5
    expect(entries[0].command).toBe("command 9"); // Most recent first
    expect(entries[4].command).toBe("command 5"); // Oldest kept
  });

  it("should search history by command text", () => {
    history.addEntry({
      command: "load test api",
      result: "success",
      executionTime: 100,
    });
    history.addEntry({
      command: "spike test api",
      result: "success",
      executionTime: 150,
    });
    history.addEntry({
      command: "stress test database",
      result: "error",
      executionTime: 200,
    });

    const results = history.searchHistory("test api");
    expect(results).toHaveLength(2);
    expect(results[0].command).toBe("spike test api");
    expect(results[1].command).toBe("load test api");
  });

  it("should get recent commands as strings", () => {
    history.addEntry({
      command: "command 1",
      result: "success",
      executionTime: 100,
    });
    history.addEntry({
      command: "command 2",
      result: "success",
      executionTime: 100,
    });
    history.addEntry({
      command: "command 3",
      result: "success",
      executionTime: 100,
    });

    const recent = history.getRecentCommands(2);
    expect(recent).toEqual(["command 3", "command 2"]);
  });

  it("should filter successful and failed commands", () => {
    history.addEntry({
      command: "success 1",
      result: "success",
      executionTime: 100,
    });
    history.addEntry({
      command: "error 1",
      result: "error",
      executionTime: 100,
    });
    history.addEntry({
      command: "success 2",
      result: "success",
      executionTime: 100,
    });

    const successful = history.getSuccessfulCommands();
    const failed = history.getFailedCommands();

    expect(successful).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(successful[0].command).toBe("success 2");
    expect(failed[0].command).toBe("error 1");
  });

  it("should calculate average execution time", () => {
    history.addEntry({
      command: "cmd 1",
      result: "success",
      executionTime: 100,
    });
    history.addEntry({
      command: "cmd 2",
      result: "success",
      executionTime: 200,
    });
    history.addEntry({
      command: "cmd 3",
      result: "success",
      executionTime: 300,
    });

    const average = history.getAverageExecutionTime();
    expect(average).toBe(200);
  });

  it("should clear history", () => {
    history.addEntry({
      command: "test",
      result: "success",
      executionTime: 100,
    });
    expect(history.getHistory()).toHaveLength(1);

    history.clearHistory();
    expect(history.getHistory()).toHaveLength(0);
  });

  it("should save and load history from file", async () => {
    history.addEntry({
      command: "test command",
      result: "success",
      executionTime: 100,
    });

    await history.saveToFile(tempFile);

    const newHistory = new CommandHistoryManager();
    await newHistory.loadFromFile(tempFile);

    const entries = newHistory.getHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].command).toBe("test command");

    // Cleanup
    await fs.unlink(tempFile).catch(() => {});
  });

  it("should handle missing history file gracefully", async () => {
    const nonExistentFile = join(tmpdir(), "non-existent-file.json");

    await expect(history.loadFromFile(nonExistentFile)).resolves.not.toThrow();
    expect(history.getHistory()).toHaveLength(0);
  });
});
