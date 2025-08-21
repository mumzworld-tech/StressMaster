import { promises as fs } from "fs";
import { CommandHistory, HistoryEntry } from "./cli-interface";

export class CommandHistoryManager implements CommandHistory {
  public commands: HistoryEntry[] = [];
  public maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  addEntry(entry: Omit<HistoryEntry, "timestamp">): void {
    const historyEntry: HistoryEntry = {
      ...entry,
      timestamp: new Date(),
    };

    this.commands.unshift(historyEntry);

    // Keep only the most recent entries
    if (this.commands.length > this.maxEntries) {
      this.commands = this.commands.slice(0, this.maxEntries);
    }
  }

  getHistory(): HistoryEntry[] {
    return [...this.commands];
  }

  searchHistory(query: string): HistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.commands.filter((entry) =>
      entry.command.toLowerCase().includes(lowerQuery)
    );
  }

  clearHistory(): void {
    this.commands = [];
  }

  async saveToFile(filePath: string): Promise<void> {
    try {
      const data = JSON.stringify(this.commands, null, 2);
      await fs.writeFile(filePath, data, "utf-8");
    } catch (error) {
      throw new Error(`Failed to save history to ${filePath}: ${error}`);
    }
  }

  async loadFromFile(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, "utf-8");
      const parsedHistory = JSON.parse(data) as HistoryEntry[];

      // Validate and convert timestamps
      this.commands = parsedHistory
        .map((entry) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }))
        .slice(0, this.maxEntries);
    } catch (error) {
      // If file doesn't exist or is invalid, start with empty history
      this.commands = [];
    }
  }

  getRecentCommands(limit: number = 10): string[] {
    return this.commands.slice(0, limit).map((entry) => entry.command);
  }

  getSuccessfulCommands(): HistoryEntry[] {
    return this.commands.filter((entry) => entry.result === "success");
  }

  getFailedCommands(): HistoryEntry[] {
    return this.commands.filter((entry) => entry.result === "error");
  }

  getAverageExecutionTime(): number {
    if (this.commands.length === 0) return 0;

    const totalTime = this.commands.reduce(
      (sum, entry) => sum + entry.executionTime,
      0
    );
    return totalTime / this.commands.length;
  }
}
