import express from "express";
import cors from "cors";
import { UnifiedCommandParser } from "./src/core/parser/command/parser";
import { SmartLoadExecutor } from "./src/core/executor/smart-executor";

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Initialize StressMaster components
const parser = new UnifiedCommandParser();
const executor = new SmartLoadExecutor();

async function initializeBackend() {
  try {
    console.log("🔧 Initializing UnifiedCommandParser...");
    await parser.initialize();
    console.log("✅ Parser initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize parser:", error);
    process.exit(1);
  }
}

// API Routes
app.post("/api/loadtest/execute", async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: "Command is required" });
    }

    console.log("🚀 Backend: Received load test request:", { command });

    let spec;

    // If it's a natural language string, parse it with your real parser
    console.log("📝 Parsing natural language command:", command);

    spec = await parser.parseCommand(command);
    console.log("✅ Parsed with real parser:", spec);

    // Execute the test using the smart executor
    const result = await executor.executeLoadTest(spec);
    console.log("✅ Backend execution completed:", result);

    res.json({
      testId: result.id,
      status: result.status,
      results: result,
    });
  } catch (error) {
    console.error("❌ Backend execution error:", error);
    res.status(500).json({
      error: "Failed to execute load test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/loadtest/status/:testId", (req, res) => {
  const { testId } = req.params;

  // For now, return a simple status
  // In a real implementation, you'd track test status
  res.json({
    testId,
    status: "completed",
    progress: 100,
    results: {
      id: testId,
      status: "completed",
      startTime: new Date(),
      endTime: new Date(),
      metrics: {
        totalRequests: 5,
        successfulRequests: 5,
        failedRequests: 0,
        averageResponseTime: 500,
        p95ResponseTime: 800,
        p99ResponseTime: 1000,
        requestsPerSecond: 1,
      },
      errors: [],
    },
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
  await initializeBackend();

  app.listen(PORT, () => {
    console.log("🚀 Starting StressMaster Backend Server...");
    console.log(`🚀 StressMaster Backend Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
