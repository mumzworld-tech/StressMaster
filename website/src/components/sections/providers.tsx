"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS } from "@/lib/constants";

function PerformanceBadge({
  level,
}: {
  level: "Best" | "Excellent" | "Good";
}) {
  const styles = {
    Best: "bg-green-500/10 text-green-400 border-green-500/20",
    Excellent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Good: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  return (
    <Badge
      variant="outline"
      className={`${styles[level]} text-xs font-medium`}
    >
      {level}
    </Badge>
  );
}

export function Providers() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <Section>
      <Container>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center mb-16 sm:mb-20"
        >
          <Heading as="h2" className="mb-4">
            Choose Your AI Provider
          </Heading>
          <Paragraph size="lg" muted className="max-w-2xl mx-auto">
            Works with all major AI providers. Pick the one that fits your needs
            and budget.
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
          className="max-w-4xl mx-auto"
        >
          <div className="glass rounded-2xl overflow-hidden">
            <div className="hidden sm:grid grid-cols-5 gap-4 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <Paragraph size="sm" className="text-white/40 font-medium">
                Provider
              </Paragraph>
              <Paragraph size="sm" className="text-white/40 font-medium">
                Model
              </Paragraph>
              <Paragraph size="sm" className="text-white/40 font-medium">
                Cost
              </Paragraph>
              <Paragraph size="sm" className="text-white/40 font-medium">
                Performance
              </Paragraph>
              <Paragraph size="sm" className="text-white/40 font-medium">
                Setup
              </Paragraph>
            </div>

            {PROVIDERS.map((provider, i) => (
              <motion.div
                key={`${provider.provider}-${provider.model}`}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{
                  delay: 0.3 + i * 0.08,
                  duration: 0.5,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors duration-200"
              >
                <div>
                  <span className="sm:hidden text-xs text-white/40 mr-2">
                    Provider:
                  </span>
                  <span className="text-sm font-medium text-white/90">
                    {provider.provider}
                  </span>
                </div>
                <div>
                  <span className="sm:hidden text-xs text-white/40 mr-2">
                    Model:
                  </span>
                  <span className="text-sm text-white/70 font-[family-name:var(--font-jetbrains-mono)]">
                    {provider.model}
                  </span>
                </div>
                <div>
                  <span className="sm:hidden text-xs text-white/40 mr-2">
                    Cost:
                  </span>
                  <span className="text-sm text-white/60 font-[family-name:var(--font-jetbrains-mono)]">
                    {provider.cost}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="sm:hidden text-xs text-white/40 mr-2">
                    Performance:
                  </span>
                  <PerformanceBadge level={provider.performance} />
                </div>
                <div>
                  <span className="sm:hidden text-xs text-white/40 mr-2">
                    Setup:
                  </span>
                  <span className="text-sm text-white/60">
                    {provider.setup}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-6 text-center"
          >
            <Paragraph size="sm" muted>
              All models also available through OpenRouter for unified access.
            </Paragraph>
          </motion.div>
        </motion.div>
      </Container>
    </Section>
  );
}
