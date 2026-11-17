"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { enterFullscreen } from "./fullscreen";

/**
 * A Start or Continue link into an exam paper. The click asks for full screen (only a click may), then the paper
 * opens through client-side navigation, so the page stays in full screen. If the browser refuses, the paper opens
 * normally.
 */
export function ExamLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e);
        // A new tab or window (Ctrl/Cmd-click, middle click) shouldn't put this page in full screen.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        enterFullscreen();
      }}
    />
  );
}
