import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "../lib/providers";
import { SiteHeader } from "../components/design/SiteHeader";
import { SiteFooter } from "../components/design/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArtGene Archive",
  description: "Cryptographic provenance and biosafety certification for synthetic gene sequences.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="app">
        <Providers>
          <SiteHeader />
          <main className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
