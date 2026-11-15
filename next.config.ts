import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A package-lock.json higher up (in the home folder) confuses Next.js root detection.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  // pg, postmark and nodemailer are Node-only; keep them out of the client bundle.
  serverExternalPackages: ["pg", "postmark", "nodemailer"],
  poweredByHeader: false,
  // Fixed security headers on every response (the per-request Content-Security-Policy is set in middleware.ts;
  // HSTS is set by Caddy, which terminates HTTPS).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The camera stays allowed for "Take photo" in the track chat; everything else is off.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "40mb" }, // textbook photos and PDFs in the track chat (M3)
  },
};

export default nextConfig;
