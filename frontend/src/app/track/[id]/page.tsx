"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trackComplaint, ComplaintTrackingResponse } from "@/lib/api";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";

function TrackByIdContent() {
  const params = useParams();
  const ticketId = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<ComplaintTrackingResponse | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    let ignore = false;
    trackComplaint(ticketId)
      .then((res) => {
        if (!ignore) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setErrorMsg(`Incident ticket "${ticketId}" was not found.`);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [ticketId]);

  const deskStatus = data?.desk_status?.toUpperCase() || "NEW";
  const isResolved = deskStatus === "RESOLVED" || data?.status?.toLowerCase() === "resolved";

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-950 min-h-screen py-8 sm:py-12 transition-colors">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="mb-2">
          <Link href="/track" className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 mb-2">
            ← Track Another Ticket
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Verified Municipal Incident</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Incident Progress: {ticketId}
          </h1>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Retrieving live telemetry from municipal database...
            </div>
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{errorMsg}</h3>
            <p className="text-xs text-slate-500">Please check your Tracking ID or submit a new municipal request.</p>
            <Link
              href="/request"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
            >
              Submit New Request
            </Link>
          </div>
        )}

        {/* Success Data */}
        {data && (
          <div className="space-y-6">
            
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
                  <span>Field crew is awaiting specialized equipment or utility permits. Status will update once work resumes.</span>
                </div>
              )}

              {/* Completion Notes */}
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
                Work Order Information
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
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Location</span>
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
            </div>

            {/* Real-time Lifecycle Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Real-Time Operations Timeline
              </h3>

              <div className="space-y-6 relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 ml-3">
                {data.timeline?.map((step, idx) => (
                  <div key={idx} className="relative">
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

export default function TrackByIdPage() {
  return (
    <React.Suspense
      fallback={
        <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Loading incident tracker...
          </div>
        </div>
      }
    >
      <TrackByIdContent />
    </React.Suspense>
  );
}
