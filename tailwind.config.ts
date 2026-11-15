import type { Config } from "tailwindcss";

// Tokens from docs/08-design.md. Two looks: the app (blue, Inter) and the exam paper (white, STIX Two Text).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Activity shades are picked by count at runtime (bg-activity-0 … bg-activity-4).
  safelist: [{ pattern: /^bg-activity-[0-4]$/ }],
  theme: {
    borderRadius: { none: "0", DEFAULT: "2px", full: "9999px" },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        paper: ["var(--font-stix)", '"Times New Roman"', "serif"],
      },
      colors: {
        page: "#F3F7FF",
        card: "#FFFFFF",
        sidebar: { DEFAULT: "#1E40AF", border: "#3B5FC7", muted: "#D3E0FF" },
        brand: { DEFAULT: "#2563EB" },
        ink: { DEFAULT: "#132C6B", muted: "#4A5F8A" },
        line: { DEFAULT: "#CFDDF5", input: "#A9BCE0" },
        pale: { DEFAULT: "#DCE9FF", 2: "#E3ECFB" },
        danger: { DEFAULT: "#B3261E", fill: "#FBEAE8", text: "#8C1D18" },
        activity: { 0: "#E3ECFB", 1: "#BBD2FB", 2: "#7FA9F5", 3: "#3F7CEB", 4: "#1E40AF" },
        /** Landing page only, hero only (landing hand-off 02-design.md). */
        amber: "#FFC94D",
        paper: {
          bg: "#FFFFFF",
          ink: "#111111",
          muted: "#4D4D4D",
          rule: "#BDBAB0",
          circle: "#8A8880",
          select: "#172F73",
          wrong: "#B3261E",
        },
      },
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
      maxWidth: { app: "1000px", paper: "1240px" },
    },
  },
  plugins: [],
};

export default config;
