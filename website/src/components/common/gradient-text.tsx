import { cn } from "@/lib/utils";

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "red-blue" | "red" | "blue";
  children: React.ReactNode;
}

export function GradientText({
  variant = "red-blue",
  className,
  children,
  ...props
}: GradientTextProps) {
  const gradientStyles = {
    "red-blue": "bg-gradient-to-r from-[#ef4444] to-[#3b82f6]",
    red: "bg-gradient-to-r from-[#ef4444] to-[#dc2626]",
    blue: "bg-gradient-to-r from-[#3b82f6] to-[#2563eb]",
  };

  return (
    <span
      className={cn(
        "bg-clip-text text-transparent",
        gradientStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
