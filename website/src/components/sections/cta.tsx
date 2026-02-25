"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/common/container";
import { Heading, Paragraph } from "@/components/common/text";
import { Glow } from "@/components/effects/glow";
import { useGitHubData } from "@/hooks/use-github-data";
import { GITHUB_REPO_URL } from "@/lib/constants";

export function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const { stars } = useGitHubData();

  return (
    <Section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/[0.03] to-transparent" />
      <Glow
        color="red"
        size="xl"
        intensity="low"
        className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      <Glow
        color="blue"
        size="lg"
        intensity="low"
        className="top-0 right-0"
      />

      <Container className="relative z-10">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center"
        >
          <Heading as="h2" className="mb-4">
            Ready to Stress Test?
          </Heading>
          <Paragraph size="lg" muted className="max-w-xl mx-auto mb-10">
            Join the open source community. Star us on GitHub.
          </Paragraph>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 px-8 h-12 text-base"
              asChild
            >
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Star className="size-4" />
                <span>Star on GitHub</span>
                {stars > 0 && (
                  <span className="ml-1 text-white/50">({stars})</span>
                )}
              </a>
            </Button>
            <Button
              size="lg"
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 px-8 h-12 text-base shadow-xl shadow-red-500/25"
              asChild
            >
              <a href="#installation">
                <span>Get Started</span>
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </motion.div>
      </Container>
    </Section>
  );
}
