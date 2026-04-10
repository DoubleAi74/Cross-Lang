"use client";

import Link from "next/link";
import { cx } from "@/lib/utils";

function ActionCardFrame({
  icon,
  title,
  subtitle,
  disabled = false,
  placeholder = false,
  children,
}) {
  return (
    <div
      className={cx(
        "glass-panel flex min-h-40 flex-col justify-between border border-white/50 p-5 text-left transition",
        !disabled && !placeholder && "hover:-translate-y-1 hover:shadow-[0_20px_45px_-28px_rgba(31,23,40,0.45)]",
        placeholder && "border-dashed border-ink/12 bg-white/45 opacity-75",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <div className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-2xl shadow-float">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl leading-tight text-ink">{title}</h3>
          {subtitle ? (
            <p className="text-sm leading-6 text-ink/62">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ActionCard({
  icon,
  title,
  subtitle,
  href,
  onClick,
  disabled = false,
  placeholder = false,
}) {
  if (href && !disabled && !placeholder) {
    return (
      <Link href={href} className="block">
        <ActionCardFrame icon={icon} title={title} subtitle={subtitle} />
      </Link>
    );
  }

  if (onClick && !placeholder) {
    return (
      <button type="button" className="w-full text-left" onClick={onClick} disabled={disabled}>
        <ActionCardFrame
          icon={icon}
          title={title}
          subtitle={subtitle}
          disabled={disabled}
        />
      </button>
    );
  }

  return (
    <ActionCardFrame
      icon={icon}
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
