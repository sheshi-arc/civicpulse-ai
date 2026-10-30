"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";
import { getIssues, resolveIssue, MasterIssue } from "@/lib/api";

const DEPARTMENTS = [
  "All",
  "Public Works",
  "Sanitation",
  "Water Supply",
  "Electricity",
  "Traffic",
  "Parks",
  "Public Safety",
];

export default function AdminDepartmentsPage() {
  const [issues, setIssues] = useState<MasterIssue[]>([]);
  const [selectedDept, setSelectedDept] = useState("All");
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    getIssues()
      .then((res) => {
        if (!ignore) {
          setIssues(res.issues);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load department issues:", err);
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
      await resolveIssue(id);
      setIssues((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "resolved" } : i))
      );
    } catch {
      alert("Failed to resolve issue.");
    } finally {
      setResolvingId(null);
    }
  };

  // Department counts
  const deptStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number; critical: number; resolved: number }> = {};
    DEPARTMENTS.forEach((d) => {
      stats[d] = { total: 0, active: 0, critical: 0, resolved: 0 };
    });

    issues.forEach((i) => {
      const d = i.department || "Other";
      if (!stats[d]) {
        stats[d] = { total: 0, active: 0, critical: 0, resolved: 0 };
      }
      stats[d].total += 1;
      if (i.status === "resolved") {
        stats[d].resolved += 1;
      } else {
        stats[d].active += 1;
        if (i.priority.toLowerCase() === "critical" || i.priority.toLowerCase() === "high") {
          stats[d].critical += 1;
        }
      }
    });

    return stats;
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (selectedDept === "All") return issues;
    return issues.filter((i) => i.department.toLowerCase() === selectedDept.toLowerCase());
  }, [issues, selectedDept]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
        <AdminHeader />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Loading department telemetry...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <AdminHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Department Dispatch &amp; Workflows
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complaints auto-routed to respective civic departments by Qwen3 classification with SLA tracking.
          </p>
        </div>

        {/* Department Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {DEPARTMENTS.map((dept) => {
            const count = dept === "All" ? issues.length : (deptStats[dept]?.total || 0);
            const isSelected = selectedDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{dept}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Department Overview Cards */}
        {selectedDept !== "All" && deptStats[selectedDept] && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                Total Assigned
              </span>
              <span className="text-2xl font-black text-slate-900">
                {deptStats[selectedDept].total}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-2xs">
              <span className="text-[11px] font-bold text-red-600 uppercase block mb-1">
                Urgent / Critical
              </span>
              <span className="text-2xl font-black text-red-700">
                {deptStats[selectedDept].critical}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                In Progress
              </span>
              <span className="text-2xl font-black text-slate-800">
                {deptStats[selectedDept].active}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block mb-1">
                Resolved
              </span>
              <span className="text-2xl font-black text-emerald-800">
                {deptStats[selectedDept].resolved}
              </span>
            </div>
          </div>
        )}

        {/* Issues List for Department */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Assigned Tickets: {selectedDept} ({filteredIssues.length})
            </span>
            <span className="text-xs text-slate-400">
              Sorted by Priority &amp; Citizen Impact
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredIssues.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No tickets currently assigned to {selectedDept}.
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        #{issue.id.toString().padStart(3, "0")}
                      </span>
                      <PriorityBadge priority={issue.priority} size="sm" />
                      <StatusBadge status={issue.status} size="sm" />
                      <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
                        {issue.complaint_count} citizen reports
                      </span>
                    </div>

                    <Link
                      href={`/issues/${issue.id}`}
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {issue.title}
                    </Link>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {issue.description}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                      <span>📍 {issue.location}</span>
                      <span>&bull;</span>
                      <span>Assigned to {issue.department}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/issues/${issue.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                    >
                      Full Details
                    </Link>

                    {issue.status !== "resolved" && (
                      <button
                        onClick={() => handleResolve(issue.id)}
                        disabled={resolvingId === issue.id}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {resolvingId === issue.id ? "Resolving..." : "Mark Resolved"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
