import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StressMaster - AI-Powered Load Testing CLI",
  description:
    "Open source, local-first AI-powered load testing CLI tool. Describe your test in plain English, get production-grade K6 load test scripts and results.",
  keywords: [
    "load testing",
    "stress testing",
    "AI",
    "CLI",
    "K6",
    "performance testing",
    "API testing",
    "natural language",
    "open source",
  ],
  openGraph: {
    title: "StressMaster - Load Testing on Autopilot",
    description:
      "AI-powered CLI that converts natural language into K6 load test scripts. Describe your test in English, get production-grade results.",
    type: "website",
    url: "https://mumzworld-tech.github.io/StressMaster/",
    siteName: "StressMaster",
  },
  twitter: {
    card: "summary_large_image",
    title: "StressMaster - Load Testing on Autopilot",
    description:
      "AI-powered CLI that converts natural language into K6 load test scripts.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
