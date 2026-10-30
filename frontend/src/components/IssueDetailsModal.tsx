"use client";

import React, { useState, useEffect } from "react";
import { getIssue, resolveIssue, MasterIssue, Complaint } from "@/lib/api";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";

interface IssueDetailsModalProps {
  issueId: number | null;
  onClose: () => void;
  onIssueResolved: (updatedIssue: MasterIssue) => void;
}

export default function IssueDetailsModal({
  issueId,
  onClose,
  onIssueResolved,
}: IssueDetailsModalProps) {
  const [issue, setIssue] = useState<MasterIssue | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolving, setResolving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [prevIssueId, setPrevIssueId] = useState(issueId);
  if (issueId !== prevIssueId) {
    setPrevIssueId(issueId);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!issueId) return;
    let isMounted = true;

    getIssue(issueId)
      .then((res) => {
        if (isMounted) {
          setIssue(res.issue);
          setComplaints(res.complaints);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load issue details");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [issueId]);

  if (!issueId) return null;

  const handleResolve = async () => {
    if (!issue) return;
    setResolving(true);
    setError(null);
    try {
      const updated = await resolveIssue(issue.id);
      setIssue(updated);
      setSuccessMsg("Issue marked as resolved!");
      onIssueResolved(updated);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resolve issue";
      setError(msg);
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                ISSUE #{issueId}
              </span>
              {issue && <StatusBadge status={issue.status} size="sm" />}
              {issue && <PriorityBadge priority={issue.priority} size="sm" />}
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">
              {issue?.title || `Issue #${issueId}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading issue details and citizen reports...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          ) : issue ? (
            <>
              {/* Notification Banner */}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2 animate-in fade-in">
                  <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {successMsg}
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Department</span>
                  <span className="font-semibold text-slate-800">{issue.department}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Category</span>
                  <span className="font-semibold text-slate-800">{issue.category}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Location</span>
                  <span className="font-semibold text-slate-800">{issue.location || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Total Complaints</span>
                  <span className="font-bold text-blue-600 text-base">{issue.complaint_count}</span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1">
                <span>Reported on: <strong className="text-slate-700">{formatDate(issue.created_at)}</strong></span>
                <span>Last updated: <strong className="text-slate-700">{formatDate(issue.updated_at)}</strong></span>
              </div>

              {/* Underlying Citizen Complaints Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                    Underlying Citizen Complaints ({complaints.length})
                  </h3>
                  <span className="text-xs text-slate-400">Aggregated via BGE-M3 (Similarity &ge; 0.70)</span>
                </div>

                {complaints.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-4 text-center">
                    No individual complaints registered for this issue.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {complaints.map((c, index) => (
                      <div
                        key={c.id || index}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 font-mono">
                            Complaint #{c.id}
                          </span>
                          <span className="text-slate-400">{formatDate(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-900 font-medium leading-relaxed">
                          &ldquo;{c.text}&rdquo;
                        </p>
                        {c.summary && (
                          <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600 flex items-start gap-1.5">
                            <span className="font-semibold text-blue-700 shrink-0">AI Summary:</span>
                            <span>{c.summary}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Close
          </button>

          {issue && issue.status !== "resolved" && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="px-5 py-2 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
            >
              {resolving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Mark as Resolved
                </>
              )}
            </button>
          )}

          {issue && issue.status === "resolved" && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Issue is Resolved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
