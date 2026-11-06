import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { siteName } from "@/lib/site";
import "./globals.css";

const body = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export function generateMetadata(): Metadata {
  return { title: `${siteName()} — administration`, robots: { index: false, follow: false } };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={body.variable}>
      <body>{children}</body>
    </html>
  );
}
