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

/**
 * In-process worker: `concurrency` independent slots, each claiming and running one job at a time from the jobs
 * table (SKIP LOCKED, so slots and processes never take the same job). Jobs mostly wait on Claude, so several run at
 * once on one small server; a slow job in one slot doesn't hold up the others.
 */
export function startWorker({ pollMs = 1_000, concurrency = 1 } = {}) {
  if (globalForWorker.owlrndWorker) return globalForWorker.owlrndWorker;

  let stopped = false;
  const sleepers = new Set<() => void>();
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(done, ms);
      function done() {
        clearTimeout(t);
        sleepers.delete(done);
        resolve();
      }
      sleepers.add(done);
    });

  const runJob = async (job: NonNullable<Awaited<ReturnType<typeof claimNext>>>) => {
    const handler = handlers.get(job.type);
    try {
      if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
      await handler(job.payload, { attempt: job.attempts, isLastAttempt: job.attempts >= job.max_attempts });
      await markDone(job.id);
    } catch (err) {
      console.error(`[owlrnd jobs] ${job.type} ${job.id} failed (attempt ${job.attempts})`, err);
      await markFailed(job.id, job.attempts, job.max_attempts, err);
    }
  };

  const slot = async (n: number) => {
    // Stagger the slots so idle polling is spread out.
    await sleep((pollMs * n) / Math.max(concurrency, 1));
    while (!stopped) {
      try {
        const job = await claimNext();
        if (job) await runJob(job);
        else await sleep(pollMs);
      } catch (err) {
        console.error("[owlrnd jobs] worker loop error", err);
        await sleep(pollMs);
      }
    }
  };

  void requeueStale().catch((err) => console.error("[owlrnd jobs] requeueStale failed", err));
  for (let n = 0; n < Math.max(1, concurrency); n++) void slot(n);

  globalForWorker.owlrndWorker = {
    stop() {
      stopped = true;
      for (const wake of [...sleepers]) wake();
      globalForWorker.owlrndWorker = undefined;
    },
  };
  return globalForWorker.owlrndWorker;
}
