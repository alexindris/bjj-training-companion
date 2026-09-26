import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

// shadcn-style owned component; no hosted component runtime.
export function Button({
  className,
  asChild = false,
  variant = "primary",
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "primary" | "outline" | "ghost";
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60",
        variant === "primary" && "bg-teal-800 text-white hover:bg-teal-900",
        variant === "outline" &&
          "border border-stone-300 bg-white hover:bg-stone-100",
        variant === "ghost" && "hover:bg-stone-100",
        className,
      )}
      {...props}
    />
  );
}
