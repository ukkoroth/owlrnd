// Next.js runs register() once per server process. Start the background job worker there.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OWLRND_DISABLE_WORKER !== "1") {
    const { registerAllHandlers } = await import("./server/jobs/handlers");
    const { startWorker } = await import("./server/jobs/worker");
    registerAllHandlers();
    startWorker();
  }
}
