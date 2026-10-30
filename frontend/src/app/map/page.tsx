"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getMapIssues, confirmIssue, MapIssue } from "@/lib/api";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-slate-100 flex items-center justify-center text-slate-400">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Loading city geospatial data...
      </div>
    </div>
  ),
});

export default function PublicMapPage() {
  const [issues, setIssues] = useState<MapIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<MapIssue | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Geolocation
  const [centerCoords, setCenterCoords] = useState<[number, number]>([17.4435, 78.3850]);

  useEffect(() => {
    let ignore = false;
    getMapIssues()
      .then((res) => {
        if (!ignore) {
          setIssues(res.issues);
          if (res.issues.length > 0) {
            const valid = res.issues.filter((i) => typeof i.latitude === "number" && typeof i.longitude === "number");
            if (valid.length > 0 && valid[0].latitude != null && valid[0].longitude != null) {
              setCenterCoords([valid[0].latitude, valid[0].longitude]);
            }
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load map issues:", err);
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (priorityFilter !== "all" && issue.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }
      if (categoryFilter !== "all" && issue.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && issue.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (departmentFilter !== "all" && issue.department.toLowerCase() !== departmentFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchLoc = (issue.location || "").toLowerCase().includes(q);
        const matchCat = issue.category.toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchCat) return false;
      }
      return true;
    });
  }, [issues, priorityFilter, categoryFilter, statusFilter, departmentFilter, searchQuery]);

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenterCoords([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        alert("Unable to retrieve your current location.");
      }
    );
  };

  const handleConfirmAffected = async (id: number) => {
    setConfirming(true);
    try {
      const res = await confirmIssue(id);
      setConfirmedSuccess(true);
      setIssues((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, complaint_count: res.complaint_count } : item
        )
      );
      if (selectedIssue && selectedIssue.id === id) {
        setSelectedIssue((prev: MapIssue | null) => (prev ? { ...prev, complaint_count: res.complaint_count } : null));
      }
      setTimeout(() => setConfirmedSuccess(false), 2500);
    } catch {
      alert("Failed to confirm issue. Please check backend connection.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] relative overflow-hidden bg-slate-50">
      
      {/* Top Controls Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search problems, wards, categories..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-slate-900 bg-slate-50 focus:bg-white transition-colors"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none font-medium"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none font-medium"
            >
              <option value="all">All Categories</option>
              <option value="roads">Roads</option>
              <option value="sanitation">Sanitation</option>
              <option value="water supply">Water Supply</option>
              <option value="electricity">Electricity</option>
              <option value="traffic">Traffic</option>
              <option value="parks">Parks</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none font-medium"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none font-medium"
            >
              <option value="all">All Departments</option>
              <option value="public works">Public Works</option>
              <option value="sanitation">Sanitation</option>
              <option value="water supply">Water Supply</option>
              <option value="electricity">Electricity</option>
              <option value="traffic safety">Traffic Safety</option>
              <option value="parks & environment">Parks &amp; Environment</option>
            </select>

            {/* Near Me Button */}
            <button
              onClick={handleNearMe}
              className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200"
              title="Locate around my current position"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>Near Me</span>
            </button>
          </div>

          {/* Counts & Report Link */}
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-500">
              {loading ? (
                "Loading map pins..."
              ) : (
                <>Showing <strong className="text-slate-900">{filteredIssues.length}</strong> problems</>
              )}
            </span>
            <Link
              href="/report"
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1"
            >
              + Report Problem
            </Link>
          </div>

        </div>
      </div>

      {/* Main Map Area + Slide-over Drawer */}
      <div className="flex-1 relative w-full h-[calc(100vh-120px)] min-h-[500px]">
        <CivicMap
          issues={filteredIssues}
          selectedIssueId={selectedIssue?.id}
          height="100%"
          center={centerCoords}
          zoom={13}
          onIssueClick={(issue) => setSelectedIssue(issue)}
          interactive={true}
        />

        {/* Floating Map Legend */}
        <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md border border-slate-200 p-2.5 rounded-xl shadow-xs text-[11px] hidden sm:block">
          <span className="font-bold text-slate-700 block mb-1">Issue Priority:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>Critical</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>High</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>Medium</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Low</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>Resolved</span>
          </div>
        </div>

        {/* Selected Issue Drawer Card */}
        {selectedIssue && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 z-20 bg-white border border-slate-200 rounded-2xl p-5 shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-400">
                  #{selectedIssue.id.toString().padStart(3, "0")}
                </span>
                <PriorityBadge priority={selectedIssue.priority} size="sm" />
                <StatusBadge status={selectedIssue.status} size="sm" />
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="w-6 h-6 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer text-sm"
                aria-label="Close card"
              >
                &times;
              </button>
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-snug mb-1">
              {selectedIssue.title}
            </h3>

            <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>{selectedIssue.location}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Department</span>
                <span className="font-semibold text-slate-800">{selectedIssue.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Reports</span>
                <span className="font-bold text-blue-700">{selectedIssue.complaint_count} consolidated</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 mb-3 flex items-center justify-between">
              <span>Last Updated: {new Date(selectedIssue.updated_at).toLocaleDateString()}</span>
              <span className="text-blue-600 font-semibold">1.0 km Catchment Active</span>
            </div>

            {/* Community Confirmation */}
            {confirmedSuccess ? (
              <div className="mb-3 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold text-center">
                ✓ Recorded! Impact signal escalated.
              </div>
            ) : (
              <button
                onClick={() => handleConfirmAffected(selectedIssue.id)}
                disabled={confirming}
                className="w-full mb-2.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>👍</span>
                <span>{confirming ? "Recording..." : "I'm Affected by this Too"}</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <Link
                href={`/issues/${selectedIssue.id}`}
                className="w-full py-2.5 text-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                VIEW ISSUE →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
