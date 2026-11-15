/**
 * Claude API list prices in US dollars per million tokens, used to estimate what each call cost (ai_usage).
 * Checked 2026-11-15; update when Anthropic's prices change. Cache writes are billed at 1.25x input (5-minute cache).
 * A model missing from the table is priced as Claude Opus 5.5, the default.
 */
export const aiPrices: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export const CACHE_WRITE_MULTIPLIER = 1.25;
export const DEFAULT_PRICED_MODEL = "claude-opus-5-5";
