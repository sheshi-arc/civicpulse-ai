"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackComplaint, ComplaintTrackingResponse } from "@/lib/api";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";

function TrackContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id") || "";

  const [trackingIdInput, setTrackingIdInput] = useState(initialId);
  const [prevInitialId, setPrevInitialId] = useState(initialId);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<ComplaintTrackingResponse | null>(null);

  if (initialId !== prevInitialId) {
    setPrevInitialId(initialId);
    setTrackingIdInput(initialId);
    setLoading(Boolean(initialId));
  }

  const fetchTracking = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await trackComplaint(id.trim());
      setData(res);
    } catch {
      setErrorMsg(`No complaint found with Tracking ID "${id}". Please verify your ticket ID and try again.`);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialId.trim()) return;
    let ignore = false;
    trackComplaint(initialId.trim())
      .then((res) => {
        if (!ignore) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setErrorMsg(`No complaint found with Tracking ID "${initialId}". Please check the ID and try again.`);
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [initialId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(trackingIdInput);
  };

  const deskStatus = data?.desk_status?.toUpperCase() || "NEW";
  const isResolved = deskStatus === "RESOLVED" || data?.status?.toLowerCase() === "resolved";

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-950 min-h-screen py-8 sm:py-12 transition-colors">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="mb-2">
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 mb-2">
            ← Back to Home
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Citizen Tracking</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Track Incident Progress
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Real-time status tracking for municipal incident dispatch, City Memory clustering, and field resolution.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Enter Tracking ID (e.g. CP-2026-00001)"
                value={trackingIdInput}
                onChange={(e) => setTrackingIdInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono uppercase focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !trackingIdInput.trim()}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Searching...</span>
                </>
              ) : (
                <span>Track Status</span>
              )}
            </button>
          </form>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-3">
            <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-bold">Lookup Unsuccessful</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Tracking Details View */}
        {data && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Top Status Banner */}
            <div className={`p-6 rounded-2xl border ${
              isResolved
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                : deskStatus === "ON_HOLD"
                ? "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                : deskStatus === "COMPLETED"
                ? "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            } shadow-xs space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Incident Tracking ID
                  </span>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                      {data.tracking_id}
                    </h2>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                      deskStatus === "RESOLVED"
                        ? "bg-emerald-600 text-white"
                        : deskStatus === "COMPLETED"
                        ? "bg-blue-600 text-white"
                        : deskStatus === "ON_HOLD"
                        ? "bg-amber-600 text-white"
                        : deskStatus === "IN_PROGRESS"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-700 text-white"
                    }`}>
                      {deskStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={data.status || "active"} />
                  {data.priority && <PriorityBadge priority={data.priority} />}
                </div>
              </div>

              {/* Hold Reason Alert if On Hold */}
              {deskStatus === "ON_HOLD" && (
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl border border-amber-300 dark:border-amber-700 text-xs">
                  <span className="font-bold">Work Temporarily On Hold: </span>
                  <span>Field crew is awaiting materials, machinery, or utility coordination. Progress will resume automatically.</span>
                </div>
              )}

              {/* Completion Notes if Completed or Resolved */}
              {(deskStatus === "COMPLETED" || deskStatus === "RESOLVED") && data.resolution_note && (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl border border-emerald-300 dark:border-emerald-700 text-xs">
                  <span className="font-bold">Resolution Note: </span>
                  <span>{data.resolution_note}</span>
                </div>
              )}
            </div>

            {/* Incident Details Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Incident Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Master Work Order</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {data.issue_title || "Pending AI clustering"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Assigned Department</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {data.department || "Municipal Triage"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Reported Location</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {data.location || "Not specified"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Citizen Reporter</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {data.complaint?.reporter_name || "Verified Citizen"} ({data.complaint?.citizen_email_masked || "Protected"})
                  </span>
                </div>
              </div>

              {data.text && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                    Citizen Complaint Statement
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed italic">
                    &ldquo;{data.text}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Real-time Lifecycle Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Real-Time Operations Timeline
              </h3>

              <div className="space-y-6 relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 ml-3">
                {data.timeline?.map((step, idx) => (
                  <div key={idx} className="relative">
                    {/* Step Icon Node */}
                    <div
                      className={`absolute -left-[31px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                        step.completed
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400"
                      }`}
                    >
                      {step.completed ? "✓" : idx + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${
                          step.completed ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
                        }`}>
                          {step.step}
                        </span>
                        {step.status && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {step.status}
                          </span>
                        )}
                      </div>
                      {step.detail && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {step.detail}
                        </p>
                      )}
                      {step.time && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                          {new Date(step.time).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Loading tracking portal...
          </div>
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
