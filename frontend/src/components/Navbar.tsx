"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getHealth, seedDemoData } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const [online, setOnline] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoData();
      setSeedSuccess(true);
      setTimeout(() => {
        setSeedSuccess(false);
        window.location.reload();
      }, 1200);
    } catch {
      alert("Failed to load demo dataset. Make sure FastAPI backend is running.");
    } finally {
      setSeeding(false);
    }
  };

  interface NavLinkItem {
    label: string;
    href: string;
    highlight?: boolean;
  }

  const isPublicPage = !pathname?.startsWith("/admin");

  const publicLinks: NavLinkItem[] = [
    { label: "Explore Problems", href: "/map" },
    { label: "Report a Problem", href: "/report", highlight: true },
    { label: "Track Complaint", href: "/track" },
    { label: "How It Works", href: "/#how-it-works" },
  ];

  const adminLinks: NavLinkItem[] = [
    { label: "Command Center", href: "/admin" },
    { label: "Live Map", href: "/admin/map" },
    { label: "Departments", href: "/admin/departments" },
    { label: "Analytics", href: "/admin/analytics" },
  ];

  const activeLinks = isPublicPage ? publicLinks : adminLinks;

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Platform Badge */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-hidden focus:ring-2 focus:ring-blue-600 rounded-lg p-1">
            <div className="w-9 h-9 rounded-xl bg-slate-900 group-hover:bg-blue-600 text-white flex items-center justify-center transition-colors shadow-xs">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                  CivicPulse<span className="text-blue-600">.ai</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {isPublicPage ? "CIVIC PLATFORM" : "ADMIN DESK"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block">
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
                    className="ml-2 px-3.5 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors flex items-center gap-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
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
                      ? "text-blue-700 bg-blue-50 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions: View Switcher + Demo Button + AI Status */}
          <div className="hidden sm:flex items-center gap-2.5">
            {/* Admin / Public Switcher */}
            {isPublicPage ? (
              <Link
                href="/admin"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                title="Switch to Municipal Operations Command Center"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Command Center</span>
              </Link>
            ) : (
              <Link
                href="/"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                title="Return to Public Citizen Portal"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Citizen Portal</span>
              </Link>
            )}

            {/* Demo Data Button */}
            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Loads realistic sample data for demonstration"
              aria-label="Load demo data"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{seedSuccess ? "Demo Loaded" : seeding ? "Loading..." : "Demo Data"}</span>
            </button>

            {/* System Status Indicator */}
            <div
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                online === true
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : online === false
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
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
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
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
          <div className="md:hidden border-t border-slate-200 bg-white p-4 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
              {isPublicPage ? "Public Services" : "Operations Console"}
            </div>
            {activeLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-semibold ${
                  pathname === link.href ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={isPublicPage ? "/admin" : "/"}
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-semibold text-blue-600"
              >
                {isPublicPage ? "→ Switch to Command Center" : "← Switch to Citizen Portal"}
              </Link>
              <button
                onClick={handleSeedDemo}
                className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700"
              >
                Demo Data
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Persistent Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-3 flex items-center justify-around shadow-lg" aria-label="Mobile Bottom Navigation">
        <Link
          href="/"
          className={`flex flex-col items-center text-[10px] font-semibold py-1 px-2 rounded-lg ${
            pathname === "/" ? "text-blue-600 font-bold" : "text-slate-500"
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
            pathname === "/map" ? "text-blue-600 font-bold" : "text-slate-500"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Map
        </Link>

        <Link
          href="/report"
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
            pathname === "/track" ? "text-blue-600 font-bold" : "text-slate-500"
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
            pathname?.startsWith("/admin") ? "text-blue-600 font-bold" : "text-slate-500"
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
