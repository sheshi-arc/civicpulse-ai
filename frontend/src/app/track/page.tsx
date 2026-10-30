"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackComplaint, ComplaintTrackingResponse, TrackingTimelineStep } from "@/lib/api";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";

const SAMPLE_TRACKING_IDS = ["CP-2026-00001", "CP-2026-00002", "CP-2026-00003"];

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
      setErrorMsg(`No complaint found with Tracking ID "${id}". Please check the ID or try one of the samples below.`);
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
          setErrorMsg(`No complaint found with Tracking ID "${initialId}". Please check the ID or try one of the samples below.`);
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

  const handleSampleClick = (sampleId: string) => {
    setTrackingIdInput(sampleId);
    fetchTracking(sampleId);
  };

  const isResolved =
    data?.status?.toLowerCase() === "resolved" ||
    data?.complaint?.issue_status?.toLowerCase() === "resolved" ||
    data?.complaint?.desk_status === "CLOSED" ||
    data?.complaint?.desk_status === "RESOLVED_PENDING_REVIEW";

  return (
    <div className="w-full bg-slate-50 min-h-screen py-8 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="mb-2">
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 mb-2">
            ← Back to Home
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Citizen Tracking</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Track Your Complaint
          </h1>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            Real-time status tracking for municipal incident dispatch, City Memory clustering, and field resolution.
          </p>
        </div>

        {/* Tracking Search Input */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={trackingIdInput}
                onChange={(e) => setTrackingIdInput(e.target.value)}
                placeholder="Enter CivicPulse Tracking ID (e.g. CP-2026-00001)"
                className="w-full pl-10 pr-3 py-3 text-sm font-mono font-bold uppercase rounded-xl outline-none text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-blue-600 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !trackingIdInput.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Locating...</span>
                </>
              ) : (
                <span>Track Incident →</span>
              )}
            </button>
          </form>
        </div>

        {/* Sample Tracking IDs */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-400">Quick Test Samples:</span>
          {SAMPLE_TRACKING_IDS.map((sampleId) => (
            <button
              key={sampleId}
              type="button"
              onClick={() => handleSampleClick(sampleId)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-blue-700 border border-slate-200 font-mono font-bold cursor-pointer transition-colors"
            >
              {sampleId}
            </button>
          ))}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-amber-700 hover:text-amber-950 font-bold ml-2 cursor-pointer">
              ×
            </button>
          </div>
        )}

        {/* Tracking Details (Package Style) */}
        {data && (
          <div className="space-y-6">
            
            {/* Status & Package Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Citizen Tracking ID
                  </span>
                  <span className="text-2xl font-mono font-black text-slate-900">
                    {data.tracking_id}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={data.status || data.complaint?.issue_status || "active"} />
                  <PriorityBadge priority={data.priority || data.complaint?.priority || "Medium"} />
                </div>
              </div>

              {/* Status Alert Banner */}
              {isResolved ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div className="text-xs">
                    <strong className="font-bold block text-sm text-emerald-950">Marked Resolved</strong>
                    <span>
                      The assigned department has completed municipal repair work.
                      {data.complaint?.resolution_receipt && ` Receipt: ${data.complaint.resolution_receipt}.`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    !
                  </div>
                  <div className="text-xs">
                    <strong className="font-bold block text-sm text-blue-950">Your issue is still active</strong>
                    <span>
                      Assigned to {data.department || data.complaint?.department || "Public Works"} department. Maintenance crew is actively tracking work order.
                    </span>
                  </div>
                </div>
              )}

              {/* Core Attributes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                    Master Issue
                  </span>
                  <Link
                    href={`/issues/${data.issue_id || 1}`}
                    className="font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1 text-sm"
                  >
                    <span>{data.issue_title || data.complaint?.issue_title || "Civic Work Order"}</span>
                    <span>→</span>
                  </Link>
                  <span className="text-slate-500 block mt-0.5">
                    📍 {data.location || data.complaint?.location || "City Location"}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                    Department Unit
                  </span>
                  <span className="font-bold text-slate-900 block text-sm">
                    {data.department || data.complaint?.department || "Public Works"} Department
                  </span>
                  <span className="text-slate-500 block mt-0.5">
                    Category: {data.category || data.complaint?.category || "Infrastructure"}
                  </span>
                </div>
              </div>

              {/* Submitted Complaint Snippet */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                  Your Original Complaint
                </span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 italic leading-relaxed">
                  &ldquo;{data.text || data.complaint?.text}&rdquo;
                </p>
                {data.complaint?.created_at && (
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Reported on {new Date(data.complaint.created_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Stepped Progress Timeline (Package Tracker Style) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Progress Timeline</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  Municipal Sync
                </span>
              </div>

              <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {data.timeline?.map((step: TrackingTimelineStep, idx: number) => (
                  <div key={idx} className="relative flex items-start gap-4">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold ${
                        step.completed
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white text-slate-400 border-2 border-slate-300"
                      }`}
                    >
                      {step.completed ? "✓" : idx + 1}
                    </div>

                    <div className="flex-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={`text-xs font-bold ${
                            step.completed ? "text-slate-900" : "text-slate-500"
                          }`}
                        >
                          {step.step || step.stage || `Stage ${idx + 1}`}
                        </h3>
                        {(step.time || step.timestamp) && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(step.time || step.timestamp || "").toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{step.detail || step.description}</p>
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400 bg-slate-50 min-h-screen">Loading tracking telemetry...</div>}>
      <TrackContent />
    </Suspense>
  );
}
