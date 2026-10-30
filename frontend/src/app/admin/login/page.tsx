"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/api";

const SEEDED_ROLES = [
  { email: "sheshitejs@gmail.com", label: "Super Admin (Full Access)", role: "SUPER_ADMIN" },
  { email: "ssheshitej96@gmail.com", label: "Operations Admin (Sanitation & Parks)", role: "ADMIN" },
  { email: "ssaicharan229@gmail.com", label: "Department Manager (Water Supply)", role: "DEPARTMENT_MANAGER" },
  { email: "anaalia696@gmail.com", label: "Department Manager (Electricity)", role: "DEPARTMENT_MANAGER" },
  { email: "nandhinichakala@gmail.com", label: "Department Manager (Traffic Safety)", role: "DEPARTMENT_MANAGER" },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("sheshitejs@gmail.com");
  const [password, setPassword] = useState("CivicPulse@Admin2026!");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      await loginAdmin(email.trim(), password);
      router.push("/admin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectRoleShortcut = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("CivicPulse@Admin2026!");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg">
            HQ
          </div>
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-black tracking-tight text-white">
          CivicPulse Command Center
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Municipal Administration, Role-Based Dispatch &amp; Operations Desk
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-800/90 border border-slate-700/80 py-8 px-6 shadow-xl rounded-2xl sm:px-10 space-y-6">

          {/* Quick Role Fill Shortcuts */}
          <div className="space-y-2 pb-4 border-b border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Switch Role Account (Demo / Testing):
            </span>
            <div className="flex flex-col gap-1.5">
              {SEEDED_ROLES.map((r) => (
                <button
                  key={r.email}
                  type="button"
                  onClick={() => selectRoleShortcut(r.email)}
                  className={`text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center justify-between ${
                    email === r.email
                      ? "bg-blue-600/20 border-blue-500 text-blue-300 font-bold"
                      : "bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-700/60"
                  }`}
                >
                  <span className="truncate">{r.label}</span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-1">Select</span>
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Authorized Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Authenticating Session...</span>
                </>
              ) : (
                <span>SIGN IN TO COMMAND CENTER</span>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href="/" className="text-xs text-slate-400 hover:text-white transition-colors">
              ← Return to Citizen Portal
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
