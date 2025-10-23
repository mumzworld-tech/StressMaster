"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-red-600 text-white hover:bg-red-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border",
        secondary: "",
        ghost: "",
        link: "text-red-600 underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700",
        chat: "bg-red-600 text-white hover:bg-red-700 shadow-lg",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        chat: "h-12 px-6 py-3 text-base font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const { isDark } = useThemeStore();
    const Comp = asChild ? Slot : "button";

    const getThemeStyles = () => {
      switch (variant) {
        case "outline":
          return isDark
            ? "border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600 hover:text-white"
            : "bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300";
        case "secondary":
          return isDark
            ? "bg-gray-700 text-gray-200 hover:bg-gray-600 hover:text-white"
            : "bg-gray-100 text-gray-900 hover:bg-gray-200";
        case "ghost":
          return isDark
            ? "text-gray-200 hover:bg-gray-700 hover:text-white"
            : "text-gray-900 hover:bg-gray-100 hover:text-gray-900";
        default:
          return "";
      }
    };

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          getThemeStyles(),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
