"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getHealth } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();
  const [online, setOnline] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  interface NavLinkItem {
    label: string;
    href: string;
    highlight?: boolean;
  }

  const isPublicPage = !pathname?.startsWith("/admin");

  const publicLinks: NavLinkItem[] = [
    { label: "Explore Problems", href: "/map" },
    { label: "Report an Incident", href: "/request", highlight: true },
    { label: "Track Status", href: "/track" },
    { label: "How It Works", href: "/#how-it-works" },
  ];

  const adminLinks: NavLinkItem[] = [
    { label: "Command Center", href: "/admin" },
    { label: "Tickets", href: "/admin/tickets" },
    { label: "Live Map", href: "/admin/map" },
    { label: "Departments", href: "/admin/departments" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Users", href: "/admin/users" },
  ];

  const activeLinks = isPublicPage ? publicLinks : adminLinks;

  return (
    <>
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Platform Badge */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-hidden focus:ring-2 focus:ring-blue-600 rounded-lg p-1">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-blue-600 group-hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-xs">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">
                  CivicPulse<span className="text-blue-600 dark:text-blue-400">.ai</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {isPublicPage ? "CIVIC PLATFORM" : "ADMIN DESK"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                Intelligent City Operations
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {activeLinks.map((link) => {
              const isActive = pathname === link.href;
              if (link.highlight) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="ml-2 px-3.5 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-xs transition-colors flex items-center gap-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    {link.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-600 ${
                    isActive
                      ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 font-bold"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions: Theme Toggle + View Switcher + AI Status */}
          <div className="hidden sm:flex items-center gap-2.5">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Admin / Public Switcher */}
            {isPublicPage ? (
              <Link
                href="/admin"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5"
                title="Switch to Municipal Operations Command Center"
              >
                <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Command Center</span>
              </Link>
            ) : (
              <Link
                href="/"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5"
                title="Return to Public Citizen Portal"
              >
                <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Citizen Portal</span>
              </Link>
            )}

            {/* System Status Indicator */}
            <div
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                online === true
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : online === false
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
              title={online === true ? "Qwen3:4b (Triage) & BGE-M3 (Embeddings) connected" : "AI Services Disconnected"}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  online === true ? "bg-emerald-500" : "bg-rose-500"
                }`}
                aria-hidden="true"
              />
              <span>{online === true ? "AI Online" : "AI Offline"}</span>
            </div>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
              {isPublicPage ? "Public Services" : "Operations Console"}
            </div>
            {activeLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-semibold ${
                  pathname === link.href
                    ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={isPublicPage ? "/admin" : "/"}
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400"
              >
                {isPublicPage ? "→ Switch to Command Center" : "← Switch to Citizen Portal"}
              </Link>
              <ThemeToggle />
            </div>
          </div>
        )}
      </header>

      {/* Persistent Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-1.5 px-3 flex items-center justify-around shadow-lg" aria-label="Mobile Bottom Navigation">
        <Link
          href="/"
          className={`flex flex-col items-center text-[10px] font-semibold py-1 px-2 rounded-lg ${
            pathname === "/" ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </Link>

        <Link
          href="/map"
          className={`flex flex-col items-center text-[10px] font-semibold py-1 px-2 rounded-lg ${
            pathname === "/map" ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Map
        </Link>

        <Link
          href="/request"
          className="flex flex-col items-center text-[10px] font-bold py-1.5 px-3.5 bg-blue-600 text-white rounded-xl shadow-sm -translate-y-2 focus:ring-2 focus:ring-blue-600"
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Report
        </Link>

        <Link
          href="/track"
          className={`flex flex-col items-center text-[10px] font-semibold py-1 px-2 rounded-lg ${
            pathname === "/track" ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Track
        </Link>

        <Link
          href="/admin"
          className={`flex flex-col items-center text-[10px] font-semibold py-1 px-2 rounded-lg ${
            pathname?.startsWith("/admin") ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Admin
        </Link>
      </nav>
    </>
  );
}
