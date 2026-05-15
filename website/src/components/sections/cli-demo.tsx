"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView } from "motion/react";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";

interface DemoLine {
  text: string;
  type: "command" | "blank" | "info" | "success" | "border" | "header" | "data";
}

interface DemoScenario {
  label: string;
  command: string;
  lines: DemoLine[];
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    label: "GET Requests",
    command: 'stressmaster "send 50 GET requests to https://httpbin.org/get"',
    lines: [
      { text: "", type: "blank" },
      { text: "  Parsing command with AI...", type: "info" },
      { text: "  Generated load test script", type: "success" },
      { text: "  Executing load test...", type: "success" },
      { text: "", type: "blank" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "|        Test Results Summary              |", type: "header" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "| Total Requests:     50                   |", type: "data" },
      { text: "| Success Rate:       98%                  |", type: "data" },
      { text: "| Avg Response Time:  142ms                |", type: "data" },
      { text: "| P95 Response Time:  380ms                |", type: "data" },
      { text: "| Requests/sec:       16.7                 |", type: "data" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "", type: "blank" },
      { text: "  AI Analysis: Performance is within acceptable range.", type: "success" },
    ],
  },
  {
    label: "Stress Test",
    command: 'stressmaster "stress test https://api.example.com/users with 200 concurrent users"',
    lines: [
      { text: "", type: "blank" },
      { text: "  Parsing command with AI...", type: "info" },
      { text: "  Detected: Stress Test (200 VUs, ramp-up)", type: "info" },
      { text: "  Generated load test script", type: "success" },
      { text: "  Executing stress test...", type: "success" },
      { text: "", type: "blank" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "|        Stress Test Results               |", type: "header" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "| Peak VUs:           200                  |", type: "data" },
      { text: "| Total Requests:     12,480               |", type: "data" },
      { text: "| Success Rate:       94.2%                |", type: "data" },
      { text: "| Avg Response Time:  287ms                |", type: "data" },
      { text: "| P99 Response Time:  1,420ms              |", type: "data" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "", type: "blank" },
      { text: "  AI Analysis: Degradation detected above 150 VUs. Consider scaling.", type: "info" },
    ],
  },
  {
    label: "Spike Test",
    command: 'stressmaster "run a spike test on https://myapp.com/api for 2 minutes"',
    lines: [
      { text: "", type: "blank" },
      { text: "  Parsing command with AI...", type: "info" },
      { text: "  Detected: Spike Test (2m duration)", type: "info" },
      { text: "  Generated load test script", type: "success" },
      { text: "  Executing spike test...", type: "success" },
      { text: "", type: "blank" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "|        Spike Test Results                |", type: "header" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "| Spike Peak:         500 req/s            |", type: "data" },
      { text: "| Total Requests:     8,240                |", type: "data" },
      { text: "| Success Rate:       96.8%                |", type: "data" },
      { text: "| Recovery Time:      4.2s                 |", type: "data" },
      { text: "| Errors at Peak:     3.2%                 |", type: "data" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "", type: "blank" },
      { text: "  AI Analysis: System recovered within 5s. Spike resilience is good.", type: "success" },
    ],
  },
  {
    label: "POST Requests",
    command: 'stressmaster "send 100 POST requests with JSON body to https://api.example.com/data"',
    lines: [
      { text: "", type: "blank" },
      { text: "  Parsing command with AI...", type: "info" },
      { text: "  Detected: POST with JSON payload", type: "info" },
      { text: "  Generated load test script with dynamic payloads", type: "success" },
      { text: "  Executing load test...", type: "success" },
      { text: "", type: "blank" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "|        Test Results Summary              |", type: "header" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "| Total Requests:     100                  |", type: "data" },
      { text: "| Success Rate:       100%                 |", type: "data" },
      { text: "| Avg Response Time:  98ms                 |", type: "data" },
      { text: "| P95 Response Time:  210ms                |", type: "data" },
      { text: "| Data Sent:          245KB                |", type: "data" },
      { text: "+-----------------------------------------+", type: "border" },
      { text: "", type: "blank" },
      { text: "  AI Analysis: Excellent throughput. All requests succeeded.", type: "success" },
    ],
  },
];

