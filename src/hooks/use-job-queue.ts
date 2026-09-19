"use client";

import * as React from "react";

import type { JobWithAssets } from "@/lib/queries";
import type { AssetView, JobView } from "@/lib/serialize";

export type QueuedJob = JobWithAssets;

const POLL_START_MS = 2_000;
const POLL_MAX_MS = 10_000;
const POLL_BACKOFF = 1.25;

const ACTIVE = new Set(["queued", "running"]);

export function isActiveStatus(status: string) {
  return ACTIVE.has(status);
}

export type SubmitResult = { ok: true } | { ok: false; code: string; message: string };

export type FinishedJob = { job: JobView; assets: AssetView[] };

/**
 * Owns the render queue on the client.
 *
 * It starts from whatever the server handed over, so a refresh mid-render picks
 * up the same jobs rather than losing them. Cards appear the moment you hit
 * Generate, and the poll backs off while nothing changes and snaps back to 2s
 * on any change — a fast render still feels immediate without hammering the
 * server during a slow one.
 */
export function useJobQueue(
  initialBalance: number | null,
  initialJobs: QueuedJob[] = [],
  onFinished?: (finished: FinishedJob) => void,
) {
  const [jobs, setJobs] = React.useState<QueuedJob[]>(initialJobs);
  const [balance, setBalance] = React.useState<number | null>(initialBalance);
  const delayRef = React.useRef(POLL_START_MS);

  const finishedRef = React.useRef(onFinished);
  React.useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  const activeIds = jobs.filter((job) => ACTIVE.has(job.status)).map((job) => job.id);
  const activeKey = activeIds.join(",");

  const applyJob = React.useCallback((job: JobView, assets: AssetView[]) => {
    setJobs((current) => {
      let changed = false;
      let completed = false;

      const next = current.map((existing) => {
        if (existing.id !== job.id) return existing;
        if (existing.status !== job.status || assets.length !== existing.assets.length) {
          changed = true;
        }
        // Only announce the moment a job stops being active.
        if (ACTIVE.has(existing.status) && !ACTIVE.has(job.status)) completed = true;
        return { ...existing, ...job, assets };
      });

      if (changed) delayRef.current = POLL_START_MS;
      if (completed) finishedRef.current?.({ job, assets });
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!activeKey) {
      delayRef.current = POLL_START_MS;
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      await Promise.all(
        activeKey.split(",").map(async (id) => {
          try {
            const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
            if (!response.ok) return;
            const data = (await response.json()) as {
              job: JobView;
              assets: AssetView[];
              balance: number;
            };
            if (cancelled) return;
            applyJob(data.job, data.assets);
            setBalance(data.balance);
          } catch {
            // A dropped poll is not an error the user needs to see; try again.
          }
        }),
      );

      if (cancelled) return;
      delayRef.current = Math.min(delayRef.current * POLL_BACKOFF, POLL_MAX_MS);
      timer = setTimeout(tick, delayRef.current);
    };

    timer = setTimeout(tick, delayRef.current);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeKey, applyJob]);

  const submit = React.useCallback(
    async (modelId: string, input: Record<string, unknown>): Promise<SubmitResult> => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ modelId, input }),
        });
        const data = await response.json();

        if (!response.ok) {
          return {
            ok: false,
            code: data?.error?.code ?? "server_error",
            message: data?.error?.message ?? "Something went wrong.",
          };
        }

        delayRef.current = POLL_START_MS;
        setJobs((current) => [{ ...(data.job as JobView), assets: [] }, ...current]);
        if (typeof data.balance === "number") setBalance(data.balance);
        return { ok: true };
      } catch {
        return { ok: false, code: "network", message: "Could not reach the server." };
      }
    },
    [],
  );

  const cancel = React.useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
        const data = await response.json();
        if (response.ok) {
          applyJob(data.job as JobView, []);
          if (typeof data.balance === "number") setBalance(data.balance);
        }
      } catch {
        // Leave the card alone; the next poll will settle it.
      }
    },
    [applyJob],
  );

  return { jobs, balance, submit, cancel };
}
