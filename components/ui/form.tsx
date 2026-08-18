import type * as React from "react";

import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-semibold leading-6 text-stone-800", className)}
      {...props}
    />
  );
}

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full min-w-0 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 shadow-sm outline-none transition-colors focus:border-lime-500 focus:ring-2 focus:ring-lime-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 space-y-2", className)} {...props} />;
}
