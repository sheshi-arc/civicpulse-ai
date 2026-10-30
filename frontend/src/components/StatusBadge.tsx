import React from "react";

interface StatusBadgeProps {
  status: "active" | "resolved" | string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const s = status?.toLowerCase() || "";
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1";

  if (s === "resolved") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Resolved
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
      Active
    </span>
  );
}
