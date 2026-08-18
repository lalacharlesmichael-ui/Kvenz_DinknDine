import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-lime-200 bg-lime-50 text-lime-800",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        destructive: "border-rose-200 bg-rose-50 text-rose-700",
        neutral: "border-stone-200 bg-stone-100 text-stone-700",
        info: "border-sky-200 bg-sky-50 text-sky-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}
