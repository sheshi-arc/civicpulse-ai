"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { submitComplaint, uploadPhoto, SubmitComplaintResponse } from "@/lib/api";
import PriorityBadge from "@/components/PriorityBadge";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Loading location map picker...
      </div>
    </div>
  ),
});

const QUICK_PROBLEM_PRESETS = [
  "Deep pothole on the main road causing bike skids",
  "Overflowing garbage bins blocking the footpath",
  "Streetlights completely non-functional for 3 days",
  "Major water pipeline leakage flooding the street",
  "Traffic signal malfunctioning during peak hours",
];

const QUICK_LOCATION_PRESETS = [
  { name: "University Main Gate", lat: 17.4435, lng: 78.3772 },
  { name: "Market Square Center", lat: 17.4485, lng: 78.3822 },
  { name: "5th Cross Road, Ward 12", lat: 17.4390, lng: 78.3720 },
  { name: "Sector 4 Community Park", lat: 17.4520, lng: 78.3690 },
];

export default function ReportProblemPage() {
  const [complaintText, setComplaintText] = useState("");
  const [locationName, setLocationName] = useState("University Main Gate");
  const [latitude, setLatitude] = useState<number>(17.4435);
  const [longitude, setLongitude] = useState<number>(78.3772);
  const [category, setCategory] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const speechSupported = useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition),
    () => false
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitComplaintResponse | null>(null);

  // Initialize Speech Recognition if supported
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setComplaintText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert("Voice speech recognition is not supported in this browser. Please type your problem description.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Speech recognition error:", err);
      }
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationName(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setLocatingUser(false);
      },
      () => {
        setLocatingUser(false);
        alert("Could not retrieve precise location. Please click on the map to pin.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSelectOnMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleMapLocationSelect = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationName(`Pinned Spot (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
  };

  const handleLocationPreset = (preset: { name: string; lat: number; lng: number }) => {
    setLocationName(preset.name);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const res = await uploadPhoto(file);
      setPhotoUrl(res.url);
    } catch {
      alert("Photo upload failed. You can still submit your complaint without a photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim()) {
      setErrorMsg("Please describe the problem you observed.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setProcessingStep(1);

    // Staged progression animation
    const stepTimer1 = setTimeout(() => setProcessingStep(2), 500);
    const stepTimer2 = setTimeout(() => setProcessingStep(3), 1100);
    const stepTimer3 = setTimeout(() => setProcessingStep(4), 1700);

    try {
      const res = await submitComplaint({
        complaint: complaintText.trim(),
        location: locationName.trim() || "Unspecified Location",
        latitude: latitude,
        longitude: longitude,
        category: category.trim() || undefined,
        reporter_name: reporterName.trim() || undefined,
        reporter_contact: reporterContact.trim() || undefined,
        photo_url: photoUrl || undefined,
      });

      setResult(res);
    } catch (err) {
      console.error("Submission failed:", err);
      setErrorMsg("Failed to connect to CivicPulse AI backend. Please verify the service is running.");
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setIsSubmitting(false);
      setProcessingStep(0);
    }
  };

  // SUCCESS / CONFIRMATION VIEW (AI Result Card Centerpiece)
  if (result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 bg-slate-50 min-h-screen">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          
          {/* Top Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block mb-1">
                Official Report Registered
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Civic Complaint Triaged &amp; Processed
              </h1>
            </div>

            {/* Tracking ID Badge */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:text-right shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Citizen Tracking ID
              </span>
              <span className="text-xl font-mono font-black text-blue-700 tracking-wider">
                {result.tracking_id}
              </span>
            </div>
          </div>

          {/* VISUAL CENTERPIECE: AI ANALYSIS & CITY MEMORY CARD */}
          <div className="bg-white border-2 border-blue-600/40 rounded-2xl p-6 shadow-xs space-y-6">
            
            {/* Header: AI Triage Banner */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                  AI
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                    AI Analysis &amp; City Memory Resolution
                  </h2>
                  <span className="text-xs text-slate-500">
                    Qwen3:4b Language Model + BGE-M3 Geodesic Clustering
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                result.matched_existing_issue
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-blue-50 text-blue-800 border-blue-300"
              }`}>
                {result.matched_existing_issue ? "MATCHED EXISTING ISSUE" : "NEW MASTER ISSUE CREATED"}
              </span>
            </div>

            {/* Section 1: AI Analysis Grid */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                1. AI Analysis
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Category</span>
                  <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                    {result.analysis.category || "General"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Priority</span>
                  <div className="mt-1">
                    <PriorityBadge priority={result.analysis.priority} size="sm" />
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Department</span>
                  <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                    {result.analysis.department || "Public Works"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Location</span>
                  <span className="font-bold text-slate-900 mt-0.5 block text-sm truncate">
                    {result.analysis.location || locationName}
                  </span>
                </div>
              </div>

              {result.analysis.summary && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                  <span className="font-bold text-slate-900">AI Summary: </span>
                  {result.analysis.summary}
                </div>
              )}
            </div>

            {/* Section 2: City Memory Grid */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                2. City Memory Intelligence
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-200 text-xs">
                <div>
                  <span className="text-blue-900/70 font-semibold block text-[11px]">Semantic Match</span>
                  <span className="font-mono font-black text-slate-900 mt-0.5 block text-sm">
                    {(result.similarity_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-blue-900/70 font-semibold block text-[11px]">Distance</span>
                  <span className="font-mono font-black text-slate-900 mt-0.5 block text-sm">
                    {result.distance_km != null ? `${result.distance_km} km` : "No GPS"}
                  </span>
                </div>
                <div>
                  <span className="text-blue-900/70 font-semibold block text-[11px]">Decision</span>
                  <span className={`font-bold mt-0.5 block text-xs ${
                    result.matched_existing_issue ? "text-emerald-700" : "text-blue-700"
                  }`}>
                    {result.matched_existing_issue ? "Consolidated" : "Isolated Work Order"}
                  </span>
                </div>
                <div>
                  <span className="text-blue-900/70 font-semibold block text-[11px]">Work Order</span>
                  <Link
                    href={`/issues/${result.issue_id}`}
                    className="font-mono font-bold text-blue-700 underline mt-0.5 block text-xs"
                  >
                    Issue #{result.issue_id} →
                  </Link>
                </div>
              </div>

              {/* Explicit Reason Callout */}
              <div className="mt-3 p-3 bg-white rounded-xl border border-blue-200 text-xs text-blue-950">
                <span className="font-bold text-blue-900">Clustering Reason: </span>
                {result.match_reason || result.city_memory?.match_reason || (
                  result.matched_existing_issue
                    ? "Similar reports were found nearby. Merged into active work order to avoid duplicate dispatch."
                    : "No matching active issues found within geographic vicinity. Created new municipal work order."
                )}
              </div>
            </div>

          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link
                href={`/track?id=${result.tracking_id}`}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs text-center transition-colors shadow-xs"
              >
                Track Live Progress →
              </Link>
              <Link
                href={`/issues/${result.issue_id}`}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-colors"
              >
                View Master Issue #{result.issue_id}
              </Link>
              <Link
                href="/map"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs text-center transition-colors"
              >
                See on Map
              </Link>
            </div>

            <button
              onClick={() => {
                setResult(null);
                setComplaintText("");
                setLocationName("University Main Gate");
                setPhotoUrl(null);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer py-2"
            >
              + Report Another Problem
            </button>
          </div>

        </div>
      </div>
    );
  }

  // MAIN REPORT FORM
  return (
    <div className="w-full bg-slate-50 min-h-screen py-8 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 mb-2">
            ← Back to Home
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Citizen Reporting Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            What&apos;s wrong?
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Tell us what happened in plain language. CivicPulse AI will classify the hazard, check City Memory, and alert the appropriate department.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-900 font-bold ml-2 cursor-pointer">
              ×
            </button>
          </div>
        )}

        {/* AI Processing Overlay State */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-6">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <svg className="w-6 h-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Processing Civic Report</h3>
                <p className="text-xs text-slate-500 mt-1">Connecting to local Qwen3 &amp; BGE-M3 models...</p>
              </div>

              <div className="space-y-3 text-left">
                <div className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
                  processingStep >= 1 ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    processingStep >= 1 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}>1</span>
                  <span>UNDERSTANDING YOUR REPORT</span>
                </div>

                <div className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
                  processingStep >= 2 ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    processingStep >= 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}>2</span>
                  <span>IDENTIFYING PROBLEM &amp; SEVERITY</span>
                </div>

                <div className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
                  processingStep >= 3 ? "bg-indigo-50 border-indigo-200 text-indigo-900" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    processingStep >= 3 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}>3</span>
                  <span>CHECKING CITY MEMORY 2.0</span>
                </div>

                <div className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
                  processingStep >= 4 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    processingStep >= 4 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}>4</span>
                  <span>ROUTING TO DEPARTMENT</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Problem Description Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            
            {/* Action Bar (Top Controls) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Problem Description
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* 📍 Use My Location */}
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locatingUser}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Use current GPS"
                >
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span>{locatingUser ? "Locating..." : "📍 Use My Location"}</span>
                </button>

                {/* 📍 Select on Map */}
                <button
                  type="button"
                  onClick={handleSelectOnMap}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Scroll to interactive map"
                >
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Select on Map</span>
                </button>

                {/* 📷 Add Photo */}
                <label className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  <span>{uploadingPhoto ? "Uploading..." : "📷 Add Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>

                {/* 🎤 Speak Complaint */}
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    isListening
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                  title={speechSupported ? "Dictate via voice" : "Voice not supported in this browser"}
                >
                  <span>{isListening ? "Listening..." : "🎤 Speak Complaint"}</span>
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-slate-400 self-center mr-1">Quick Suggestions:</span>
              {QUICK_PROBLEM_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setComplaintText(preset)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition-colors border border-slate-200 cursor-pointer text-left"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Large Complaint Input */}
            <textarea
              id="complaint"
              rows={5}
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="Tell us what happened..."
              required
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-900 text-base placeholder:text-slate-400 outline-none transition-all resize-y bg-slate-50/40 focus:bg-white"
            />

            {/* Attached Photo Preview */}
            {photoUrl && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-emerald-800 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Evidence" className="w-12 h-12 rounded-lg object-cover border border-emerald-300 shrink-0" />
                <div className="flex-1">
                  <span className="font-bold block">Photo Evidence Attached</span>
                  <span className="text-[10px] text-emerald-600">Saved to municipal dispatch file</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-1 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Location Section */}
          <div ref={mapSectionRef} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Incident Location &amp; Coordinates
              </label>
              <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
            </div>

            {/* Quick Location Presets */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-slate-400 self-center mr-1">Common Spots:</span>
              {QUICK_LOCATION_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleLocationPreset(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors border cursor-pointer ${
                    locationName === preset.name
                      ? "bg-blue-600 text-white border-blue-600 font-bold"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. University Main Gate or 5th Cross Road"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-slate-900 bg-slate-50/50 focus:bg-white font-medium"
            />

            {/* Mini Map Preview */}
            <div className="rounded-xl overflow-hidden border border-slate-200 relative">
              <CivicMap
                height="260px"
                isPicker={true}
                pickerLat={latitude}
                pickerLng={longitude}
                center={[latitude, longitude]}
                onLocationSelect={handleMapLocationSelect}
              />
              <div className="absolute top-2 left-2 z-20 bg-white/95 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-700 shadow-xs border border-slate-200">
                📍 Click map to set pin
              </div>
            </div>
          </div>

          {/* Optional Details (Contact & Category) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Contact &amp; Notification (Optional)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Category Override</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="">🤖 Auto-Detect by AI</option>
                  <option value="Roads">🛣️ Roads &amp; Footpaths</option>
                  <option value="Sanitation">🗑️ Sanitation &amp; Waste</option>
                  <option value="Water Supply">💧 Water &amp; Drainage</option>
                  <option value="Electricity">⚡ Electricity &amp; Lighting</option>
                  <option value="Traffic">🚦 Traffic &amp; Signals</option>
                  <option value="Parks">🌳 Parks &amp; Trees</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Your Name</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="e.g. Citizen Reporter"
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-600 text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Email / Phone</label>
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="e.g. citizen@city.org"
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-600 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Submit CTA */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting || !complaintText.trim()}
              className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm tracking-wide shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Submit Report to CivicPulse AI</span>
              <span>→</span>
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              City Memory 2.0 deduplication automatically protects against redundant municipal tickets.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
