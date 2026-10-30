"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getIssue, confirmIssue, MasterIssue, CitizenComplaint } from "@/lib/api";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
      Loading location map...
    </div>
  ),
});

interface IssuePageProps {
  params: Promise<{ id: string }>;
}

function IssueDetailContent({ params }: IssuePageProps) {
  const resolvedParams = use(params);
  const issueId = parseInt(resolvedParams.id, 10);

  const [issue, setIssue] = useState<MasterIssue | null>(null);
  const [complaints, setComplaints] = useState<CitizenComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let ignore = false;
    getIssue(issueId)
      .then((res) => {
        if (!ignore) {
          setIssue(res.issue);
          setComplaints(res.complaints || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setErrorMsg(`Issue #${issueId} could not be found.`);
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [issueId]);

  const handleConfirmAffected = async () => {
    if (!issue) return;
    setConfirming(true);
    try {
      const res = await confirmIssue(issue.id);
      setConfirmed(true);
      setIssue((prev) => (prev ? { ...prev, complaint_count: res.complaint_count } : null));
    } catch {
      alert("Failed to record confirmation. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Loading issue intelligence...</span>
        </div>
      </div>
    );
  }

  if (errorMsg || !issue) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-2">Issue Not Found</h2>
          <p className="text-xs text-slate-500 mb-4">{errorMsg}</p>
          <Link
            href="/map"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs inline-block"
          >
            ← Return to City Map
          </Link>
        </div>
      </div>
    );
  }

  const mapIssuesList = [issue];
  const isResolved = issue.status?.toLowerCase() === "resolved";

  return (
    <div className="w-full bg-slate-50 min-h-screen py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-blue-600">Home</Link>
          <span>/</span>
          <Link href="/map" className="hover:text-blue-600">Explore Map</Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Master Issue #{issue.id.toString().padStart(3, "0")}</span>
        </div>

        {/* Master Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400">
                #{issue.id.toString().padStart(3, "0")}
              </span>
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
              {Boolean(issue.safety_risk) && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  ⚠️ Safety Risk
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">
              Registered on {new Date(issue.created_at).toLocaleDateString()}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {issue.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
            <span className="flex items-center gap-1.5 font-medium">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>{issue.location}</span>
            </span>

            <span className="flex items-center gap-1.5 font-medium">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{issue.department} Department</span>
            </span>

            <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              {issue.complaint_count} Citizen Reports Consolidated
            </span>
          </div>

          {/* Community Confirmation Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Are you also affected by this civic problem?
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Confirming increases department urgency without generating a duplicate ticket.
              </p>
            </div>

            {confirmed ? (
              <div className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold text-center">
                ✓ Recorded! Impact signal escalated.
              </div>
            ) : (
              <button
                onClick={handleConfirmAffected}
                disabled={confirming}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <span>👍</span>
                <span>{confirming ? "Submitting..." : "YES, I'M AFFECTED"}</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. PROBLEM SECTION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              1. Problem Overview &amp; Location
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {issue.latitude?.toFixed(4)}, {issue.longitude?.toFixed(4)}
            </span>
          </div>

          <p className="text-sm text-slate-800 leading-relaxed">
            {issue.description}
          </p>

          {/* Interactive Map Preview with 1 km radius */}
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <CivicMap
              issues={mapIssuesList}
              selectedIssueId={issue.id}
              height="280px"
              center={[issue.latitude ?? 17.4435, issue.longitude ?? 78.3850]}
              zoom={15}
            />
          </div>
        </div>

        {/* 2. AI SUMMARY SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                AI
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Qwen3 Triage Analysis
              </h3>
            </div>
            
            <p className="text-xs text-slate-700 leading-relaxed">
              {issue.description}
            </p>

            {issue.suggested_action && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950">
                <strong className="block text-blue-900 mb-0.5">Suggested Municipal Action:</strong>
                {issue.suggested_action}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Urgency &amp; Public Safety
              </h3>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              {issue.urgency_reason || "Assessed according to traffic density and municipal safety guidelines."}
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <strong className="block text-slate-900 mb-0.5">Assigned Category:</strong>
              {issue.category} {issue.subcategory ? `• ${issue.subcategory}` : ""}
            </div>
          </div>
        </div>

        {/* 3. CITY MEMORY SECTION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                3. City Memory Clustering
              </h2>
              <span className="text-xs text-slate-400">
                Reports consolidated: {issue.complaint_count}
              </span>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
              City Memory 2.0 Active
            </span>
          </div>

          <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs text-blue-950 leading-relaxed">
            <strong className="font-semibold text-blue-900">Semantic &amp; Geographic Rule: </strong>
            BGE-M3 1024-dimensional dense vectors match incoming citizen vocabulary. When semantic similarity &ge; 70% and geodesic distance &le; 1.0 km, complaints automatically merge to prevent duplicate work orders.
          </div>

          {/* Underlying Citizen Complaints */}
          <div className="space-y-3 pt-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Underlying Citizen Reports ({complaints.length})
            </h3>

            {complaints.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
                Initial master issue established from citizen report.
              </p>
            ) : (
              <div className="space-y-2.5">
                {complaints.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold text-blue-700">
                        {c.tracking_id || `CP-${c.id}`}
                      </span>
                      <span className="text-slate-400">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-800 italic">
                      &ldquo;{c.text}&rdquo;
                    </p>

                    {c.photo_url && (
                      <div className="pt-2 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.photo_url}
                          alt="Citizen evidence"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                        />
                        <span className="text-[11px] text-slate-500 font-medium">
                          Citizen Photo Evidence
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. WORKFLOW TIMELINE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              4. Lifecycle Progression
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Status: {issue.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            {/* Stage 1 */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] mx-auto flex items-center justify-center mb-1">✓</span>
              <strong className="block">Reported</strong>
              <span className="text-[10px] text-emerald-700">Ingested</span>
            </div>

            {/* Stage 2 */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] mx-auto flex items-center justify-center mb-1">✓</span>
              <strong className="block">AI Analyzed</strong>
              <span className="text-[10px] text-emerald-700">Qwen3 Triaged</span>
            </div>

            {/* Stage 3 */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] mx-auto flex items-center justify-center mb-1">✓</span>
              <strong className="block">Routed</strong>
              <span className="text-[10px] text-emerald-700">{issue.department}</span>
            </div>

            {/* Stage 4 */}
            <div className={`p-3 rounded-xl border text-xs ${
              isResolved ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-blue-50 border-blue-200 text-blue-900"
            }`}>
              <span className={`w-5 h-5 rounded-full text-white font-bold text-[10px] mx-auto flex items-center justify-center mb-1 ${
                isResolved ? "bg-emerald-600" : "bg-blue-600 animate-pulse"
              }`}>
                {isResolved ? "✓" : "4"}
              </span>
              <strong className="block">Field Dispatch</strong>
              <span className="text-[10px] text-slate-500">{isResolved ? "Completed" : "In Progress"}</span>
            </div>

            {/* Stage 5 */}
            <div className={`p-3 rounded-xl border text-xs col-span-2 sm:col-span-1 ${
              isResolved ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <span className={`w-5 h-5 rounded-full font-bold text-[10px] mx-auto flex items-center justify-center mb-1 ${
                isResolved ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
              }`}>
                {isResolved ? "✓" : "5"}
              </span>
              <strong className="block">Resolved</strong>
              <span className="text-[10px]">{isResolved ? "Verified" : "Pending"}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function IssueDetailPage(props: IssuePageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Loading issue intelligence...</span>
          </div>
        </div>
      }
    >
      <IssueDetailContent {...props} />
    </Suspense>
  );
}
