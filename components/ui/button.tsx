import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 max-w-full shrink-0 items-center justify-center gap-2 rounded-md text-center text-sm font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-lime-300 text-black hover:bg-lime-200",
        secondary: "bg-stone-100 text-stone-950 hover:bg-stone-200",
        destructive: "bg-rose-600 text-white hover:bg-rose-700",
        outline:
          "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
        ghost: "text-stone-700 hover:bg-stone-100 hover:text-stone-950",
      },
      size: {
        sm: "h-9 px-3",
        default: "h-10 px-3 sm:px-4",
        lg: "h-12 px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
