"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  const { isDark } = useThemeStore();

  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
        isDark
          ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400 ring-offset-gray-900"
          : "border-gray-200 bg-white text-gray-900 placeholder:text-gray-500",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
