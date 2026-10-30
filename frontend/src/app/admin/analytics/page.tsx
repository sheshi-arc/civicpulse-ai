"use client";

import React, { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import { getAnalyticsOverview, AnalyticsOverview } from "@/lib/api";

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalyticsOverview()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
        <AdminHeader />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Aggregating municipal telemetry...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!stats || stats.total_issues === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
        <AdminHeader />
        <div className="flex-1 max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Telemetry Data Accumulating</h2>
            <p className="text-xs text-slate-500">
              More data will appear as citizens submit reports and City Memory clusters real-world work orders.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const categoryEntries = Object.entries(stats.by_category || {});
  const deptEntries = Object.entries(stats.by_department || {});

  const maxCategoryCount = Math.max(...categoryEntries.map(([, c]) => c), 1);
  const maxDeptCount = Math.max(...deptEntries.map(([, c]) => c), 1);

  const resolutionRate =
    stats.total_issues > 0
      ? Math.round((stats.resolved_issues / stats.total_issues) * 100)
      : 0;

  const deduplicationFactor =
    stats.total_issues > 0
      ? (stats.total_complaints / stats.total_issues).toFixed(1)
      : "1.0";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>Municipal Performance Metrics</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            City Civic Intelligence Analytics
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real data aggregated from citizen reports, Qwen3 language triage, and City Memory 2.0 spatial clusters.
          </p>
        </div>

        {/* 1. Top Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Deduplication Ratio
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-700">
                {deduplicationFactor}x
              </span>
              <span className="text-xs text-slate-400">reports/issue</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              City Memory consolidated {Math.max(0, stats.total_complaints - stats.total_issues)} duplicate tickets
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Resolution Clearance
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-700">
                {resolutionRate}%
              </span>
              <span className="text-xs text-slate-400">closed</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.resolved_issues} resolved of {stats.total_issues} work orders
            </p>
          </div>

          <div className="bg-white border border-rose-200 bg-rose-50/20 p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block mb-1">
              Critical Hazards
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-700">
                {stats.critical_priority_issues}
              </span>
              <span className="text-xs text-rose-500">urgent</span>
            </div>
            <p className="text-[11px] text-rose-600 mt-1">
              Requiring emergency municipal intervention
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Active Backlog
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {stats.active_issues}
              </span>
              <span className="text-xs text-slate-400">in flight</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Currently routed to department crews
            </p>
          </div>
        </div>

        {/* 2. Charts: Categories & Departments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Category Distribution */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                Issues by Problem Category
              </h2>
              <span className="text-xs text-slate-400 font-mono">Qwen3 Classified</span>
            </div>

            <div className="space-y-3">
              {categoryEntries.length > 0 ? (
                categoryEntries.map(([cat, count]) => {
                  const pct = Math.round((count / maxCategoryCount) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{cat}</span>
                        <span className="font-mono font-bold text-slate-900">{count} issues</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No category data recorded yet.</p>
              )}
            </div>
          </div>

          {/* Department Workload Distribution */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                Department Workload Distribution
              </h2>
              <span className="text-xs text-slate-400 font-mono">Auto-Dispatched</span>
            </div>

            <div className="space-y-3">
              {deptEntries.length > 0 ? (
                deptEntries.map(([dept, count]) => {
                  const pct = Math.round((count / maxDeptCount) * 100);
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{dept}</span>
                        <span className="font-mono font-bold text-slate-900">{count} issues</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No department allocations recorded yet.</p>
              )}
            </div>
          </div>

        </div>

        {/* 3. Priority Profile & Hotspots */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Priority Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Priority Severity Profile
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100">
                <span className="font-semibold text-rose-800">Critical Priority</span>
                <span className="font-black text-rose-900 font-mono">{stats.critical_priority_issues}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                <span className="font-semibold text-amber-800">High Priority</span>
                <span className="font-black text-amber-900 font-mono">{stats.high_priority_issues}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Medium / Standard</span>
                <span className="font-black text-slate-900 font-mono">
                  {Math.max(0, stats.total_issues - stats.critical_priority_issues - stats.high_priority_issues)}
                </span>
              </div>
            </div>
          </div>

          {/* Top Hotspots */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                Geographic Problem Hotspots
              </h2>
              <span className="text-xs text-slate-400">By citizen report density</span>
            </div>

            <div className="space-y-2">
              {stats.top_hotspots && stats.top_hotspots.length > 0 ? (
                stats.top_hotspots.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="font-bold text-slate-800">{h.location}</span>
                    </div>
                    <span className="font-mono font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded border border-blue-200">
                      {h.count} citizen complaints
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No location hotspots established yet.</p>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
