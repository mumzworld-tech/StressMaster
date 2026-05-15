"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { AnimatedCounter } from "@/components/effects/animated-counter";
import { METRICS_DATA } from "@/lib/constants";

interface MetricGroupProps {
  title: string;
  metrics: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly color: string;
  }>;
  index: number;
}

function MetricGroup({ title, metrics, index }: MetricGroupProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="glass rounded-2xl p-6 sm:p-8"
    >
      <Heading as="h5" className="text-base sm:text-lg mb-5 text-white/90">
        {title}
      </Heading>
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
          >
            <Paragraph size="sm" muted className="text-white/50">
              {metric.label}
            </Paragraph>
            <span
              className={`text-sm sm:text-base font-semibold font-[family-name:var(--font-jetbrains-mono)] ${metric.color}`}
            >
              <AnimatedCounter value={metric.value} />
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function Metrics() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const groups = [
    { title: "Response Times", metrics: METRICS_DATA.responseTimes },
    { title: "Throughput", metrics: METRICS_DATA.throughput },
    { title: "Error Rates", metrics: METRICS_DATA.errors },
    { title: "Resource Usage", metrics: METRICS_DATA.resources },
  ];

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
            Comprehensive Performance Insights
          </Heading>
          <Paragraph size="lg" muted className="max-w-2xl mx-auto">
            Track every metric that matters. From response times to resource
            usage, get the full picture.
          </Paragraph>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {groups.map((group, i) => (
            <MetricGroup
              key={group.title}
              title={group.title}
              metrics={group.metrics}
              index={i}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
