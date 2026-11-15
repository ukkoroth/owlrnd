import type { Metadata } from "next";
import { Inter, STIX_Two_Text } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const stix = STIX_Two_Text({ subsets: ["latin"], variable: "--font-stix", display: "swap" });

export const metadata: Metadata = {
  title: "owlrnd",
  description: "Short, paper-style practice exams that adapt to each result.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render every page per request, so each response carries its own Content-Security-Policy nonce (middleware.ts).
  await connection();
  return (
    <html lang="en" className={`${inter.variable} ${stix.variable}`}>
      <body>{children}</body>
    </html>
  );
}
