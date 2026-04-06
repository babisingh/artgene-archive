import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "../lib/providers";
import "./globals.css";
import { Nav } from "./nav";

export const metadata: Metadata = {
  title: "ArtGene Dashboard",
  description: "TINSEL bioinformatics sequence registry platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: apply dark class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('theme');if(m==='dark'||(!m&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
            {children}
          </main>
          <footer className="border-t border-slate-200 dark:border-slate-700 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
            ArtGene · TINSEL Registry v1.0
          </footer>
        </Providers>
      </body>
    </html>
  );
}
