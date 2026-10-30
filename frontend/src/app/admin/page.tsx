"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import AdminHeader from "@/components/AdminHeader";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";
import { getAnalyticsOverview, getIssues, resolveIssue, AnalyticsOverview, MasterIssue } from "@/lib/api";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
      <div className="flex items-center gap-2 font-medium">
        <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Loading city intelligence map...
      </div>
    </div>
  ),
});

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AnalyticsOverview | null>(null);
  const [issues, setIssues] = useState<MasterIssue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [overview, issuesRes] = await Promise.all([
        getAnalyticsOverview(),
        getIssues(),
      ]);
      setStats(overview);
      setIssues(issuesRes.issues);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([getAnalyticsOverview(), getIssues()])
      .then(([overview, issuesRes]) => {
        if (!ignore) {
          setStats(overview);
          setIssues(issuesRes.issues);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch admin data:", err);
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleResolve = async (id: number) => {
    if (!confirm(`Mark Master Issue #${id} as RESOLVED?`)) return;
    setResolvingId(id);
    try {
      const res = await resolveIssue(id);
      setIssues((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "resolved", resolved_at: res.resolved_at } : i))
      );
      const newStats = await getAnalyticsOverview();
      setStats(newStats);
    } catch {
      alert("Failed to resolve issue. Check backend connection.");
    } finally {
      setResolvingId(null);
    }
  };

  // Filtered issues
  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (priorityFilter !== "all" && i.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && i.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (departmentFilter !== "all" && i.department.toLowerCase() !== departmentFilter.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const mTitle = i.title.toLowerCase().includes(q);
        const mLoc = (i.location || "").toLowerCase().includes(q);
        const mDept = i.department.toLowerCase().includes(q);
        const mId = i.id.toString().includes(q);
        if (!mTitle && !mLoc && !mDept && !mId) return false;
      }
      return true;
    });
  }, [issues, priorityFilter, statusFilter, departmentFilter, search]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              Live Municipal Operations
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              CIVICPULSE COMMAND CENTER
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Real-time civic intelligence, automated triage, and cross-department work order dispatch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLoading(true);
                fetchData();
              }}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Telemetry</span>
            </button>
            <Link
              href="/admin/map"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>Command Map View →</span>
            </Link>
          </div>
        </div>

        {/* 1. Real KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Active Issues
            </span>
            <span className="text-3xl font-black text-slate-900">
              {loading ? "..." : stats?.active_issues ?? 0}
            </span>
            <span className="text-[11px] text-blue-600 font-medium block mt-1">Pending resolution</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Citizen Reports
            </span>
            <span className="text-3xl font-black text-blue-700">
              {loading ? "..." : stats?.total_complaints ?? 0}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">Raw citizen signals</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block mb-1">
              Critical Issues
            </span>
            <span className="text-3xl font-black text-rose-700">
              {loading ? "..." : stats?.critical_priority_issues ?? 0}
            </span>
            <span className="text-[11px] text-rose-600 font-medium block mt-1">Immediate safety hazard</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
              High Priority
            </span>
            <span className="text-3xl font-black text-amber-800">
              {loading ? "..." : stats?.high_priority_issues ?? 0}
            </span>
            <span className="text-[11px] text-amber-600 block mt-1">24h target SLA</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
              Resolved Issues
            </span>
            <span className="text-3xl font-black text-emerald-800">
              {loading ? "..." : stats?.resolved_issues ?? 0}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium block mt-1">
              {stats && stats.total_issues > 0
                ? `${Math.round((stats.resolved_issues / stats.total_issues) * 100)}% clearance`
                : "0%"}
            </span>
          </div>
        </div>

        {/* 2. LIVE CITY INTELLIGENCE MAP WITH HOTSPOTS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live City Intelligence Map</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time geographic clusters with 1.0 km City Memory catchment radiuses
              </p>
            </div>
            <Link
              href="/admin/map"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Open Fullscreen Command Map →
            </Link>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
            <CivicMap
              issues={issues}
              height="360px"
              center={[17.4435, 78.3850]}
              zoom={13}
              interactive={true}
            />
          </div>
        </div>

        {/* 3. PRIORITY QUEUE & DEPARTMENT LOAD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Priority Queue (Left 7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Priority Dispatch Queue
                </h2>
                <p className="text-xs text-slate-500">Sorted by immediate municipal urgency</p>
              </div>

              {/* Priority Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {["all", "critical", "high", "medium", "low"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(p)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      priorityFilter === p
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Priority Queue List */}
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {filtered.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-slate-400 font-bold">#{item.id}</span>
                      <PriorityBadge priority={item.priority} size="sm" />
                      <span className="text-slate-500 font-medium truncate">{item.department}</span>
                    </div>
                    <Link
                      href={`/issues/${item.id}`}
                      className="font-bold text-slate-900 hover:text-blue-600 truncate block text-sm"
                    >
                      {item.title}
                    </Link>
                    <span className="text-slate-500 block truncate mt-0.5">
                      📍 {item.location} • {item.complaint_count} reports
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {item.status !== "resolved" && (
                      <button
                        onClick={() => handleResolve(item.id)}
                        disabled={resolvingId === item.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition-colors cursor-pointer"
                      >
                        {resolvingId === item.id ? "Resolving..." : "Resolve"}
                      </button>
                    )}
                    <Link
                      href={`/issues/${item.id}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Load Breakdown (Right 5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Department Workload
                </h2>
                <p className="text-xs text-slate-500">Live active work orders per unit</p>
              </div>
              <Link
                href="/admin/departments"
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Manage All →
              </Link>
            </div>

            <div className="space-y-3">
              {stats?.departments && stats.departments.length > 0 ? (
                stats.departments.map((dept, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{dept.department}</span>
                      <span className="font-mono font-bold text-slate-600">
                        {dept.count} {dept.count === 1 ? "issue" : "issues"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(12, (dept.count / Math.max(1, stats.total_issues)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center">
                  Loading department allocations...
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 4. RECENT MASTER ISSUES MANAGEMENT TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Municipal Master Work Orders ({filtered.length})
              </h2>
              <p className="text-xs text-slate-500">
                Consolidated real-world problem units triaged by Qwen3 and grouped by City Memory
              </p>
            </div>

            {/* Filter Tools */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search issues, areas..."
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 outline-none w-44"
              />

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none"
              >
                <option value="all">All Departments</option>
                <option value="public works">Public Works</option>
                <option value="sanitation">Sanitation</option>
                <option value="water supply">Water Supply</option>
                <option value="electricity">Electricity</option>
                <option value="traffic safety">Traffic Safety</option>
                <option value="parks & environment">Parks &amp; Environment</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none"
              >
                <option value="all">Status: All</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Issue</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Reports</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs">
                      <Link href={`/issues/${item.id}`} className="hover:text-blue-600 block line-clamp-1">
                        #{item.id} {item.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={item.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {item.complaint_count}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {item.department}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-[160px] truncate">
                      {item.location}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 shrink-0">
                      <Link
                        href={`/issues/${item.id}`}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
                      >
                        Inspect
                      </Link>
                      {item.status !== "resolved" && (
                        <button
                          onClick={() => handleResolve(item.id)}
                          disabled={resolvingId === item.id}
                          className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 transition-colors cursor-pointer"
                        >
                          {resolvingId === item.id ? "..." : "Resolve"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
