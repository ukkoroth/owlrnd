"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * While an exam is being written in the background, re-reads the page every few seconds so it appears without the
 * learner reloading (first exams take about half a minute). Stops after a few minutes; renders nothing.
 */
export function RefreshWhileWaiting({ everyMs = 5_000, forMs = 3 * 60_000 }: { everyMs?: number; forMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > forMs || document.hidden) return;
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, forMs]);
  return null;
}
