"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useInView } from "motion/react";
import { Copy, Check, ArrowRight, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { GradientText } from "@/components/common/gradient-text";
import { Glow } from "@/components/effects/glow";
import {
  MCP_CLIENTS,
  MCP_CONFIG_SNIPPET,
  MCP_QUICK_ADD_COMMAND,
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_HIGHLIGHTS,
} from "@/lib/constants";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80 inline-flex items-center gap-2"
      aria-label={label ?? "Copy to clipboard"}
    >
      {copied ? (
        <Check className="size-4 text-green-400" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

function CommandLine({ command }: { command: string }) {
  return (
    <div className="relative glass-strong rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="text-white/30 select-none font-[family-name:var(--font-jetbrains-mono)]">
            $
          </span>
          <span className="text-sm sm:text-base font-medium text-white font-[family-name:var(--font-jetbrains-mono)] whitespace-nowrap">
            {command}
          </span>
        </div>
        <CopyButton text={command} />
      </div>
    </div>
  );
}

function ConfigBlock() {
  return (
    <div className="relative glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <span className="text-xs text-white/30 font-[family-name:var(--font-jetbrains-mono)]">
          ~/.claude.json
        </span>
        <CopyButton text={MCP_CONFIG_SNIPPET} label="Copy config" />
      </div>
      <pre className="p-4 sm:p-5 overflow-x-auto text-sm font-[family-name:var(--font-jetbrains-mono)] text-white/80 leading-relaxed">
        {MCP_CONFIG_SNIPPET}
      </pre>
    </div>
  );
}

export function MCP() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <Section id="mcp" className="relative overflow-hidden">
      <Glow
        color="red"
        size="xl"
        intensity="low"
        className="-top-32 left-1/4"
      />
      <Glow
        color="blue"
        size="lg"
        intensity="low"
        className="bottom-0 right-0"
      />

      <Container className="relative z-10">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center mb-12 sm:mb-16"
        >
          <Badge
            variant="outline"
            className="border-white/10 bg-white/5 text-white/70 px-4 py-1.5 text-sm gap-2 mb-6"
          >
            <Plug className="size-3.5 text-red-400" />
            <span>Model Context Protocol</span>
          </Badge>
          <Heading as="h2" className="mb-4">
            Plug into your{" "}
            <GradientText variant="red-blue">AI coding agent</GradientText>
          </Heading>
          <Paragraph size="lg" muted className="max-w-2xl mx-auto">
            Load testing without leaving your editor. Claude Code, Cursor, Kiro,
            Codex, and any MCP-compatible agent can drive StressMaster directly —
            no API key, no copy-pasting commands.
          </Paragraph>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            delay: 0.15,
            duration: 0.7,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="grid gap-6 lg:grid-cols-5 mb-16"
        >
          <div className="lg:col-span-3 space-y-4">
            <Paragraph size="sm" muted className="font-medium">
              One command to connect
            </Paragraph>
            <CommandLine command={MCP_QUICK_ADD_COMMAND} />
            <Paragraph size="sm" muted className="font-medium pt-2">
              Or add manually to your MCP config
            </Paragraph>
            <ConfigBlock />
          </div>

          <div className="lg:col-span-2 space-y-4">
            {MCP_HIGHLIGHTS.map((highlight, i) => {
              const Icon = highlight.icon;
              return (
                <motion.div
                  key={highlight.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    delay: 0.3 + i * 0.1,
                    duration: 0.5,
                  }}
                  className="glass rounded-xl p-5 flex gap-4"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Icon className="size-4 text-red-400" />
                  </div>
                  <div>
                    <Heading as="h4" className="text-base mb-1 text-white">
                      {highlight.title}
                    </Heading>
                    <Paragraph size="sm" muted>
                      {highlight.description}
                    </Paragraph>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            delay: 0.3,
            duration: 0.7,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="mb-12"
        >
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <Heading as="h3" className="text-2xl text-white">
              8 tools the agent can call
            </Heading>
            <Paragraph size="sm" muted>
              Full StressMaster surface area, exposed over MCP
            </Paragraph>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {MCP_TOOLS.map((tool, i) => {
              const Icon = tool.icon;
              const iconColor =
                tool.color === "red" ? "text-red-400" : "text-blue-400";
              return (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    delay: 0.4 + i * 0.05,
                    duration: 0.5,
                  }}
                  className="glass rounded-xl p-5 hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Icon className={`size-4 ${iconColor}`} />
                    </div>
                    <code className="text-sm font-[family-name:var(--font-jetbrains-mono)] text-white">
                      {tool.name}
                    </code>
                  </div>
                  <Paragraph size="sm" muted>
                    {tool.description}
                  </Paragraph>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            delay: 0.4,
            duration: 0.7,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="mb-12"
        >
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <Heading as="h3" className="text-2xl text-white">
              5 resources the agent can read
            </Heading>
            <Paragraph size="sm" muted>
              Test history, templates, and config — surfaced as MCP resources
            </Paragraph>
          </div>
          <div className="glass rounded-xl divide-y divide-white/5 overflow-hidden">
            {MCP_RESOURCES.map((resource, i) => {
              const Icon = resource.icon;
              return (
                <motion.div
                  key={resource.uri}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{
                    delay: 0.5 + i * 0.05,
                    duration: 0.4,
                  }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Icon className="size-4 text-blue-400" />
                  </div>
                  <code className="text-sm font-[family-name:var(--font-jetbrains-mono)] text-white shrink-0">
                    {resource.uri}
                  </code>
                  <Paragraph size="sm" muted className="ml-auto text-right hidden sm:block">
                    {resource.description}
                  </Paragraph>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            delay: 0.5,
            duration: 0.7,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="text-center"
        >
          <Paragraph size="sm" muted className="mb-3">
            Works with
          </Paragraph>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {MCP_CLIENTS.map((client) => (
              <Badge
                key={client}
                variant="outline"
                className="border-white/10 bg-white/5 text-white/70 px-3 py-1"
              >
                {client}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className="border-white/10 bg-white/5 text-white/40 px-3 py-1"
            >
              + any MCP client
            </Badge>
          </div>
          <Button
            size="lg"
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 px-8 h-12 text-base shadow-xl shadow-red-500/25"
            asChild
          >
            <a href="#installation">
              <span>Install in 30 seconds</span>
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </motion.div>
      </Container>
    </Section>
  );
}
