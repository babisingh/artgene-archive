import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "../lib/providers";
import { SiteHeader } from "../components/design/SiteHeader";
import { SiteFooter } from "../components/design/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ArtGene Archive",
    template: "%s | ArtGene Archive",
  },
  description:
    "A public catalogue of AI-designed biological sequences, published and unpublished, each screened for biosafety before it is listed.",
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
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="app">
        <Providers>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
