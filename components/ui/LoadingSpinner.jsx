"use client";

export default function LoadingSpinner() {
  return (
    <div className="relative h-14 w-14">
      <span className="absolute inset-0 rounded-full border-4 border-amber/20" />
      <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-coral border-r-amber" />
    </div>
  );
}
