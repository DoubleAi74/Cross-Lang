"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";
import { cx } from "@/lib/utils";
import SecondaryButton from "@/components/ui/SecondaryButton";

export default function BaseModal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  showCloseButton = true,
  panelClassName = "",
  showHeader = true,
  headerActions = null,
  layerClassName = "z-50",
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && showCloseButton) {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, showCloseButton]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={cx(
        "fixed inset-0 flex items-end justify-center bg-ink/35 px-4 py-4 sm:items-center",
        layerClassName,
      )}
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close modal"
        onClick={showCloseButton ? onClose : undefined}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "glass-panel relative z-10 flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-y-auto rounded-[2rem] p-5 sm:h-auto sm:max-h-[90vh] sm:p-7",
          panelClassName,
        )}
      >
        {showHeader ? (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl text-ink">{title}</h2>
              {subtitle ? (
                <p className="mt-2 text-sm text-ink/65">{subtitle}</p>
              ) : null}
            </div>

            {showCloseButton || headerActions ? (
              <div className="flex shrink-0 items-center gap-3">
                {headerActions}
                {showCloseButton ? (
                  <SecondaryButton className="shrink-0" onClick={onClose}>
                    Close
                  </SecondaryButton>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : showCloseButton || headerActions ? (
          <div className="mb-3 flex justify-end gap-3">
            {headerActions}
            {showCloseButton ? (
              <SecondaryButton className="shrink-0" onClick={onClose}>
                Close
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </div>,
    document.body,
  );
}
