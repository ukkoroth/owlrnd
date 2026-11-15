import "server-only";
import { claimNext, markDone, markFailed, requeueStale } from "./queue";

export type JobContext = { attempt: number; isLastAttempt: boolean };
type Handler = (payload: unknown, ctx: JobContext) => Promise<void>;

const handlers = new Map<string, Handler>();

/** Register a job handler. Handlers are added per milestone (marking in M5, exam generation in M3/M4). */
export function registerHandler(type: string, handler: Handler) {
  handlers.set(type, handler);
}

const globalForWorker = globalThis as unknown as { owlrndWorker?: { stop: () => void } };

/** In-process worker: polls the jobs table. One per server process; safe with several thanks to SKIP LOCKED. */
export function startWorker({ pollMs = 1_000 } = {}) {
  if (globalForWorker.owlrndWorker) return globalForWorker.owlrndWorker;

  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    if (stopped) return;
    try {
      // Drain everything that's ready, then sleep.
      for (let job = await claimNext(); job && !stopped; job = await claimNext()) {
        const handler = handlers.get(job.type);
        try {
          if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
          await handler(job.payload, { attempt: job.attempts, isLastAttempt: job.attempts >= job.max_attempts });
          await markDone(job.id);
        } catch (err) {
          console.error(`[owlrnd jobs] ${job.type} ${job.id} failed (attempt ${job.attempts})`, err);
          await markFailed(job.id, job.attempts, job.max_attempts, err);
        }
      }
    } catch (err) {
      console.error("[owlrnd jobs] worker loop error", err);
    }
    if (!stopped) timer = setTimeout(tick, pollMs);
  };

  void requeueStale().catch((err) => console.error("[owlrnd jobs] requeueStale failed", err));
  timer = setTimeout(tick, pollMs);

  globalForWorker.owlrndWorker = {
    stop() {
      stopped = true;
      clearTimeout(timer);
      globalForWorker.owlrndWorker = undefined;
    },
  };
  return globalForWorker.owlrndWorker;
}
