"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import AdminHeader from "@/components/AdminHeader";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";
import { getMapIssues, resolveIssue, MapIssue } from "@/lib/api";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-semibold">
      Loading Command Map Telemetry...
    </div>
  ),
});

export default function AdminLiveMapPage() {
  const [issues, setIssues] = useState<MapIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<MapIssue | null>(null);
  const [resolving, setResolving] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  useEffect(() => {
    let ignore = false;
    getMapIssues()
      .then((res) => {
        if (!ignore) {
          setIssues(res.issues);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load admin map:", err);
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (statusFilter !== "all" && i.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (priorityFilter !== "all" && i.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      if (categoryFilter !== "all" && i.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (departmentFilter !== "all" && i.department.toLowerCase() !== departmentFilter.toLowerCase()) return false;
      return true;
    });
  }, [issues, statusFilter, priorityFilter, categoryFilter, departmentFilter]);

  // Top Hotspots (issues with highest complaints)
  const hotspots = useMemo(() => {
    return [...issues]
      .filter((i) => i.status !== "resolved")
      .sort((a, b) => b.complaint_count - a.complaint_count)
      .slice(0, 5);
  }, [issues]);

  const handleResolve = async (id: number) => {
    if (!confirm(`Mark Issue #${id} as RESOLVED?`)) return;
    setResolving(true);
    try {
      await resolveIssue(id);
      setIssues((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "resolved" } : i))
      );
      if (selectedIssue && selectedIssue.id === id) {
        setSelectedIssue((prev) => (prev ? { ...prev, status: "resolved" } : null));
      }
    } catch {
      alert("Failed to resolve issue.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900">
      <AdminHeader />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Operational Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 hidden md:flex shadow-xs">
          {/* Filter Section */}
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Map Layer Filters</span>
              <span className="text-[11px] text-blue-700 font-mono font-bold">
                {loading ? "Loading..." : `${filtered.length} active pins`}
              </span>
            </h2>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="all">All Incidents</option>
                  <option value="active">Active Only</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="all">All Categories</option>
                  <option value="Roads">Roads</option>
                  <option value="Sanitation">Sanitation</option>
                  <option value="Water Supply">Water Supply</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Traffic">Traffic</option>
                  <option value="Public Safety">Public Safety</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="all">All Departments</option>
                  <option value="Public Works">Public Works</option>
                  <option value="Sanitation">Sanitation</option>
                  <option value="Water Supply">Water Supply</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Traffic Safety">Traffic Safety</option>
                  <option value="Parks & Environment">Parks &amp; Environment</option>
                </select>
              </div>
            </div>
          </div>

          {/* Hotspots Concentration List */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1.5">
              <span>Identified Cluster Hotspots</span>
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Locations where citizen complaints are clustering the heaviest:
            </p>

            <div className="space-y-2">
              {hotspots.map((h, idx) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedIssue(h)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedIssue?.id === h.id
                      ? "bg-blue-50/70 border-blue-500 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-mono font-bold text-slate-400">#{idx + 1}</span>
                    <span className="font-bold text-blue-700 bg-white px-2 py-0.5 rounded text-[10px] border border-blue-200">
                      {h.complaint_count} reports
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{h.title}</h4>
                  <span className="text-[11px] text-slate-500 block line-clamp-1 mt-0.5">
                    📍 {h.location}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Canvas: Live Map */}
        <div className="flex-1 relative h-full">
          <CivicMap
            issues={filtered}
            selectedIssueId={selectedIssue?.id}
            height="100%"
            center={[17.4435, 78.3850]}
            zoom={13}
            onIssueClick={(issue) => setSelectedIssue(issue)}
            interactive={true}
          />

          {/* Selected Issue Drawer Card */}
          {selectedIssue && (
            <div className="absolute top-4 right-4 w-96 bg-white border border-slate-200 p-5 rounded-2xl shadow-xl z-20 text-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    #{selectedIssue.id.toString().padStart(3, "0")}
                  </span>
                  <PriorityBadge priority={selectedIssue.priority} size="sm" />
                  <StatusBadge status={selectedIssue.status} size="sm" />
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer"
                  aria-label="Close panel"
                >
                  &times;
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {selectedIssue.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  📍 {selectedIssue.location}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-bold text-slate-900">{selectedIssue.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Citizen Reports:</span>
                  <span className="font-bold text-blue-700">{selectedIssue.complaint_count} consolidated</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">City Memory Catchment:</span>
                  <span className="font-semibold text-emerald-700">1.0 km radius active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coordinates:</span>
                  <span className="font-mono text-slate-700">
                    {selectedIssue.latitude != null ? selectedIssue.latitude.toFixed(4) : "—"},{" "}
                    {selectedIssue.longitude != null ? selectedIssue.longitude.toFixed(4) : "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/issues/${selectedIssue.id}`}
                  className="flex-1 py-2 text-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
                >
                  View Details
                </Link>

                {selectedIssue.status !== "resolved" && (
                  <button
                    onClick={() => handleResolve(selectedIssue.id)}
                    disabled={resolving}
                    className="flex-1 py-2 text-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {resolving ? "Resolving..." : "Mark Resolved"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
