"use client";

import React, { useState, useMemo } from "react";
import { MasterIssue } from "@/lib/api";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";

interface IssuesTableViewProps {
  issues: MasterIssue[];
  loading: boolean;
  onSelectIssue: (id: number) => void;
  onRefresh: () => void;
}

export default function IssuesTableView({
  issues,
  loading,
  onSelectIssue,
  onRefresh,
}: IssuesTableViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "resolved">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Status filter
      if (statusFilter !== "all" && issue.status.toLowerCase() !== statusFilter) {
        return false;
      }
      // Priority filter
      if (priorityFilter !== "all" && issue.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(term);
        const matchesLocation = issue.location.toLowerCase().includes(term);
        const matchesDept = issue.department.toLowerCase().includes(term);
        const matchesCategory = issue.category.toLowerCase().includes(term);
        const matchesId = issue.id.toString() === term;
        return matchesTitle || matchesLocation || matchesDept || matchesCategory || matchesId;
      }
      return true;
    });
  }, [issues, statusFilter, priorityFilter, searchTerm]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Controls: Search, Filters & Refresh */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <svg
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, location, or department..."
            className="w-full pl-9.5 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-xs text-slate-900 placeholder:text-slate-400 transition-all"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "resolved")}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="resolved">Resolved Only</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            title="Refresh Issues"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Issue Title</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4 text-center">Reports</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Updated</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading && issues.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-sm">
                    <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading master issues from SQLite...</p>
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-sm">
                    No issues found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
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
                    <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(issue.updated_at)}
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

        {/* Footer info */}
        <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center px-4">
          <span>Showing {filteredIssues.length} of {issues.length} master issues</span>
          <span className="text-[11px] text-slate-400">Click any row to drill down into underlying citizen complaints</span>
        </div>
      </div>
    </div>
  );
}
