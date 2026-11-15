"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StarIcon } from "./icons";

/** The sidebar points box (students). White while on the points page itself (4.3a). */
export function PointsBox({ points }: { points: { total: number; levelName: string | null; href?: string } }) {
  const path = usePathname();
  const active = !!points.href && path === points.href;
  const body = (
    <>
      <span className="flex items-center gap-2 text-[22px] font-bold">
        <StarIcon />
        {points.total.toLocaleString("en-GB")}
      </span>
      <span className={`text-[13px] ${active ? "text-ink-muted" : "text-sidebar-muted"}`}>points{points.levelName ? ` · ${points.levelName} level` : ""}</span>
    </>
  );
  const cls = `flex flex-col gap-0.5 rounded border px-3 py-2.5 ${active ? "border-white bg-white text-sidebar" : "border-white/70"}`;
  return points.href ? (
    <Link href={points.href} aria-current={active ? "page" : undefined} className={`${cls} ${active ? "" : "hover:bg-sidebar-border"}`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
