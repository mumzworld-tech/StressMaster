import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  children: React.ReactNode;
}

export function Heading({
  as: Tag = "h2",
  className,
  children,
  ...props
}: HeadingProps) {
  const baseStyles: Record<HeadingLevel, string> = {
    h1: "text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[80px] 2xl:text-[96px] font-bold tracking-[-0.04em] leading-[0.95] font-[family-name:var(--font-space-grotesk)]",
    h2: "text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.03em] leading-[1.05] font-[family-name:var(--font-space-grotesk)]",
    h3: "text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.02em] leading-[1.1] font-[family-name:var(--font-space-grotesk)]",
    h4: "text-xl sm:text-2xl font-semibold tracking-[-0.02em] leading-[1.2] font-[family-name:var(--font-space-grotesk)]",
    h5: "text-lg sm:text-xl font-semibold tracking-[-0.01em] leading-[1.3] font-[family-name:var(--font-space-grotesk)]",
    h6: "text-base sm:text-lg font-semibold tracking-[-0.01em] leading-[1.4] font-[family-name:var(--font-space-grotesk)]",
  };

  return (
    <Tag className={cn(baseStyles[Tag], "text-white", className)} {...props}>
      {children}
    </Tag>
  );
}

interface ParagraphProps extends React.HTMLAttributes<HTMLParagraphElement> {
  size?: "sm" | "base" | "lg" | "xl";
  muted?: boolean;
  children: React.ReactNode;
}

export function Paragraph({
  size = "base",
  muted = false,
  className,
  children,
  ...props
}: ParagraphProps) {
  const sizeStyles = {
    sm: "text-sm leading-relaxed",
    base: "text-base leading-relaxed",
    lg: "text-lg leading-relaxed",
    xl: "text-xl leading-relaxed",
  };

  return (
    <p
      className={cn(
        sizeStyles[size],
        muted ? "text-[#a1a1aa]" : "text-white/80",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}

interface LabelTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function Label({ className, children, ...props }: LabelTextProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium uppercase tracking-widest text-[#a1a1aa]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

interface CodeTextProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Code({ className, children, ...props }: CodeTextProps) {
  return (
    <code
      className={cn(
        "rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-sm text-white/90 font-[family-name:var(--font-jetbrains-mono)]",
        className
      )}
      {...props}
    >
      {children}
    </code>
  );
}
