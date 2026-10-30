"use client";

import React, { useMemo } from "react";
import { MasterIssue } from "@/lib/api";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";

interface DashboardViewProps {
  issues: MasterIssue[];
  loading: boolean;
  onSelectIssue: (id: number) => void;
  onNavigateToIssues: () => void;
  onNavigateToSubmit: () => void;
}

export default function DashboardView({
  issues,
  loading,
  onSelectIssue,
  onNavigateToIssues,
  onNavigateToSubmit,
}: DashboardViewProps) {
  // Aggregate statistics
  const stats = useMemo(() => {
    let activeIssues = 0;
    let resolvedIssues = 0;
    let totalComplaints = 0;
    let criticalIssues = 0;
    let highIssues = 0;
    const departmentCounts: Record<string, number> = {};

    for (const issue of issues) {
      if (issue.status.toLowerCase() === "resolved") {
        resolvedIssues++;
      } else {
        activeIssues++;
        totalComplaints += issue.complaint_count || 1;

        const p = issue.priority.toLowerCase();
        if (p === "critical") criticalIssues++;
        else if (p === "high") highIssues++;

        const dept = issue.department || "Other";
        departmentCounts[dept] = (departmentCounts[dept] || 0) + (issue.complaint_count || 1);
      }
    }

    return {
      activeIssues,
      resolvedIssues,
      totalComplaints,
      criticalIssues,
      highIssues,
      departmentCounts,
    };
  }, [issues]);

  const recentIssues = useMemo(() => {
    return [...issues].slice(0, 6);
  }, [issues]);

  const departmentList = useMemo(() => {
    return Object.entries(stats.departmentCounts).sort((a, b) => b[1] - a[1]);
  }, [stats.departmentCounts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Welcome / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Municipal Command Center
          </h2>
          <p className="text-sm text-slate-500">
            Real-time citizen complaint clustering, semantic triage, and municipal dispatch.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToSubmit}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Report New Complaint
          </button>
        </div>
      </div>

      {/* KPI Statistic Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Active Issues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Issues</span>
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {loading ? "..." : stats.activeIssues}
          </p>
          <span className="text-[11px] text-blue-600 font-semibold block">Master Issues Open</span>
        </div>

        {/* Total Citizen Complaints */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Complaints</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {loading ? "..." : stats.totalComplaints}
          </p>
          <span className="text-[11px] text-slate-500 font-medium block">Underlying Citizen Reports</span>
        </div>

        {/* Critical Priority */}
        <div className="bg-white p-5 rounded-2xl border border-red-200/80 shadow-xs space-y-1 bg-gradient-to-br from-white to-red-50/20">
          <div className="flex items-center justify-between text-xs text-red-600 font-medium">
            <span>Critical Priority</span>
            <span className="w-2 h-2 rounded-full bg-red-600" />
          </div>
          <p className="text-3xl font-extrabold text-red-700 tracking-tight">
            {loading ? "..." : stats.criticalIssues}
          </p>
          <span className="text-[11px] text-red-600/80 font-medium block">Urgent Public Hazard</span>
        </div>

        {/* High Priority */}
        <div className="bg-white p-5 rounded-2xl border border-orange-200/80 shadow-xs space-y-1 bg-gradient-to-br from-white to-orange-50/20">
          <div className="flex items-center justify-between text-xs text-orange-600 font-medium">
            <span>High Priority</span>
            <span className="w-2 h-2 rounded-full bg-orange-500" />
          </div>
          <p className="text-3xl font-extrabold text-orange-700 tracking-tight">
            {loading ? "..." : stats.highIssues}
          </p>
          <span className="text-[11px] text-orange-600/80 font-medium block">Escalated Attention</span>
        </div>

        {/* Resolved Issues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Resolved Issues</span>
            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 tracking-tight">
            {loading ? "..." : stats.resolvedIssues}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium block">Completed Actions</span>
        </div>
      </div>

      {/* Second Row: Department Distribution & AI City Memory Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Department Distribution</h3>
              <p className="text-xs text-slate-500">Citizen complaints routed by Qwen3 classification</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
              {departmentList.length} Departments
            </span>
          </div>

          {departmentList.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center italic">No active complaints registered yet.</p>
          ) : (
            <div className="space-y-4">
              {departmentList.map(([dept, count]) => {
                const percentage = stats.totalComplaints > 0 ? Math.round((count / stats.totalComplaints) * 100) : 0;
                return (
                  <div key={dept} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800 font-semibold">{dept}</span>
                      <span className="text-slate-500 font-mono">
                        {count} complaints ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI "City Memory" Explain Card (1 col) */}
        <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-800/60 border border-blue-700/60 text-xs font-semibold text-blue-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              City Memory Active
            </div>
            <h3 className="text-lg font-bold leading-snug">
              BGE-M3 Semantic Clustering
            </h3>
            <p className="text-xs text-blue-100/80 leading-relaxed">
              When citizens report the same civic damage using completely different phrasing, CivicPulse AI maps them to 1024-dimensional semantic vectors and merges duplicate tickets.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1 text-xs">
            <span className="text-blue-300 font-mono font-semibold block">Clustering Threshold: 70%</span>
            <p className="text-slate-200 text-[11px]">
              Similarity &ge; 0.70 clusters automatically into existing Master Issues.
            </p>
          </div>
        </div>
      </div>

      {/* Master Issues Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Master Issues</h3>
            <p className="text-xs text-slate-500">Grouped citizen problems requiring municipal action</p>
          </div>
          <button
            onClick={onNavigateToIssues}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Issues ({issues.length})</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Issue Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-center">Reports</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading && issues.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-sm">
                    Loading issues...
                  </td>
                </tr>
              ) : recentIssues.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-sm">
                    No civic issues reported yet. Submit your first complaint to see AI clustering in action.
                  </td>
                </tr>
              ) : (
                recentIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => onSelectIssue(issue.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-500">
                      #{issue.id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-blue-700 transition-colors max-w-xs truncate">
                      {issue.title}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {issue.category}
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={issue.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {issue.department}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 max-w-[140px] truncate">
                      {issue.location || "Not specified"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold font-mono">
                        {issue.complaint_count}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={issue.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-800 flex items-center justify-end gap-1">
                        View
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
