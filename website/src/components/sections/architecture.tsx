"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { ARCHITECTURE_STEPS } from "@/lib/constants";
import type { LucideIcon } from "lucide-react";

interface StepCardProps {
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color: "red" | "blue";
  index: number;
}

function StepCard({
  title,
  subtitle,
  description,
  icon: Icon,
  color,
  index,
}: StepCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const iconBg =
    color === "red" ? "from-red-500/20 to-red-500/5" : "from-blue-500/20 to-blue-500/5";
  const iconColor =
    color === "red" ? "text-red-400" : "text-blue-400";
  const glowColor =
    color === "red" ? "shadow-red-500/20" : "shadow-blue-500/20";
  const borderHover =
    color === "red"
      ? "group-hover:border-red-500/30"
      : "group-hover:border-blue-500/30";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, rotateX: 15 }}
      animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{
        delay: index * 0.15,
        duration: 0.7,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="group perspective-1000"
    >
      <div
        className={`relative glass rounded-2xl p-6 sm:p-7 text-center transition-all duration-500
          hover:bg-white/[0.06] ${borderHover} hover:shadow-2xl ${glowColor}
          hover:translate-y-[-6px] hover:scale-[1.02]
          preserve-3d`}
      >
        {/* Glow backdrop on hover */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${iconBg} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`}
        />

        {/* 3D floating icon */}
        <motion.div
          animate={isInView ? {
            y: [0, -6, 0],
            rotateY: [0, 10, -10, 0],
          } : {}}
          transition={{
            delay: index * 0.15 + 0.8,
            duration: 4,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
          }}
          className="relative mx-auto mb-5 w-16 h-16 preserve-3d"
        >
          {/* Shadow beneath icon */}
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-2 rounded-full blur-md bg-gradient-to-r ${iconBg} opacity-60`}
          />
          {/* Icon container with 3D depth */}
          <div
            className={`relative w-16 h-16 rounded-2xl bg-gradient-to-b ${iconBg} border border-white/10
              flex items-center justify-center
              shadow-lg ${glowColor}
              group-hover:shadow-xl transition-shadow duration-500
              preserve-3d`}
            style={{ transform: "translateZ(8px)" }}
          >
            <Icon className={`size-7 ${iconColor}`} />
          </div>
        </motion.div>

        <Heading as="h5" className="text-base sm:text-lg mb-1 text-white">
          {title}
        </Heading>
        <Paragraph size="sm" className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-white/40 mb-2">
          {subtitle}
        </Paragraph>
        <Paragraph size="sm" muted className="text-xs leading-relaxed">
          {description}
        </Paragraph>
      </div>
    </motion.div>
  );
}

function ConnectorArrow({ index, isInView }: { index: number; isInView: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{
        delay: index * 0.15 + 0.4,
        duration: 0.4,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="flex items-center justify-center"
    >
      {/* Horizontal connector - desktop */}
      <div className="hidden lg:flex items-center w-full justify-center">
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: "100%" } : {}}
          transition={{ delay: index * 0.15 + 0.5, duration: 0.6 }}
          className="h-px bg-gradient-to-r from-red-500/40 via-white/20 to-blue-500/40 max-w-[60px]"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: index * 0.15 + 0.8 }}
          className="w-2 h-2 rotate-45 border-t border-r border-white/20 -ml-1 shrink-0"
        />
      </div>
      {/* Vertical connector - mobile/tablet */}
      <div className="lg:hidden flex flex-col items-center py-2">
        <motion.div
          initial={{ height: 0 }}
          animate={isInView ? { height: 24 } : {}}
          transition={{ delay: index * 0.15 + 0.5, duration: 0.4 }}
          className="w-px bg-gradient-to-b from-red-500/40 to-blue-500/40"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: index * 0.15 + 0.8 }}
          className="w-2 h-2 rotate-45 border-b border-r border-white/20 -mt-1"
        />
      </div>
    </motion.div>
  );
}

export function Architecture() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <Section id="architecture">
      <Container size="wide">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center mb-16 sm:mb-20"
        >
          <Heading as="h2" className="mb-4">
            How It Works
          </Heading>
          <Paragraph size="lg" muted className="max-w-2xl mx-auto">
            From natural language to production-grade load tests in seconds.
          </Paragraph>
        </motion.div>

        {/* Desktop: horizontal flow */}
        <div className="hidden lg:flex items-start justify-center gap-0">
          {ARCHITECTURE_STEPS.map((step, i) => (
            <div key={step.title} className="flex items-center">
              <div className="w-[170px] xl:w-[190px]">
                <StepCard {...step} index={i} />
              </div>
              {i < ARCHITECTURE_STEPS.length - 1 && (
                <div className="w-[50px] xl:w-[60px] flex-shrink-0">
                  <ConnectorArrow index={i} isInView={isInView} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tablet: 2-column grid */}
        <div className="hidden sm:grid lg:hidden grid-cols-2 gap-4">
          {ARCHITECTURE_STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center">
              <StepCard {...step} index={i} />
              {i < ARCHITECTURE_STEPS.length - 1 && i % 2 === 1 && (
                <ConnectorArrow index={i} isInView={isInView} />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical stack with connectors */}
        <div className="flex sm:hidden flex-col items-center">
          {ARCHITECTURE_STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center w-full max-w-[320px]">
              <StepCard {...step} index={i} />
              {i < ARCHITECTURE_STEPS.length - 1 && (
                <ConnectorArrow index={i} isInView={isInView} />
              )}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
