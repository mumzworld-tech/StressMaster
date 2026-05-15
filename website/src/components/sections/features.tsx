"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { FEATURES } from "@/lib/constants";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: "red" | "blue";
  index: number;
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
  index,
}: FeatureCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const glowColor =
    color === "red" ? "bg-red-500/20" : "bg-blue-500/20";
  const iconColor =
    color === "red" ? "text-red-400" : "text-blue-400";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        delay: index * 0.08,
        duration: 0.6,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="group relative"
    >
      <div className="relative glass rounded-2xl p-6 sm:p-8 h-full transition-all duration-300 hover:bg-white/[0.06] hover:border-white/10 hover:translate-y-[-2px] hover:shadow-xl hover:shadow-black/20">
        <div className="relative perspective-1000 mb-5">
          <div
            className={`absolute -inset-2 ${glowColor} rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
          />
          <div className="relative w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transform group-hover:rotate-[-6deg] group-hover:scale-110 transition-transform duration-300 preserve-3d">
            <Icon className={`size-5 ${iconColor}`} />
          </div>
        </div>

        <Heading as="h4" className="text-lg sm:text-xl mb-2 text-white">
          {title}
        </Heading>
        <Paragraph size="sm" muted>
          {description}
        </Paragraph>
      </div>
    </motion.div>
  );
}

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <Section id="features">
      <Container>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center mb-16 sm:mb-20"
        >
          <Heading as="h2" className="mb-4">
            Built for the Modern Developer
          </Heading>
          <Paragraph size="lg" muted className="max-w-2xl mx-auto">
            Everything you need to test your APIs at scale, powered by AI and
            built for speed.
          </Paragraph>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {FEATURES.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              index={i}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
