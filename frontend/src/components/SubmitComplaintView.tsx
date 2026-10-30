"use client";

import React, { useState } from "react";
import { submitComplaint, SubmitComplaintResponse } from "@/lib/api";
import PriorityBadge from "./PriorityBadge";

interface SubmitComplaintViewProps {
  onIssueSelected?: (issueId: number) => void;
  onComplaintSubmitted?: () => void;
}

const SAMPLE_COMPLAINTS = [
  {
    label: "Main Gate Pothole",
    text: "There is a huge pothole near the main gate and bikes are almost falling.",
    location: "Main Gate",
  },
  {
    label: "Damaged Road (Duplicate)",
    text: "The road near the main entrance is badly damaged and dangerous for two wheelers.",
    location: "Main Entrance",
  },
  {
    label: "Market Garbage Overflow",
    text: "Garbage has not been collected from the market area for three days and bins are overflowing.",
    location: "Market Area",
  },
  {
    label: "Broken Streetlight",
    text: "The street light in Sector 4 park is completely dark and unsafe at night.",
    location: "Sector 4 Park",
  },
  {
    label: "Water Pipe Leak",
    text: "Drinking water pipe is leaking heavily on 5th Cross Road, wasting clean water.",
    location: "5th Cross Road",
  },
];

export default function SubmitComplaintView({
  onIssueSelected,
  onComplaintSubmitted,
}: SubmitComplaintViewProps) {
  const [complaintText, setComplaintText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitComplaintResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = complaintText.trim();
    if (!trimmed) {
      setError("Please describe the civic issue before submitting.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    // If citizen provided location, ensure it's contextually included if not already in text
    let fullText = trimmed;
    if (locationText.trim() && !trimmed.toLowerCase().includes(locationText.trim().toLowerCase())) {
      fullText = `${trimmed} (Location: ${locationText.trim()})`;
    }

    try {
      const response = await submitComplaint({ complaint: fullText });
      setResult(response);
      setComplaintText("");
      setLocationText("");
      if (onComplaintSubmitted) {
        onComplaintSubmitted();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit complaint";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePickSample = (sample: typeof SAMPLE_COMPLAINTS[0]) => {
    setComplaintText(sample.text);
    setLocationText(sample.location);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Intro Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Citizen Complaint Reporting Portal
        </h2>
        <p className="text-sm text-slate-500">
          Report civic issues like potholes, waste dumps, broken streetlights, or drainage failures.
          Our AI automatically understands, prioritizes, and clusters your report with existing city issues.
        </p>
      </div>

      {/* Main Grid: Form on Left, Result or Info on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Submission Form Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          {/* Quick-Pick Samples */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Quick Test Samples (One-Click)
            </label>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_COMPLAINTS.map((sample, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePickSample(sample)}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 transition-colors cursor-pointer"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="complaint" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Complaint Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="complaint"
                rows={4}
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="Describe the problem in your own words (e.g., 'There is a huge pothole near the main gate and bikes are almost falling.')..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all resize-none"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Location or Landmark <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="location"
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g., Near Main Gate, Market Square, 5th Cross Road"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all"
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !complaintText.trim()}
              className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing with Qwen3 & Clustering with BGE-M3...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Submit & Triage Complaint</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Result or Architecture Info */}
        <div className="lg:col-span-5 space-y-6">
          {result ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-5 animate-in zoom-in-95 duration-200">
              {/* Success Badge */}
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-sm font-semibold">
                <svg className="w-5 h-5 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Complaint analyzed successfully!</span>
              </div>

              {/* Clustering Status Badge */}
              <div className="p-4 rounded-xl border bg-slate-50/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Clustering Result</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      result.matched_existing_issue
                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                        : "bg-blue-100 text-blue-800 border border-blue-200"
                    }`}
                  >
                    {result.matched_existing_issue ? "Joined Existing Issue" : "New Issue Created"}
                  </span>
                </div>

                <div className="text-sm text-slate-800">
                  {result.matched_existing_issue ? (
                    <p>
                      Merged into Master Issue <strong>#{result.issue_id}</strong> (
                      {Math.round(result.similarity_score * 100)}% semantic match via BGE-M3).
                    </p>
                  ) : (
                    <p>
                      Created new Master Issue <strong>#{result.issue_id}</strong> (no existing match &ge; 70%).
                    </p>
                  )}
                </div>

                {result.matched_existing_issue && (
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, Math.round(result.similarity_score * 100))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Extracted Metadata */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  AI Triage Extraction (Qwen3)
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Category</span>
                    <span className="font-semibold text-slate-800 text-sm">{result.analysis.category}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Priority</span>
                    <PriorityBadge priority={result.analysis.priority} size="sm" />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Department</span>
                    <span className="font-semibold text-slate-800 text-sm">{result.analysis.department}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Location</span>
                    <span className="font-semibold text-slate-800 text-sm">{result.analysis.location}</span>
                  </div>
                </div>

                {result.analysis.summary && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                    <span className="font-semibold text-blue-700 block">AI Summary</span>
                    <p className="leading-relaxed">{result.analysis.summary}</p>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {onIssueSelected && (
                <button
                  type="button"
                  onClick={() => onIssueSelected(result.issue_id)}
                  className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>View Master Issue #{result.issue_id} in Dashboard</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                How CivicPulse AI Processes Reports
              </h3>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">1</span>
                  <span><strong>Natural Language Understanding:</strong> Qwen3 analyzes the complaint, categorizes it, and recommends the responsible municipal department.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">2</span>
                  <span><strong>Semantic Embedding:</strong> BGE-M3 translates the complaint text into a 1024-dimensional semantic concept vector.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">3</span>
                  <span><strong>City Memory Matching:</strong> If the cosine similarity against an active issue is &ge; 70%, it attaches to that issue instead of creating duplicate tickets.</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
