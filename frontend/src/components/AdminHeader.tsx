"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getHealth, getAdminNotifications, markAdminNotificationRead, logoutAdmin, AdminUser } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  issue_id?: number;
  is_read: number;
  created_at: string;
}

let cachedUserRaw: string | null = null;
let cachedUserObj: AdminUser | null = null;

function subscribeUser(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getUserSnapshot(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("civicpulse_user");
    if (raw !== cachedUserRaw) {
      cachedUserRaw = raw;
      cachedUserObj = raw ? (JSON.parse(raw) as AdminUser) : null;
    }
    return cachedUserObj;
  } catch {
    return null;
  }
}

function getServerUserSnapshot(): AdminUser | null {
  return null;
}

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [online, setOnline] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const currentUser: AdminUser | null = useSyncExternalStore(
    subscribeUser,
    getUserSnapshot,
    getServerUserSnapshot
  );

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));

    // Load notifications
    getAdminNotifications()
      .then((res) => {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logoutAdmin();
    router.push("/admin/login");
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await markAdminNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.issue_id) {
      setShowNotifications(false);
      router.push(`/admin/tickets/${notif.issue_id}`);
    }
  };

  const isSuperOrAdmin =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

  const adminNav = [
    { label: "Dashboard", href: "/admin" },
    { label: "Tickets", href: "/admin/tickets" },
    { label: "Live Map", href: "/admin/map" },
    { label: "Departments", href: "/admin/departments" },
    { label: "Analytics", href: "/admin/analytics" },
    ...(isSuperOrAdmin ? [{ label: "Users", href: "/admin/users" }] : []),
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Operations Badge & User Info */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              HQ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-white tracking-tight">
                  CIVICPULSE COMMAND CENTER
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                  currentUser?.role === "SUPER_ADMIN"
                    ? "bg-purple-950 text-purple-300 border-purple-800"
                    : currentUser?.role === "ADMIN"
                    ? "bg-blue-950 text-blue-300 border-blue-800"
                    : "bg-emerald-950 text-emerald-300 border-emerald-800"
                }`}>
                  {currentUser?.role || "OPERATIONS"}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium block leading-none mt-0.5">
                {currentUser?.name || "Municipal Officer"} • {currentUser?.department_slug?.replace("_", " ") || "All Departments"}
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Admin Tab Navigation */}
        <nav className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 overflow-x-auto max-w-full">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                  isActive
                    ? "bg-blue-600 text-white font-bold shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Notifications + Theme Toggle + User Badge + Logout */}
        <div className="flex items-center gap-2.5">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 relative transition-colors cursor-pointer"
              aria-label="View notifications"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popup */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-300">
                  <span>Incident Notifications</span>
                  <span className="text-[10px] text-slate-400 font-normal">{unreadCount} unread</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No recent notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          n.is_read
                            ? "bg-slate-800/40 border-slate-800 text-slate-400"
                            : "bg-blue-950/40 border-blue-800 text-blue-200"
                        } hover:bg-slate-800`}
                      >
                        <p className="font-bold text-slate-200">{n.title}</p>
                        <p className="text-[11px] mt-0.5 line-clamp-2">{n.message}</p>
                        <span className="text-[9px] text-slate-500 block mt-1">
                          {new Date(n.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <ThemeToggle />

          {/* AI Status */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                online === true ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-[10px] font-medium">
              {online === true ? "AI Online" : "AI Offline"}
            </span>
          </div>

          {/* Logout Action */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Sign out of command center"
          >
            Logout
          </button>

          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 transition-colors"
          >
            Public Portal →
          </Link>
        </div>

      </div>
    </div>
  );
}
