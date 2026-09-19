"use client";

import * as React from "react";
import { Check, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type Toast = { id: number; title: string; description?: string; tone: "ok" | "bad" };

const DURATION_MS = 6_000;

export function useToasts() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...toast, id }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-lg border bg-popover/95 p-3 shadow-lg backdrop-blur",
            toast.tone === "ok" ? "border-border" : "border-destructive/40",
          )}
        >
          {toast.tone === "ok" ? (
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
