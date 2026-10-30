"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getAnalyticsOverview, getIssues, AnalyticsOverview, MasterIssue } from "@/lib/api";
import CityMemoryShowcase from "@/components/CityMemoryShowcase";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";
import dynamic from "next/dynamic";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
      <div className="flex items-center gap-2 text-sm font-medium">
        <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Loading live city map...
      </div>
    </div>
  ),
});

export default function LandingPage() {
  const [stats, setStats] = useState<AnalyticsOverview | null>(null);
  const [recentIssues, setRecentIssues] = useState<MasterIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      getAnalyticsOverview(),
      getIssues({ limit: 4 }),
    ])
      .then(([overview, issuesRes]) => {
        if (!ignore) {
          setStats(overview);
          setRecentIssues(issuesRes.issues);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load landing page data:", err);
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200 pt-12 pb-16 sm:pt-20 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Heading & CTAs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>CivicPulse AI • Municipal Intelligence Platform</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
                Turn citizen complaints into actionable city intelligence.
              </h1>

              {/* Supporting Copy */}
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl font-normal">
                Report a problem. Let AI understand it. Help your city act faster.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link
                  href="/request"
                  className="px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors text-center flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>REPORT AN INCIDENT</span>
                </Link>

                <Link
                  href="/map"
                  className="px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-300 shadow-xs transition-colors text-center flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>EXPLORE CITY PROBLEMS</span>
                </Link>

                <Link
                  href="/track"
                  className="px-4 py-3.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors text-center"
                >
                  Track Complaint →
                </Link>
              </div>

              {/* Live Backend Telemetry Strip */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 max-w-lg">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Reports</span>
                  <span className="text-2xl font-black text-slate-900">
                    {loading ? "..." : stats?.total_complaints ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Master Issues</span>
                  <span className="text-2xl font-black text-blue-700">
                    {loading ? "..." : stats?.total_issues ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Resolved</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {loading ? "..." : stats?.resolved_issues ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Visual City Intelligence Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Live City Intelligence Preview
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    Active Municipal Incident
                  </span>
                </div>

                {/* Example Problem Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span>Main Gate • Ward 14</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">
                        Road Damage &amp; Deep Tarmac Depression
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      High Priority
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-500 block">Consolidated Reports</span>
                      <span className="text-xl font-black text-blue-700 font-mono mt-0.5 block">
                        37 reports
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-500 block">Assigned Unit</span>
                      <span className="text-sm font-bold text-slate-800 mt-1 block">
                        Public Works
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
                    <strong className="font-semibold text-blue-950">City Memory 2.0 Action: </strong>
                    37 distinct citizen reports merged into 1 municipal work order based on 88% semantic similarity and &le; 0.1 km distance.
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 text-center">
                  Zero manual triage. High-fidelity clustering eliminates 90%+ ticket duplication.
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* The Concept: Citizen Reports -> AI Understanding -> City Memory -> Department Action -> Resolution */}
      <section id="how-it-works" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              The CivicPulse Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              From Citizen Signal to Physical Resolution
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              How CivicPulse transforms scattered everyday reports into structured municipal action.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {/* Step 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center mb-3">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Citizen Reports</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Citizens submit plain-text reports, location coordinates, and photo evidence in under 30 seconds.
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-4 block uppercase tracking-wider">
                Step 1: Ingestion
              </span>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-3">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">AI Understanding</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Local Qwen3 language model extracts problem category, safety hazard, urgency level, and summary.
                </p>
              </div>
              <span className="text-[10px] font-bold text-blue-600 mt-4 block uppercase tracking-wider">
                Step 2: AI Triage
              </span>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center mb-3">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">City Memory</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  BGE-M3 dense embeddings and Haversine geo-distance check if this real-world problem was already logged.
                </p>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 mt-4 block uppercase tracking-wider">
                Step 3: Clustering
              </span>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center mb-3">
                  4
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Department Action</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Direct routing to Public Works, Sanitation, Water, or Electricity with prioritized dispatch.
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-600 mt-4 block uppercase tracking-wider">
                Step 4: Dispatch
              </span>
            </div>

            {/* Step 5 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mb-3">
                  5
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Resolution</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Municipal crew completes work; photographic proof verified; all citizen tracking tickets updated.
                </p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 mt-4 block uppercase tracking-wider">
                Step 5: Verified Close
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Architecture: City Memory 2.0 Showcase */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CityMemoryShowcase />
        </div>
      </section>

      {/* Live Map Preview & Real Issues */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Active Municipal Registry</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                Live City Activity
              </h2>
            </div>
            <Link
              href="/map"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              Open Full Interactive Map →
            </Link>
          </div>

          {/* Interactive Map Mini-View */}
          <div className="mb-8 rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
            <CivicMap issues={recentIssues} height="360px" zoom={13} interactive={true} />
          </div>

          {/* Real Issues Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentIssues.map((issue) => (
              <Link
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="bg-white hover:bg-slate-50/80 border border-slate-200 p-4 rounded-xl shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      #{issue.id.toString().padStart(3, "0")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={issue.priority} size="sm" />
                      <StatusBadge status={issue.status} size="sm" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                    {issue.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                    {issue.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 truncate max-w-[140px]">
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="truncate">{issue.location || "City Area"}</span>
                  </span>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                    {issue.complaint_count} {issue.complaint_count === 1 ? "report" : "reports"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Municipal Command Center Banner */}
      <section className="bg-slate-900 text-white py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Municipal Personnel &amp; Department Officers
            </div>
            <h3 className="text-2xl font-bold tracking-tight">
              City Operations Command Center
            </h3>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Access real-time telemetry, department backlog queues, live spatial clustering, and verified resolution workflows.
            </p>
          </div>
          <Link
            href="/admin"
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xs transition-colors shrink-0 flex items-center gap-2"
          >
            Launch Command Center →
          </Link>
        </div>
      </section>
    </div>
  );
}
