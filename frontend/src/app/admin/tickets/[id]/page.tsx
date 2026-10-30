"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AdminHeader from "@/components/AdminHeader";
import PriorityBadge from "@/components/PriorityBadge";
import StatusBadge from "@/components/StatusBadge";
import {
  getAdminTicketDetail,
  assignAdminTicket,
  updateAdminTicketStatus,
  addAdminTicketNote,
  getAdminMe,
  AdminTicketFullResponse
} from "@/lib/api";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-56 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-xs">
      Loading incident map...
    </div>
  ),
});

function AdminTicketDetailContent() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params?.id as string;

  const [data, setData] = useState<AdminTicketFullResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Note form state
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("IN_PROGRESS");
  const [statusReason, setStatusReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assigning, setAssigning] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await getAdminTicketDetail(ticketId);
      setData(res);
      setNewStatus(res.ticket.desk_status || "IN_PROGRESS");
      setAssignEmail(res.ticket.assigned_officer_email || "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load ticket";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    let ignore = false;
    getAdminMe()
      .then(() => {
        if (!ignore) {
          fetchDetail();
        }
      })
      .catch(() => {
        if (!ignore) {
          router.push("/admin/login");
        }
      });

    return () => {
      ignore = true;
    };
  }, [router, fetchDetail]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !ticketId) return;

    setAddingNote(true);
    try {
      await addAdminTicketNote(ticketId, newNote.trim(), "internal");
      setNewNote("");
      fetchDetail();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId) return;

    setUpdatingStatus(true);
    try {
      await updateAdminTicketStatus(ticketId, newStatus, statusReason.trim());
      setShowStatusModal(false);
      fetchDetail();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !assignEmail.trim()) return;

    setAssigning(true);
    try {
      await assignAdminTicket(ticketId, assignEmail.trim(), assignNote.trim());
      setShowAssignModal(false);
      fetchDetail();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to assign ticket");
    } finally {
      setAssigning(false);
    }
  };

  const ticket = data?.ticket;
  const deskStatus = ticket?.desk_status?.toUpperCase() || "NEW";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/tickets"
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
          >
            ← Back to Work Orders
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAssignModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Assign Officer
            </button>
            <button
              type="button"
              onClick={() => setShowStatusModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
            >
              Update Lifecycle Status
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-rose-800 text-rose-300 text-xs text-center space-y-2">
            <p className="font-bold text-sm">Access Denied or Ticket Not Found</p>
            <p>{errorMsg}</p>
            <Link href="/admin/tickets" className="inline-block mt-2 px-3 py-1 bg-slate-800 rounded-lg text-white">
              Return to Tickets List
            </Link>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <svg className="w-5 h-5 animate-spin text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Loading ticket details...
          </div>
        ) : ticket && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left 8 Cols: Main Incident Details & Complaints */}
            <div className="lg:col-span-8 space-y-6">

              {/* Title & Core Meta */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-400">
                      Master Ticket #{ticket.id}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      deskStatus === "RESOLVED"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : deskStatus === "COMPLETED"
                        ? "bg-blue-950 text-blue-300 border border-blue-800"
                        : deskStatus === "ON_HOLD"
                        ? "bg-amber-950 text-amber-300 border border-amber-800"
                        : deskStatus === "IN_PROGRESS"
                        ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}>
                      {deskStatus}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status || "active"} />
                  </div>
                </div>

                <h1 className="text-xl font-black text-white">
                  {ticket.title}
                </h1>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Department</span>
                    <span className="font-bold text-white">{ticket.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Category</span>
                    <span className="font-bold text-white">{ticket.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Reports Merged</span>
                    <span className="font-bold text-blue-400">{ticket.complaint_count} reports</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Assigned Officer</span>
                    <span className="font-bold text-white truncate block">
                      {ticket.assigned_officer_email || "Unassigned"}
                    </span>
                  </div>
                </div>

                {ticket.description && (
                  <p className="text-xs text-slate-300 bg-slate-800/60 p-3 rounded-xl border border-slate-700 leading-relaxed">
                    {ticket.description}
                  </p>
                )}
              </div>

              {/* AI Triage Intelligence Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Qwen3 AI Triage &amp; Risk Assessment
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                    <span className="text-slate-400 font-bold block mb-1">Urgency Rationale</span>
                    <p className="text-slate-200">{ticket.urgency_reason || "Standard municipal response window."}</p>
                  </div>
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                    <span className="text-slate-400 font-bold block mb-1">Suggested Municipal Action</span>
                    <p className="text-slate-200">{ticket.suggested_action || "Dispatch field inspection crew."}</p>
                  </div>
                </div>
              </div>

              {/* Clustered Citizen Complaints */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    City Memory Clustered Reports ({data?.complaints?.length || 0})
                  </h2>
                  <span className="text-[10px] text-slate-400">Semantic &amp; Geographic deduplication</span>
                </div>

                <div className="space-y-3">
                  {data?.complaints?.map((comp) => (
                    <div key={comp.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono font-bold text-blue-400">{comp.tracking_id}</span>
                        <span>{new Date(comp.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-200 italic">&ldquo;{comp.text}&rdquo;</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>Reporter: {comp.reporter_name || "Citizen"}</span>
                        <span>{comp.location}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right 4 Cols: Location Map, Timeline, Notes */}
            <div className="lg:col-span-4 space-y-6">

              {/* Location Map */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Incident Location
                </span>
                <p className="text-xs text-white font-medium truncate">{ticket.location}</p>
                <div className="rounded-xl overflow-hidden border border-slate-700">
                  <CivicMap
                    issues={[ticket]}
                    height="200px"
                    center={ticket.latitude && ticket.longitude ? [ticket.latitude, ticket.longitude] : [17.4435, 78.3772]}
                    zoom={15}
                  />
                </div>
              </div>

              {/* Status History */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Status Transition Log
                </span>
                <div className="space-y-2.5 max-h-56 overflow-y-auto">
                  {data?.status_history?.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No previous transitions logged</p>
                  ) : (
                    data?.status_history?.map((hist) => (
                      <div key={hist.id} className="text-xs border-l-2 border-blue-500 pl-2.5 py-0.5 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{hist.new_status}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(hist.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{hist.reason || `By ${hist.changed_by}`}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Operations Notes ({data?.notes?.length || 0})
                </span>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {data?.notes?.map((n) => (
                    <div key={n.id} className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300">{n.author_name || n.author_email}</span>
                        <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-200">{n.content}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t border-slate-800">
                  <textarea
                    rows={2}
                    required
                    placeholder="Add an internal operations note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={addingNote || !newNote.trim()}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
                  >
                    {addingNote ? "Adding Note..." : "Add Note"}
                  </button>
                </form>
              </div>

            </div>

          </div>
        )}

        {/* MODAL: Update Status */}
        {showStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">
                  Update Status — Ticket #{ticketId}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleStatusSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Select New Lifecycle State
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="NEW">NEW</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS (Work Started)</option>
                    <option value="ON_HOLD">ON_HOLD (Awaiting Parts / Permit)</option>
                    <option value="COMPLETED">COMPLETED (Field Work Complete)</option>
                    <option value="RESOLVED">RESOLVED (Verified &amp; Closed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Reason / Resolution Details
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Parts delivered, excavation in progress."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingStatus}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {updatingStatus ? "Updating..." : "Update Lifecycle"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Assign Ticket */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">
                  Assign Officer / Crew
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Officer Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. officer@city.gov"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Dispatch Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Inspect site immediately with utility sensors."
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigning}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {assigning ? "Assigning..." : "Confirm Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function AdminTicketDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs text-slate-400">
          Loading ticket details...
        </div>
      }
    >
      <AdminTicketDetailContent />
    </React.Suspense>
  );
}
