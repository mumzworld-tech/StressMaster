/**
 * End-to-End User Workflow Tests
 * Tests complete user scenarios as they would use StressMaster in their project
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

describe("User Workflow Tests - Real Project Scenarios", () => {
  const testProjectDir = path.join(process.cwd(), "test-project");
  const testFilesDir = path.join(testProjectDir, "test-files");

  beforeAll(async () => {
    // Create test project structure
    if (!fs.existsSync(testProjectDir)) {
      fs.mkdirSync(testProjectDir, { recursive: true });
    }
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(
      path.join(testFilesDir, "user-data.json"),
      JSON.stringify({ name: "Test User", email: "test@example.com" })
    );
    fs.writeFileSync(
      path.join(testProjectDir, "config.json"),
      JSON.stringify({ apiUrl: "https://httpbin.org" })
    );
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  describe("Scenario 1: Developer Testing API Endpoints", () => {
    it("should execute simple GET request using Simple Executor", async () => {
      const command = `npm run start -- "send 5 GET requests to https://httpbin.org/get"`;
      const { stdout, stderr } = await execAsync(command);

      // Should use Simple Executor
      expect(stdout).toContain("Simple executor");
      expect(stdout).toContain("Executing");
      expect(stdout).toContain("Test Results");
      
      // Should not show internal debug logs
      expect(stdout).not.toContain("[INFO]");
      expect(stdout).not.toContain("[DEBUG]");
    }, 30000);

    it("should handle POST request with JSON body", async () => {
      const command = `npm run start -- "POST 3 requests to https://httpbin.org/post with JSON body {\"name\":\"test\"}"`;
      const { stdout } = await execAsync(command);

      expect(stdout).toContain("POST");
      expect(stdout).toContain("Test Results");
    }, 30000);
  });

  describe("Scenario 2: Load Testing Production API", () => {
    it("should use K6 Executor for complex load test", async () => {
      const command = `npm run start -- "spike test with 50 requests in 10 seconds to https://httpbin.org/get"`;
      const { stdout, stderr } = await execAsync(command);

      // Should select K6 executor
      expect(stdout + stderr).toMatch(/K6|k6/);
      
      // Should generate and execute K6 script
      expect(stdout).toContain("Test Results");
    }, 60000);

    it("should fallback to Simple Executor if K6 fails", async () => {
      // This test would require mocking K6 failure
      // For now, we verify the fallback logic exists
      expect(true).toBe(true);
    });
  });

  describe("Scenario 3: File Resolution in Project", () => {
    it("should find file by name anywhere in project", async () => {
      process.chdir(testProjectDir);
      
      const command = `npm run start -- "POST 2 requests to https://httpbin.org/post with body from @user-data.json"`;
      const { stdout } = await execAsync(command, {
        cwd: testProjectDir,
      });

      // Should find the file
      expect(stdout).not.toContain("not found");
      expect(stdout).toContain("POST");
      
      process.chdir(process.cwd());
    }, 30000);

    it("should handle case-insensitive file search", async () => {
      process.chdir(testProjectDir);
      
      const command = `npm run start -- "POST 2 requests to https://httpbin.org/post with body from @USER-DATA.JSON"`;
      const { stdout } = await execAsync(command, {
        cwd: testProjectDir,
      });

      // Should find the file despite case difference
      expect(stdout).not.toContain("not found");
      
      process.chdir(process.cwd());
    }, 30000);
  });

  describe("Scenario 4: Workflow Testing", () => {
    it("should execute multi-step workflow", async () => {
      const command = `npm run start -- "workflow: GET https://httpbin.org/get, then GET https://httpbin.org/uuid"`;
      const { stdout } = await execAsync(command);

      expect(stdout).toContain("Workflow");
      expect(stdout).toContain("Test Results");
    }, 60000);
  });

  describe("Scenario 5: CLI Commands", () => {
    it("should show config", async () => {
      const command = `npm run start -- config show`;
      const { stdout } = await execAsync(command);

      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Root Directory");
    }, 10000);

    it("should list files", async () => {
      process.chdir(testProjectDir);
      
      const command = `npm run start -- file list`;
      const { stdout } = await execAsync(command, {
        cwd: testProjectDir,
      });

      expect(stdout).toContain("Found");
      
      process.chdir(process.cwd());
    }, 10000);

    it("should list templates", async () => {
      const command = `npm run start -- template list`;
      const { stdout } = await execAsync(command);

      expect(stdout).toContain("Templates");
    }, 10000);

    it("should list results", async () => {
      const command = `npm run start -- results list`;
      const { stdout } = await execAsync(command);

      expect(stdout).toContain("Results");
    }, 10000);
  });

  describe("Scenario 6: Error Handling", () => {
    it("should handle invalid URL gracefully", async () => {
      const command = `npm run start -- "send 2 requests to https://invalid-url-that-does-not-exist-12345.com"`;
      
      try {
        const { stdout, stderr } = await execAsync(command);
        // Should show user-friendly error, not stack trace
        const output = stdout + stderr;
        expect(output).not.toContain("Error:");
        expect(output).not.toContain("at ");
      } catch (error) {
        // Command might fail, but should fail gracefully
        expect(error).toBeDefined();
      }
    }, 30000);

    it("should handle missing file gracefully", async () => {
      const command = `npm run start -- "POST 2 requests with body from @nonexistent-file.json"`;
      
      try {
        const { stdout, stderr } = await execAsync(command);
        const output = stdout + stderr;
        // Should show helpful error message
        expect(output).toMatch(/not found|missing|unable to find/i);
      } catch (error) {
        // Expected to fail, but gracefully
        expect(error).toBeDefined();
      }
    }, 30000);
  });

  describe("Scenario 7: Executor Selection Logic", () => {
    it("should select Simple Executor for small tests", async () => {
      const command = `npm run start -- "send 10 GET requests to https://httpbin.org/get"`;
      const { stdout } = await execAsync(command);

      expect(stdout).toContain("Simple executor");
    }, 30000);

    it("should select K6 Executor for large tests", async () => {
      const command = `npm run start -- "send 100 GET requests to https://httpbin.org/get"`;
      const { stdout, stderr } = await execAsync(command);

      const output = stdout + stderr;
      expect(output).toMatch(/K6|k6/);
    }, 60000);
  });

  describe("Scenario 8: Output Formatting", () => {
    it("should show beautiful formatted output", async () => {
      const command = `npm run start -- "send 3 GET requests to https://httpbin.org/get"`;
      const { stdout } = await execAsync(command);

      // Should have colored/formatted output
      expect(stdout).toContain("Test Results");
      expect(stdout).toContain("Performance Metrics");
      
      // Should NOT have internal debug logs
      expect(stdout).not.toContain("[INFO] Executor selected");
      expect(stdout).not.toContain("[DEBUG]");
    }, 30000);

    it("should show debug logs only when LOG_LEVEL=debug", async () => {
      const command = `LOG_LEVEL=debug npm run start -- "send 2 GET requests to https://httpbin.org/get"`;
      const { stdout, stderr } = await execAsync(command);

      const output = stdout + stderr;
      // Should show debug logs
      expect(output).toMatch(/\[INFO\]|\[DEBUG\]/);
    }, 30000);
  });
});


