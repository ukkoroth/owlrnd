import type { MetadataRoute } from "next";

// Web app manifest with the logo kit's app icons (public/icon-192.png, public/icon-512.png).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "owlrnd",
    short_name: "owlrnd",
    description: "Short, paper-style practice exams that adapt to each result.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3F7FF",
    theme_color: "#1E40AF",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
