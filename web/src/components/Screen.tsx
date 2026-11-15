"use client";

import type { ReactNode } from "react";

/** Shared screen frame: same padding, title style and width on every step.
 *  Phone = single column; desktop = wide dashboard (max 72rem). */
export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 lg:px-8 lg:py-8">
        <h2 className="text-lg font-extrabold text-ink lg:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted lg:text-base">{subtitle}</p>}
        <div className="mt-4 lg:mt-6">{children}</div>
      </div>
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-clay/25 bg-clay/10 p-4 text-sm text-clay">
      {children}
    </div>
  );
}
