import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A package-lock.json higher up (in the home folder) confuses Next.js root detection.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  // pg, postmark and nodemailer are Node-only; keep them out of the client bundle.
  serverExternalPackages: ["pg", "postmark", "nodemailer"],
  experimental: {
    serverActions: { bodySizeLimit: "40mb" }, // textbook photos and PDFs in the track chat (M3)
  },
};

export default nextConfig;
