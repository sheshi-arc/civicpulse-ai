"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getAdminDashboard, getAdminMe, AdminDashboardResponse, AdminUser } from "@/lib/api";

export default function AdminOverviewPage() {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const loadData = useCallback(() => {
    getAdminMe()
      .then((userRes) => {
        setCurrentUser(userRes.user);
        setIsAuthenticated(true);
        return getAdminDashboard();
      })
      .then((dashRes) => {
        if (dashRes) {
          setDashboardData(dashRes);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setCurrentUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If checking authentication
  if (loading && isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg mb-4 animate-pulse">
          HQ
        </div>
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">
          Connecting to Command Center...
        </p>
      </div>
    );
  }

  // If not authenticated, render login form inline
  if (!isAuthenticated) {
    return <AdminLoginForm onSuccess={loadData} />;
  }

  const stats = dashboardData?.stats;
  const role = currentUser?.role || "OPERATIONS";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Role Welcome Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Live Operations Command
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Welcome, {currentUser?.name || "Operations Officer"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Role: <strong className="text-white">{role}</strong> • Department: <strong className="text-blue-400">{currentUser?.department_slug?.replace("_", " ") || "All Municipal Units"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/tickets"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2"
            >
              <span>Manage Tickets</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Primary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Master Orders</span>
            <span className="text-2xl font-black text-white block">
              {loading ? "..." : stats?.total_issues ?? 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Reports</span>
            <span className="text-2xl font-black text-amber-400 block">
              {loading ? "..." : stats?.new ?? 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned</span>
            <span className="text-2xl font-black text-blue-400 block">
              {loading ? "..." : stats?.assigned ?? 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In Progress</span>
            <span className="text-2xl font-black text-indigo-400 block">
              {loading ? "..." : stats?.in_progress ?? 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">On Hold</span>
            <span className="text-2xl font-black text-yellow-500 block">
              {loading ? "..." : stats?.on_hold ?? 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</span>
            <span className="text-2xl font-black text-cyan-400 block">
              {loading ? "..." : stats?.completed ?? 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resolved</span>
            <span className="text-2xl font-black text-emerald-400 block">
              {loading ? "..." : stats?.resolved ?? 0}
            </span>
          </div>
        </div>

        {/* Second Row: High/Critical urgency alert & Total Reports */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-rose-900/60 p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Critical / High Priority Incidents</span>
              <p className="text-xs text-slate-400">Incidents flagged with safety risks or urgent public hazards</p>
            </div>
            <span className="text-3xl font-black text-rose-400 font-mono">
              {loading ? "..." : stats?.high_critical ?? 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Citizen Reports Ingested</span>
              <p className="text-xs text-slate-400">Individual reports clustered into master work orders</p>
            </div>
            <span className="text-3xl font-black text-white font-mono">
              {loading ? "..." : stats?.total_complaints ?? 0}
            </span>
          </div>
        </div>

        {/* Department Workload Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">Department Workload Distribution</h2>
              <p className="text-xs text-slate-400 mt-0.5">Active municipal workload across operational units</p>
            </div>
            <Link
              href="/admin/tickets"
              className="text-xs text-blue-400 hover:text-blue-300 font-bold"
            >
              View All Work Orders →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData?.workload?.map((w, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="text-xs font-bold text-white">{w.department}</h3>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {w.issue_count} orders
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                  <span>Resolved: <strong className="text-emerald-400">{w.resolved_count}</strong></span>
                  <span>High Risk: <strong className="text-rose-400">{w.high_risk_count}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
