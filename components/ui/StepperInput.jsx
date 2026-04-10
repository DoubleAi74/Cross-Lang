"use client";

import { clamp, coerceInteger, cx } from "@/lib/utils";

export default function StepperInput({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  disabled = false,
}) {
  function updateValue(nextValue) {
    if (disabled) {
      return;
    }

    onChange(clamp(nextValue, min, max));
  }

  return (
    <div className={cx("space-y-3", disabled && "opacity-55", className)}>
      {label ? (
        <div className="space-y-1">
          <label className="block text-sm font-semibold text-ink">{label}</label>
          {description ? (
            <p className="text-sm text-ink/60">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-3xl border border-ink/10 bg-white/80 p-2 shadow-float">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/5 text-xl font-semibold text-ink transition hover:bg-ink/10 disabled:opacity-40"
          onClick={() => updateValue(value - step)}
          disabled={disabled || value <= min}
        >
          -
        </button>

        <input
          type="number"
          value={value}
          min={min}
          max={max}
          inputMode="numeric"
          className="no-spinner h-12 min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-center text-lg font-semibold text-ink"
          disabled={disabled}
          onChange={(event) => updateValue(coerceInteger(event.target.value, value))}
        />

        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-xl font-semibold text-white transition hover:bg-coral disabled:opacity-40"
          onClick={() => updateValue(value + step)}
          disabled={disabled || value >= max}
        >
          +
        </button>
      </div>

      <div className="flex justify-between px-1 text-xs font-medium uppercase tracking-[0.24em] text-ink/45">
        <span>Min {min}</span>
        <span>Max {max}</span>
      </div>
    </div>
  );
}
