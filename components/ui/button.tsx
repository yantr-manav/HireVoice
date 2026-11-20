import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ink" | "outline" | "ghost" | "danger" | "booth";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "border border-ultramarine bg-ultramarine text-white hover:bg-[#2638db] hover:border-[#2638db] active:translate-y-px",
  ink: "border border-ink bg-ink text-chalk hover:bg-[#1b2942] active:translate-y-px",
  outline:
    "border border-rule bg-paper text-ink hover:border-ink hover:bg-white active:translate-y-px",
  ghost: "border border-transparent bg-transparent text-ink hover:bg-ink/[0.055]",
  danger:
    "border border-onair/25 bg-onair-soft text-[#b51d3c] hover:border-onair/50 hover:bg-[#ffdbe3]",
  booth:
    "border border-glow/30 bg-glow/10 text-mist hover:border-glow/60 hover:bg-glow/15 active:translate-y-px",
};

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[12.5px]",
  md: "h-9 gap-2 px-3.5 text-[13px]",
  lg: "h-11 gap-2 px-5 text-[14px]",
  icon: "h-9 w-9 justify-center",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(
          "inline-flex select-none items-center justify-center whitespace-nowrap rounded-[7px] font-medium transition-[background-color,border-color,color,transform] duration-150 disabled:pointer-events-none disabled:opacity-45",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
