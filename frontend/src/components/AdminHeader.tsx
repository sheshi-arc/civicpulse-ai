"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getHealth } from "@/lib/api";

export default function AdminHeader() {
  const pathname = usePathname();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const adminNav = [
    { label: "Command Center", href: "/admin" },
    { label: "Live Map", href: "/admin/map" },
    { label: "Departments", href: "/admin/departments" },
    { label: "Analytics", href: "/admin/analytics" },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Operations Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs">
            HQ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                CIVICPULSE COMMAND CENTER
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                OPERATIONAL
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium block leading-none mt-0.5">
              Real-time civic intelligence &amp; department dispatch
            </span>
          </div>
        </div>

        {/* Center: Admin Tab Navigation */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? "bg-white text-blue-700 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Telemetry & Exit to Public */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                online === true ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-[11px] font-medium">
              {online === true ? "AI Engine Connected" : "AI Offline"}
            </span>
          </div>

          <Link
            href="/"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            ← Citizen Portal
          </Link>
        </div>

      </div>
    </div>
  );
}
