"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useInView } from "motion/react";
import { Copy, Check } from "lucide-react";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { INSTALLATION_TABS } from "@/lib/constants";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="size-4 text-green-400" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

function CodeBlock({ commands }: { commands: readonly string[] }) {
  const allText = commands.join("\n");

  return (
    <div className="relative glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <span className="text-xs text-white/30 font-[family-name:var(--font-jetbrains-mono)]">
          terminal
        </span>
        <CopyButton text={allText} />
      </div>
      <div className="p-4 sm:p-5 overflow-x-auto">
        {commands.map((cmd, i) => (
          <div
            key={i}
            className="text-sm font-[family-name:var(--font-jetbrains-mono)] text-green-400"
          >
            <span className="text-white/30 select-none">$ </span>
            {cmd}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Installation() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <Section id="installation">
      <Container>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center mb-16 sm:mb-20"
        >
          <Heading as="h2" className="mb-4">
            Get Started in Seconds
          </Heading>
          <Paragraph size="lg" muted className="max-w-2xl mx-auto">
            Install globally with npm and start testing immediately.
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
          className="max-w-2xl mx-auto"
        >
          <div className="relative mb-8">
            <div className="absolute -inset-2 bg-gradient-to-r from-red-500/10 to-blue-500/10 rounded-2xl blur-xl" />
            <div className="relative glass-strong rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 overflow-x-auto">
                  <span className="text-white/30 select-none font-[family-name:var(--font-jetbrains-mono)]">
                    $
                  </span>
                  <span className="text-base sm:text-lg font-medium text-white font-[family-name:var(--font-jetbrains-mono)] whitespace-nowrap">
                    npm install -g stressmaster
                  </span>
                </div>
                <CopyButton text="npm install -g stressmaster" />
              </div>
            </div>
          </div>

          <Tabs defaultValue="npm" className="w-full">
            <TabsList className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-lg">
              {Object.entries(INSTALLATION_TABS).map(([key, tab]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 rounded-md"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(INSTALLATION_TABS).map(([key, tab]) => (
              <TabsContent key={key} value={key} className="mt-4">
                <CodeBlock commands={tab.commands} />
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-8">
            <Paragraph size="sm" muted className="mb-3">
              Run your first test:
            </Paragraph>
            <CodeBlock
              commands={[
                'stressmaster "Send 100 GET requests to https://httpbin.org/get over 30 seconds"',
              ]}
            />
          </div>

        </motion.div>
      </Container>
    </Section>
  );
}
