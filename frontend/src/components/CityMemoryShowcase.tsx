"use client";

import React, { useState } from "react";

export default function CityMemoryShowcase() {
  const [activeTab, setActiveTab] = useState<"nearby" | "distant">("nearby");

  return (
    <section className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-800 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            City Memory 2.0 • Hybrid Intelligence
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Connecting the Dots: Semantic Similarity + Haversine Geo-Proximity
          </h2>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Legacy civic software creates duplicate tickets or mistakenly groups far-away issues.
            <strong> City Memory 2.0</strong> clusters reports by pairing 1024-dimensional BGE-M3 language embeddings with geodesic distance calculation.
          </p>
        </div>

        {/* Interactive Mode Switcher */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("nearby")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "nearby"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-400"
                : "bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            Scenario A: Similar Language + Nearby Location (Merged)
          </button>
          <button
            onClick={() => setActiveTab("distant")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "distant"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400"
                : "bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            Scenario B: Similar Language + Distant Location (Separated)
          </button>
        </div>

        {/* Scenario Content */}
        {activeTab === "nearby" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Two nearby complaints */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Incoming Citizen Reports (Distance: 0.08 km)
              </span>
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Complaint #1 • 8:15 AM</span>
                  <span className="text-emerald-400 font-mono text-[11px]">17.4435, 78.3850</span>
                </div>
                <p className="text-xs md:text-sm text-slate-200">
                  &ldquo;Massive pothole near the university main gate causing traffic crawl.&rdquo;
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-emerald-500/60 shadow-md space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Complaint #2 • 9:02 AM</span>
                  <span className="text-emerald-400 font-mono text-[11px]">17.4441, 78.3855</span>
                </div>
                <p className="text-xs md:text-sm text-slate-200">
                  &ldquo;Deep crater in the tarmac outside the college entrance, dangerous for two-wheelers.&rdquo;
                </p>
              </div>
            </div>

            {/* Center: The Dual Gate Engine */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center py-2 space-y-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-emerald-500/20">
                MERGE
              </div>
              <span className="text-[11px] font-mono text-emerald-300 font-bold">88.4% Semantic</span>
              <span className="text-[11px] font-mono text-emerald-300 font-bold">0.08 km &le; 1.0 km</span>
              <span className="text-[10px] text-slate-400">Haversine Verified</span>
            </div>

            {/* Right: Consolidated Master Issue */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-emerald-500/70 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                  MASTER ISSUE #104
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  ESCALATED TO HIGH
                </span>
              </div>
              <h3 className="text-base font-bold text-white">Main Gate Severe Road Depression &amp; Pothole</h3>
              <p className="text-xs text-slate-400">University Main Gate • Public Works Dept</p>
              <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/40 text-xs text-emerald-200">
                <strong>City Memory Action: </strong> Consolidated duplicate complaints into 1 actionable work order. Priority automatically escalated.
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Two distant complaints with same language */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Reports with Identical Words Across Town (Distance: 11.2 km)
              </span>
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Complaint A • Hitech City</span>
                  <span className="text-blue-400 font-mono text-[11px]">17.4435, 78.3850</span>
                </div>
                <p className="text-xs md:text-sm text-slate-200">
                  &ldquo;Streetlights completely off along the boulevard for three days, pitch black road.&rdquo;
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-indigo-500/60 shadow-md space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Complaint B • Charminar Area</span>
                  <span className="text-indigo-400 font-mono text-[11px]">17.3616, 78.4747</span>
                </div>
                <p className="text-xs md:text-sm text-slate-200">
                  &ldquo;Streetlights completely off along the boulevard for three days, pitch black road.&rdquo;
                </p>
              </div>
            </div>

            {/* Center: The Dual Gate Engine Guard */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center py-2 space-y-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-500/20">
                ISOLATE
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">96.2% Semantic</span>
              <span className="text-[11px] font-mono text-rose-400 font-bold">11.2 km &gt; 3.0 km</span>
              <span className="text-[10px] text-slate-400">Spatial Barrier Engaged</span>
            </div>

            {/* Right: Distinct Master Issues */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-indigo-500/70 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-bold">
                  2 SEPARATE DISPATCHES
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                  ZERO CROSS-CONTAMINATION
                </span>
              </div>
              <h3 className="text-base font-bold text-white">Independent Work Orders Maintained</h3>
              <p className="text-xs text-slate-400">Ward 14 (Cyberabad) vs Ward 22 (Old City)</p>
              <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-800/40 text-xs text-indigo-200">
                <strong>City Memory Action: </strong> Prevented false merge despite 96% vocabulary similarity. Each ward receives its own independent repair crew.
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
