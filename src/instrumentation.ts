// Next.js runs register() once per server process. The nodejs check must wrap the imports (not return early):
// Next.js drops this block from the edge build only when it is written this way.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Check every setting at start-up: a missing or invalid one stops the server here with a clear message,
    // instead of failing later on the first request that needs it.
    const { env } = await import("./server/env");
    const settings = env();

    if (process.env.OWLRND_DISABLE_WORKER !== "1") {
      const { registerAllHandlers } = await import("./server/jobs/handlers");
      const { startWorker } = await import("./server/jobs/worker");
      registerAllHandlers();
      startWorker({ concurrency: settings.JOB_CONCURRENCY });
    }
  }
}
