import React from "react";

interface PriorityBadgeProps {
  priority: string;
  size?: "sm" | "md";
}

export default function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const p = priority?.toLowerCase() || "";
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1 font-medium";

  if (p === "critical") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
        Critical
      </span>
    );
  }

  if (p === "high") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-semibold ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        High
      </span>
    );
  }

  if (p === "medium") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Medium
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Low
    </span>
  );
}
