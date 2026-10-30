"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deactivateAdminUser,
  getAdminMe,
  AdminUser
} from "@/lib/api";

const ROLES = ["SUPER_ADMIN", "ADMIN", "DEPARTMENT_MANAGER", "DEPARTMENT_STAFF"];
const DEPARTMENTS = [
  { slug: "public_works", name: "Public Works" },
  { slug: "sanitation", name: "Sanitation & Waste" },
  { slug: "water_supply", name: "Water Supply & Sewerage" },
  { slug: "electricity", name: "Electricity & Streetlights" },
  { slug: "traffic_safety", name: "Traffic & Road Safety" },
  { slug: "parks_environment", name: "Parks & Urban Environment" },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("CivicPulse@Admin2026!");
  const [newRole, setNewRole] = useState("DEPARTMENT_MANAGER");
  const [newDept, setNewDept] = useState("public_works");
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminUsers();
      setUsers(res.users || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Access restricted";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    getAdminMe()
      .then((userRes) => {
        if (!ignore) {
          if (userRes.user.role !== "SUPER_ADMIN" && userRes.user.role !== "ADMIN") {
            router.push("/admin");
            return;
          }
          setCurrentUser(userRes.user);
          fetchUsers();
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
  }, [router, fetchUsers]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createAdminUser({
        email: newEmail.trim(),
        name: newName.trim(),
        password: newPassword,
        role: newRole,
        department_slug: newDept,
      });
      setShowCreateModal(false);
      setNewEmail("");
      setNewName("");
      fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    if (user.id === currentUser?.id) {
      alert("You cannot deactivate your own account.");
      return;
    }
    const willDeactivate = Boolean(user.is_active);
    if (!confirm(`${willDeactivate ? "Deactivate" : "Activate"} user ${user.email}?`)) return;

    try {
      if (willDeactivate) {
        await deactivateAdminUser(user.id);
      } else {
        await updateAdminUser(user.id, { is_active: 1 });
      }
      fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              User &amp; Permission Administration
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Role-Based Access Control: Super Admins, Operations Admins, and Department Managers.
            </p>
          </div>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Add Administrative Officer</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Loading user accounts...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Officer Name &amp; Email</th>
                    <th className="px-4 py-3 font-bold">Assigned Role</th>
                    <th className="px-4 py-3 font-bold">Department Scope</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Last Login</th>
                    {isSuperAdmin && <th className="px-4 py-3 font-bold text-right">Management</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 space-y-0.5">
                        <span className="font-bold text-white block">{u.name || "Officer"}</span>
                        <span className="text-[11px] font-mono text-slate-400 block">{u.email}</span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === "SUPER_ADMIN"
                            ? "bg-purple-950 text-purple-300 border border-purple-800"
                            : u.role === "ADMIN"
                            ? "bg-blue-950 text-blue-300 border border-blue-800"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-300 font-medium whitespace-nowrap">
                        {u.department_slug?.replace("_", " ") || "All Departments"}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.is_active
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : "bg-rose-950 text-rose-300 border border-rose-800"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-rose-400"}`} />
                          {u.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-[11px]">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : "Never logged in"}
                      </td>

                      {isSuperAdmin && (
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            disabled={u.id === currentUser?.id}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer disabled:opacity-30 ${
                              u.is_active
                                ? "bg-rose-950/60 hover:bg-rose-900 border-rose-800 text-rose-300"
                                : "bg-emerald-950/60 hover:bg-emerald-900 border-emerald-800 text-emerald-300"
                            }`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL: Add New User */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">
                  Add Administrative Officer
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Officer Vikram Singh"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikram@cityops.gov"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Department Scope
                    </label>
                    <select
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d.slug} value={d.slug}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Officer Account"}
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
