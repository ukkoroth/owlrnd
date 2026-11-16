"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronUpIcon } from "./icons";

type Props = {
  name: string;
  roleLabel: string;
  profileHref: string;
  /** Route that ends the session (wired up in M1). */
  signOutAction: string;
};

/** Profile button at the bottom of the sidebar; opens Profile and Sign out (screens 5a, 5c). */
export function ProfileMenu({ name, roleLabel, profileHref, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex min-h-touch w-full items-center rounded px-3 text-left text-[15px] font-semibold text-ink hover:bg-pale-2";

  return (
    <div ref={root} className="relative">
      {open && (
        <div id={menuId} className="absolute inset-x-0 bottom-[calc(100%+6px)] z-10 flex flex-col gap-0.5 rounded border border-line bg-card p-1.5">
          <Link href={profileHref} className={item} onClick={() => setOpen(false)}>
            Profile
          </Link>
          <form action={signOutAction} method="post">
            <button type="submit" className={item}>
              Sign out
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center gap-2.5 rounded border border-sidebar-border px-2 py-1.5 text-left"
      >
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-semibold text-sidebar">
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="text-xs text-sidebar-muted">{roleLabel}</span>
        </span>
        <ChevronUpIcon />
      </button>
    </div>
  );
}
