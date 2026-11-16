import { rules } from "@/config/rules";

/** The demo AI allowance as the sidebar tracker shows it (0.2 plan, M7). */
export type AllowanceState = {
  usedUsd: number;
  limitUsd: number;
  /** 0–100, for the progress bar. */
  percent: number;
  level: "ok" | "warn" | "used_up";
  usedUp: boolean;
};

export function allowanceState(usedUsd: number, limitUsd: number): AllowanceState {
  const share = limitUsd > 0 ? usedUsd / limitUsd : 1;
  const usedUp = share >= 1;
  return {
    usedUsd,
    limitUsd,
    percent: Math.min(100, Math.max(0, Math.round(share * 100))),
    level: usedUp ? "used_up" : share >= rules.aiLimits.allowanceWarnAt ? "warn" : "ok",
    usedUp,
  };
}

/** "$3.20 of $10 used": whole dollars without cents, otherwise two decimals. */
export function formatUsd(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}
