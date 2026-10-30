"use client";

import React, { useSyncExternalStore } from "react";

function applyTheme(t: "light" | "dark" | "system") {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
  } else if (t === "light") {
    root.classList.remove("dark");
  } else {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getThemeSnapshot(): "light" | "dark" | "system" {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem("civicpulse_theme") as "light" | "dark" | "system" | null;
  return saved || "system";
}

function getServerThemeSnapshot(): "light" | "dark" | "system" {
  return "system";
}

export default function ThemeToggle() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const handleToggle = (next: "light" | "dark" | "system") => {
    localStorage.setItem("civicpulse_theme", next);
    applyTheme(next);
    window.dispatchEvent(new Event("storage"));
  };

  if (!isClient) {
    return <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  }

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
      <button
        type="button"
        onClick={() => handleToggle("light")}
        title="Light theme"
        className={`p-1.5 rounded-md transition-colors ${
          theme === "light"
            ? "bg-white text-amber-500 shadow-xs"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        }`}
        aria-label="Light mode"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => handleToggle("dark")}
        title="Dark Command Center theme"
        className={`p-1.5 rounded-md transition-colors ${
          theme === "dark"
            ? "bg-slate-900 text-blue-400 shadow-xs"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        }`}
        aria-label="Dark mode"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => handleToggle("system")}
        title="Follow system theme"
        className={`p-1.5 rounded-md transition-colors ${
          theme === "system"
            ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-xs"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        }`}
        aria-label="System theme"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}
