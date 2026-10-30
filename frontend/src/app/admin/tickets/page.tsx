"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import PriorityBadge from "@/components/PriorityBadge";
import {
  getAdminTickets,
  getAdminMe,
  assignAdminTicket,
  updateAdminTicketStatus,
  AdminTicketDetail,
  AdminUser
} from "@/lib/api";

const STATUS_TABS = ["ALL", "NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "RESOLVED"];

export default function AdminTicketsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [tickets, setTickets] = useState<AdminTicketDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Action Modals State
  const [selectedTicket, setSelectedTicket] = useState<AdminTicketDetail | null>(null);
  const [modalType, setModalType] = useState<"assign" | "status" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for modal
  const [assignEmail, setAssignEmail] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [newStatus, setNewStatus] = useState("IN_PROGRESS");
  const [statusReason, setStatusReason] = useState("");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminTickets({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        search: searchQuery.trim() || undefined,
        limit: 100
      });
      setTickets(res.tickets || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    let ignore = false;
    getAdminMe()
      .then((userRes) => {
        if (!ignore) {
          setCurrentUser(userRes.user);
          fetchTickets();
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
  }, [router, fetchTickets]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets();
  };

  const openAssignModal = (ticket: AdminTicketDetail) => {
    setSelectedTicket(ticket);
    setAssignEmail(ticket.assigned_officer_email || "");
    setAssignNote("");
    setModalType("assign");
  };

  const openStatusModal = (ticket: AdminTicketDetail) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.desk_status || "IN_PROGRESS");
    setStatusReason("");
    setModalType("status");
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !assignEmail.trim()) return;

    setActionLoading(true);
    try {
      await assignAdminTicket(selectedTicket.id, assignEmail.trim(), assignNote.trim());
      setModalType(null);
      fetchTickets();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to assign ticket");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setActionLoading(true);
    try {
      await updateAdminTicketStatus(selectedTicket.id, newStatus, statusReason.trim());
      setModalType(null);
      fetchTickets();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update ticket status");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header & Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Work Order Management
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Role: <strong className="text-white">{currentUser?.role}</strong> • Triage, assign, and update civic incident lifecycle.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {tickets.length} incidents found
            </span>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 pb-3 border-b border-slate-800">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Search & Priority Select */}
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <input
                type="text"
                placeholder="Search by ticket title, location, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Filter</span>
              </button>
            </div>
          </form>
        </div>

        {/* Tickets Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <svg className="w-5 h-5 animate-spin text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Loading authorized work orders...
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No tickets found matching the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">ID</th>
                    <th className="px-4 py-3 font-bold">Work Order Details</th>
                    <th className="px-4 py-3 font-bold">Priority</th>
                    <th className="px-4 py-3 font-bold">Department</th>
                    <th className="px-4 py-3 font-bold">Desk Status</th>
                    <th className="px-4 py-3 font-bold">Assigned To</th>
                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {tickets.map((t) => {
                    const st = t.desk_status?.toUpperCase() || "NEW";
                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-slate-400 font-bold">
                          #{t.id}
                        </td>
                        <td className="px-4 py-3.5 space-y-0.5">
                          <Link
                            href={`/admin/tickets/${t.id}`}
                            className="font-bold text-white hover:text-blue-400 line-clamp-1"
                          >
                            {t.title}
                          </Link>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {t.location} • {t.complaint_count} report(s)
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <PriorityBadge priority={t.priority} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-300 font-medium">
                          {t.department}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st === "RESOLVED"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : st === "COMPLETED"
                              ? "bg-blue-950 text-blue-300 border border-blue-800"
                              : st === "ON_HOLD"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : st === "IN_PROGRESS"
                              ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                              : st === "ASSIGNED"
                              ? "bg-sky-950 text-sky-300 border border-sky-800"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-[11px]">
                          {t.assigned_officer_email || <span className="italic text-slate-500">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => openAssignModal(t)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Assign
                          </button>
                          <button
                            type="button"
                            onClick={() => openStatusModal(t)}
                            className="px-2 py-1 rounded bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Status
                          </button>
                          <Link
                            href={`/admin/tickets/${t.id}`}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-colors inline-block"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL: Assign Ticket */}
        {modalType === "assign" && selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">
                  Assign Ticket #{selectedTicket.id}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2">
                {selectedTicket.title} ({selectedTicket.department})
              </p>

              <form onSubmit={handleAssignSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Officer / Crew Email
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
                    Assignment Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Inspect site by 2:00 PM and report road condition."
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Assigning..." : "Confirm Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Update Status */}
        {modalType === "status" && selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">
                  Update Status — Ticket #{selectedTicket.id}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleStatusSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Select New Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="NEW">NEW</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Reason / Resolution Note
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Work started by crew on site, or parts delivery awaited."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Updating..." : "Update Status"}
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
