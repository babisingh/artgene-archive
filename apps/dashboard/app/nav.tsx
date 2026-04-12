"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApiKey } from "../lib/providers";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/register", label: "Register" },
  { href: "/registry", label: "Registry" },
  { href: "/sequences", label: "Sequences" },
  { href: "/getting-started", label: "Help" },
];

export function Nav() {
  const pathname = usePathname();
  const { apiKey, setApiKey } = useApiKey();
  const [dark, setDark] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(saved === "dark" || (!saved && prefersDark));
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function saveKey() {
    setApiKey(keyDraft.trim());
    setShowKeyInput(false);
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4 max-w-7xl flex items-center gap-6 h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
          <span className="text-2xl">🧬</span>
          <span>ArtGene</span>
        </Link>

        {/* Nav links */}
        <nav className="flex gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-md text-base font-semibold transition-colors ${
                pathname === href
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* API Key indicator */}
        <button
          onClick={() => { setKeyDraft(apiKey); setShowKeyInput((v) => !v); }}
          className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 transition-colors"
          title="Set API key"
        >
          {apiKey ? `Key: ${apiKey.slice(0, 8)}…` : "Set API Key"}
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Toggle dark mode"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Inline API key input */}
      {showKeyInput && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">
            X-API-Key:
          </label>
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
            placeholder="Enter your API key"
            className="input flex-1 max-w-sm text-xs py-1"
            autoFocus
          />
          <button onClick={saveKey} className="btn-primary text-xs py-1 px-3">
            Save
          </button>
          <button
            onClick={() => setShowKeyInput(false)}
            className="btn-secondary text-xs py-1 px-3"
          >
            Cancel
          </button>
        </div>
      )}
    </header>
  );
}
