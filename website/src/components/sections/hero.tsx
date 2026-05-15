"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plug, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { GradientText } from "@/components/common/gradient-text";
import { DotGrid } from "@/components/effects/dot-grid";
import { Glow } from "@/components/effects/glow";

function TypingTerminal() {
  const [displayText, setDisplayText] = useState("");
  const fullCommand = "$ claude mcp add stressmaster stressmaster-mcp";
  const cursorRef = useRef(true);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullCommand.length) {
        setDisplayText(fullCommand.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      cursorRef.current = !cursorRef.current;
    }, 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative mt-12 sm:mt-16 max-w-2xl mx-auto"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-blue-500/20 rounded-2xl blur-xl" />
      <div className="relative glass rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-white/30 font-mono ml-2 font-[family-name:var(--font-jetbrains-mono)]">
            terminal
          </span>
        </div>
        <div className="p-4 sm:p-6">
          <pre className="text-sm sm:text-base text-green-400 font-mono font-[family-name:var(--font-jetbrains-mono)] overflow-x-auto">
            <span>{displayText}</span>
            <span className="animate-pulse text-white">|</span>
          </pre>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <DotGrid />

      <Glow
        color="red"
        size="xl"
        intensity="medium"
        className="-top-32 -left-32"
      />
      <Glow
        color="blue"
        size="lg"
        intensity="low"
        className="-bottom-20 -right-20"
      />
      <Glow
        color="red"
        size="md"
        intensity="low"
        className="top-1/3 right-1/4"
      />

      <Container className="relative z-10 pt-24 pb-16">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <Badge
              variant="outline"
              className="border-white/10 bg-white/5 text-white/70 px-4 py-1.5 text-sm gap-2"
            >
              <Plug className="size-3.5 text-red-400" />
              <span>MCP server + open-source CLI</span>
            </Badge>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.2,
              duration: 0.8,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className="mt-8 sm:mt-10"
          >
            <Heading
              as="h1"
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[88px] xl:text-[104px] 2xl:text-[120px]"
            >
              <span className="text-white">Load Testing</span>
              <br />
              <GradientText variant="red-blue">from your AI agent</GradientText>
            </Heading>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.5,
              duration: 0.7,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className="mt-6 sm:mt-8 max-w-2xl"
          >
            <Paragraph size="lg" muted className="text-base sm:text-lg md:text-xl">
              Claude Code, Cursor, Kiro, and Codex call StressMaster directly
              over MCP — no API key required. Prefer the terminal? The original
              CLI is still here, one <code className="text-white/80 font-[family-name:var(--font-jetbrains-mono)]">npm install</code> away.
            </Paragraph>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.8,
              duration: 0.7,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className="flex flex-col sm:flex-row items-center gap-4 mt-10"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 px-8 h-12 text-base shadow-xl shadow-red-500/25 glow-red-strong"
              asChild
            >
              <a href="#mcp">
                <span>Connect to your agent</span>
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white px-8 h-12 text-base"
              asChild
            >
              <a href="#cli-demo">
                <span>Or use the CLI</span>
              </a>
            </Button>
          </motion.div>

          <TypingTerminal />
        </div>
      </Container>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="size-5 text-white/30" />
        </motion.div>
      </motion.div>
    </section>
  );
}
