"use client";

import Image from "next/image";
import { Zap } from "lucide-react";

const basePath = process.env.NODE_ENV === "production" ? "/StressMaster" : "";
import { Container } from "@/components/common/container";
import { Paragraph } from "@/components/common/text";
import { StyledLink } from "@/components/common/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FOOTER_LINKS, GITHUB_REPO_URL } from "@/lib/constants";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5">
      <Container className="py-12 sm:py-16">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-3">
            <a
              href="#"
              className="flex items-center gap-2"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Zap className="size-4 text-red-500" />
              <span className="text-base font-bold font-[family-name:var(--font-space-grotesk)] tracking-tight">
                <span className="text-white">Stress</span>
                <span className="text-gradient-red-blue">Master</span>
              </span>
            </a>
            <a
              href="https://www.mumzworld.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              <Paragraph size="sm" muted className="text-white/50">
                Built by
              </Paragraph>
              <Image
                src={`${basePath}/mumzworld-logo.gif`}
                alt="Mumzworld"
                width={100}
                height={24}
                className="h-5 w-auto"
                unoptimized
              />
            </a>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <StyledLink
                key={link.label}
                href={link.href}
                external
                className="text-sm text-white/40 hover:text-white/70"
              >
                {link.label}
              </StyledLink>
            ))}
          </nav>
        </div>

        <Separator className="my-8 bg-white/5" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <Paragraph size="sm" muted className="text-white/30 text-xs">
              &copy; {currentYear} StressMaster. All rights reserved.
            </Paragraph>
          </div>
          <Badge
            variant="outline"
            className="border-white/10 text-white/30 text-xs"
          >
            <a
              href={`${GITHUB_REPO_URL}/blob/master/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/50 transition-colors"
            >
              MIT License
            </a>
          </Badge>
        </div>
      </Container>
    </footer>
  );
}
