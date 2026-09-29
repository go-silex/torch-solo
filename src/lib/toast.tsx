"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Toasts minimalistes : un store module, un composant monté dans la coque.
 * `toast("Fiche dupliquée")` depuis n'importe quel composant client.
 */
type Toast = { id: number; message: string; tone: "ok" | "error" };
const listeners = new Set<(t: Toast) => void>();
let nextId = 1;

export function toast(message: string, tone: Toast["tone"] = "ok") {
  const t = { id: nextId++, message, tone };
  listeners.forEach((cb) => cb(t));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const cb = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3000);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-full px-4 py-2 text-[13px] shadow-[0_12px_36px_rgba(3,22,53,0.18)]",
            t.tone === "ok"
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "bg-[var(--peach)] text-white",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