function getLineColor(type: string) {
  switch (type) {
    case "command":
      return "text-green-400";
    case "info":
      return "text-yellow-400";
    case "success":
      return "text-green-400";
    case "border":
      return "text-white/30";
    case "header":
      return "text-white/80";
    case "data":
      return "text-blue-300";
    default:
      return "text-white/60";
  }
}

export function CliDemo() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [activeScenario, setActiveScenario] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [typedCommand, setTypedCommand] = useState("");
  const [phase, setPhase] = useState<"idle" | "typing" | "output">("idle");

  const scenario = DEMO_SCENARIOS[activeScenario];
  const fullCommand = `$ ${scenario.command}`;

  // Start typing when section comes into view
  useEffect(() => {
    if (isInView && phase === "idle") {
      setPhase("typing");
    }
  }, [isInView, phase]);

  // Typing animation for the command
  useEffect(() => {
    if (phase !== "typing") return;

    let index = 0;
    setTypedCommand("");
    setVisibleLines(0);

    const interval = setInterval(() => {
      if (index < fullCommand.length) {
        setTypedCommand(fullCommand.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        // Small pause before showing output
        setTimeout(() => setPhase("output"), 400);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [phase, fullCommand]);

  // Output lines animation
  useEffect(() => {
    if (phase !== "output") return;

    setVisibleLines(0);
    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= scenario.lines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [phase, scenario.lines.length]);

  const handleExampleClick = useCallback(
    (index: number) => {
      if (index === activeScenario && phase !== "idle") return;
      setActiveScenario(index);
      setPhase("typing");
    },
    [activeScenario, phase]
  );

  return (
    <Section id="cli-demo">
      <Container>
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center mb-16 sm:mb-20"
        >
          <Heading as="h2" className="mb-4">
            Or run it from the terminal
          </Heading>
          <Paragraph size="lg" muted className="max-w-2xl mx-auto">
            Prefer the original CLI? It still works exactly how you remember —
            natural language in, K6-grade load test out.
          </Paragraph>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            delay: 0.2,
            duration: 0.7,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="max-w-3xl mx-auto"
        >
          {/* Example command tabs */}
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {DEMO_SCENARIOS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => handleExampleClick(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  i === activeScenario
                    ? "bg-red-500/10 border border-red-500/30 text-red-400"
                    : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Terminal */}
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-red-500/10 to-blue-500/10 rounded-3xl blur-2xl" />
            <div className="relative glass rounded-2xl overflow-hidden glow-red">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-white/30 font-[family-name:var(--font-jetbrains-mono)] ml-2">
                  stressmaster
                </span>
              </div>

              <div className="p-4 sm:p-6 min-h-[420px] font-[family-name:var(--font-jetbrains-mono)]">
                {/* Typed command */}
                <div className="text-xs sm:text-sm leading-6 text-green-400">
                  {typedCommand}
                  {phase === "typing" && (
                    <span className="inline-block w-2 h-4 bg-white/60 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>

                {/* Output lines */}
                {phase === "output" &&
                  scenario.lines.slice(0, visibleLines).map((line, i) => (
                    <div
                      key={`${activeScenario}-${i}`}
                      className={`text-xs sm:text-sm leading-6 ${getLineColor(line.type)}`}
                    >
                      {line.text || "\u00A0"}
                    </div>
                  ))}

                {phase === "output" && visibleLines < scenario.lines.length && (
                  <span className="inline-block w-2 h-4 bg-white/60 animate-pulse" />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Paragraph size="sm" muted>
              Click the tabs above to see different test scenarios.
            </Paragraph>
            <Paragraph size="sm" muted className="mt-1 text-white/25 text-xs italic">
              * Simulated output for illustration purposes. Actual CLI output may vary.
            </Paragraph>
          </div>
        </motion.div>
      </Container>
    </Section>
  );
}
