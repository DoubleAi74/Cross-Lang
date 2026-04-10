"use client";

import { cx } from "@/lib/utils";

export default function SecondaryButton({
  children,
  className,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border border-ink/10 bg-white/70 px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
