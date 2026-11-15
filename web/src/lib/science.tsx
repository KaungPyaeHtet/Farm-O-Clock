"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// "One app, two depths" — farmers get the simple view; flipping this on
// reveals the data layers, formulas and sources for extension workers/judges.

type Ctx = { show: boolean; toggle: () => void };

const ScienceContext = createContext<Ctx | null>(null);

export function ScienceProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <ScienceContext.Provider value={{ show, toggle: () => setShow((s) => !s) }}>
      {children}
    </ScienceContext.Provider>
  );
}

export function useScience(): Ctx {
  const c = useContext(ScienceContext);
  if (!c) throw new Error("useScience must be used within ScienceProvider");
  return c;
}
