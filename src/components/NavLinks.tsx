"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; /** Path prefixes that also mark this item active. */ match?: string[] };

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1.5 md:flex-col">
      {items.map((item) => {
        const active = [item.href, ...(item.match ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex h-11 flex-1 items-center gap-3 rounded px-3 text-[15px] font-semibold md:flex-none " +
              (active ? "bg-white text-sidebar" : "text-white hover:bg-sidebar-border")
            }
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
