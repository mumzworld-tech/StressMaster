import { cn } from "@/lib/utils";

interface GlowProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: "red" | "blue" | "red-blue";
  size?: "sm" | "md" | "lg" | "xl";
  intensity?: "low" | "medium" | "high";
}

export function Glow({
  color = "red",
  size = "md",
  intensity = "medium",
  className,
  ...props
}: GlowProps) {
  const colorStyles = {
    red: "bg-red-500/20",
    blue: "bg-blue-500/20",
    "red-blue":
      "bg-gradient-to-r from-red-500/20 to-blue-500/20",
  };

  const sizeStyles = {
    sm: "w-32 h-32",
    md: "w-64 h-64",
    lg: "w-96 h-96",
    xl: "w-[500px] h-[500px]",
  };

  const intensityStyles = {
    low: "blur-[80px] opacity-30",
    medium: "blur-[120px] opacity-50",
    high: "blur-[160px] opacity-70",
  };

  return (
    <div
      className={cn(
        "absolute rounded-full pointer-events-none",
        colorStyles[color],
        sizeStyles[size],
        intensityStyles[intensity],
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
