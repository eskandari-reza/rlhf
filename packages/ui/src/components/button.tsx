"use client";

import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", ...props }, ref) => {
    const base =
      "px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50";
    const styles =
      variant === "primary"
        ? "bg-neutral-900 text-white hover:bg-neutral-700"
        : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200";
    return (
      <button
        ref={ref}
        className={`${base} ${styles} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";