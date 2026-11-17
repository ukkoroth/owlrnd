// Full screen for the exam paper (roadmap: "Exams open in full screen"). Browsers only allow entering full screen
// from a click, and some (iPhone Safari) don't allow it at all: every call here fails quietly, so the exam then
// simply opens in the normal window.

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export const FULLSCREEN_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;

export function fullscreenSupported(): boolean {
  const d = document as WebkitDocument;
  return Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as WebkitDocument;
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

export function enterFullscreen(): void {
  if (!fullscreenSupported() || isFullscreen()) return;
  const el = document.documentElement as WebkitElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen?.();
    void Promise.resolve(p).catch(() => {});
  } catch {}
}

export function exitFullscreen(): void {
  if (!isFullscreen()) return;
  const d = document as WebkitDocument;
  try {
    const p = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.();
    void Promise.resolve(p).catch(() => {});
  } catch {}
}
