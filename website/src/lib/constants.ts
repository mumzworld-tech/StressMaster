import {
  MessageSquare,
  Bot,
  Zap,
  Activity,
  BarChart3,
  Download,
  Layers,
  Globe,
} from "lucide-react";

export const GITHUB_REPO_URL = "https://github.com/mumzworld-tech/StressMaster";
export const GITHUB_API_URL =
  "https://api.github.com/repos/mumzworld-tech/StressMaster";
export const NPM_PACKAGE = "stressmaster";
export const NPM_URL = "https://www.npmjs.com/package/stressmaster";

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "CLI", href: "#cli-demo" },
  { label: "Install", href: "#installation" },
] as const;

export const FEATURES = [
  {
    icon: MessageSquare,
    title: "Natural Language",
    description:
      "Describe tests in plain English. No scripting required.",
    color: "red" as const,
  },
  {
    icon: Bot,
    title: "Multi-Provider AI",
    description:
      "Claude, OpenAI, Gemini, and OpenRouter support.",
    color: "blue" as const,
  },
  {
    icon: Zap,
    title: "Dual Execution Engine",
    description: "Built-in executor for instant tests, plus K6 integration for advanced scenarios.",
    color: "red" as const,
  },
  {
    icon: Activity,
    title: "Real-time Monitoring",
    description:
      "Live progress tracking and metrics dashboard.",
    color: "blue" as const,
  },
  {
    icon: BarChart3,
    title: "Smart Analysis",
    description:
      "AI-powered recommendations and bottleneck detection.",
    color: "red" as const,
  },
  {
    icon: Download,
    title: "Export Anywhere",
    description:
      "JSON, CSV, and HTML reports with one command.",
    color: "blue" as const,
  },
  {
    icon: Layers,
    title: "Multiple Test Types",
    description:
      "Spike, stress, endurance, volume, and baseline.",
    color: "red" as const,
  },
  {
    icon: Globe,
    title: "OpenAPI Support",
    description:
      "Parse OpenAPI specs and auto-generate test scenarios.",
    color: "blue" as const,
  },
] as const;

export const ARCHITECTURE_STEPS = [
  {
    title: "User Input",
    subtitle: "Natural Language",
    description: "Describe your test in plain English",
    icon: MessageSquare,
    color: "red" as const,
  },
  {
    title: "AI Parser",
    subtitle: "Multi-Provider",
    description: "Claude, OpenAI, Gemini, or OpenRouter",
    icon: Bot,
    color: "blue" as const,
  },
  {
    title: "Script Generator",
    subtitle: "K6 + Built-in",
    description: "Generates production-ready load test scripts",
    icon: Zap,
    color: "red" as const,
  },
  {
    title: "Orchestrator",
    subtitle: "Test Manager",
    description: "Manages execution flow and configuration",
    icon: Layers,
    color: "blue" as const,
  },
  {
    title: "Test Executor",
    subtitle: "Dual Engine",
    description: "Built-in executor or K6 runtime with live monitoring",
    icon: Activity,
    color: "red" as const,
  },
  {
    title: "Results",
    subtitle: "Analysis & Reports",
    description: "AI-powered insights and recommendations",
    icon: BarChart3,
    color: "blue" as const,
  },
] as const;

export const PROVIDERS = [
  {
    provider: "OpenAI",
    model: "GPT-3.5-turbo",
    cost: "$0.0015/1K tokens",
    performance: "Excellent" as const,
    setup: "Easy",
  },
  {
    provider: "OpenAI",
    model: "GPT-4",
    cost: "$0.03/1K tokens",
    performance: "Best" as const,
    setup: "Easy",
  },
  {
    provider: "Anthropic",
    model: "Claude 3 Sonnet",
    cost: "$0.003/1K tokens",
    performance: "Excellent" as const,
    setup: "Easy",
  },
  {
    provider: "Google",
    model: "Gemini Pro",
    cost: "$0.0005/1K tokens",
    performance: "Good" as const,
    setup: "Easy",
  },
] as const;

export const CLI_EXAMPLES = [
  'stressmaster "send 50 GET requests to https://httpbin.org/get"',
  'stressmaster "stress test https://api.example.com/users with 200 concurrent users"',
  'stressmaster "run a spike test on https://myapp.com/api for 2 minutes"',
  'stressmaster "send 100 POST requests with JSON body to https://api.example.com/data"',
] as const;

export const CLI_DEMO_OUTPUT = `$ stressmaster "send 50 GET requests to https://httpbin.org/get"

  Parsing command with AI...
  Generated K6 script
  Executing load test...

+-----------------------------------------+
|        Test Results Summary              |
+-----------------------------------------+
| Total Requests:     50                   |
| Success Rate:       98%                  |
| Avg Response Time:  142ms                |
| P95 Response Time:  380ms                |
| Requests/sec:       16.7                 |
+-----------------------------------------+

  AI Analysis: Performance is within acceptable range.`;

export const METRICS_DATA = {
  responseTimes: [
    { label: "Min", value: "12ms", color: "text-green-400" },
    { label: "Avg", value: "86ms", color: "text-blue-400" },
    { label: "P50 (Median)", value: "74ms", color: "text-blue-400" },
    { label: "P90", value: "185ms", color: "text-yellow-400" },
    { label: "P95", value: "240ms", color: "text-orange-400" },
    { label: "P99", value: "410ms", color: "text-red-400" },
    { label: "Max", value: "620ms", color: "text-red-500" },
  ],
  throughput: [
    { label: "Requests/sec", value: "245.8", color: "text-blue-400" },
    { label: "Data Transfer", value: "1.2MB/s", color: "text-blue-400" },
    { label: "Iterations", value: "14,748", color: "text-green-400" },
  ],
  errors: [
    { label: "Success Rate", value: "99.2%", color: "text-green-400" },
    { label: "Failed Requests", value: "118", color: "text-red-400" },
    { label: "Timeouts", value: "23", color: "text-yellow-400" },
    { label: "HTTP 5xx", value: "95", color: "text-red-400" },
  ],
  resources: [
    { label: "VUs (Peak)", value: "200", color: "text-blue-400" },
    { label: "Test Duration", value: "60s", color: "text-white/70" },
    { label: "CPU Usage", value: "18%", color: "text-green-400" },
    { label: "Memory", value: "64MB", color: "text-green-400" },
  ],
} as const;

export const INSTALLATION_TABS = {
  npm: {
    label: "NPM",
    commands: ["npm install -g stressmaster"],
  },
  source: {
    label: "From Source",
    commands: [
      "git clone https://github.com/mumzworld-tech/StressMaster.git",
      "cd StressMaster",
      "npm install",
      "npm run build",
    ],
  },
  dev: {
    label: "Development",
    commands: [
      "git clone https://github.com/mumzworld-tech/StressMaster.git",
      "cd StressMaster",
      "npm install",
      "npm link",
    ],
  },
} as const;

export const FOOTER_LINKS = [
  { label: "GitHub", href: GITHUB_REPO_URL },
  { label: "npm", href: NPM_URL },
  {
    label: "Documentation",
    href: `${GITHUB_REPO_URL}#readme`,
  },
  { label: "Issues", href: `${GITHUB_REPO_URL}/issues` },
] as const;
