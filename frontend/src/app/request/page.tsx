"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { submitComplaint, uploadPhoto, SubmitComplaintResponse } from "@/lib/api";

const CivicMap = dynamic(() => import("@/components/CivicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-xs">
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

const CATEGORIES = [
  "Roads & Potholes",
  "Sanitation & Waste Management",
  "Water Supply & Sewerage",
  "Electricity & Streetlights",
  "Traffic & Road Safety",
  "Parks & Urban Environment",
  "General Civic Infrastructure"
];

export default function CustomerRequestPage() {
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [complaintText, setComplaintText] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [locationName, setLocationName] = useState("University Main Gate, Ward 14");
  const [latitude, setLatitude] = useState<number>(17.4435);
  const [longitude, setLongitude] = useState<number>(78.3772);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitComplaintResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect geolocation
  const handleGetLocation = () => {
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
        alert("Unable to retrieve your location. Please type the location or select on map.");
      },
      { timeout: 8000 }
    );
  };

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const res = await uploadPhoto(file);
      setPhotoUrl(res.url);
    } catch {
      alert("Failed to upload photo. Please verify backend is running.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !mobileNumber.trim() || !emailAddress.trim() || !complaintText.trim() || !locationName.trim()) {
      setErrorMessage("Please fill out all required fields marked with *.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await submitComplaint({
        complaint: complaintText.trim(),
        reporter_name: fullName.trim(),
        reporter_phone: mobileNumber.trim(),
        citizen_email: emailAddress.trim(),
        category,
        location: locationName.trim(),
        latitude,
        longitude,
        photo_url: photoUrl,
      });

      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyShareableTracking = (id: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/track?id=${id}` : `/track?id=${id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-950 min-h-screen py-8 sm:py-12 transition-colors">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">

        {/* Breadcrumb & Header */}
        <div>
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 mb-2">
            ← Back to Home
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Citizen Service Portal</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Submit a Municipal Request
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Report infrastructure defects, utility breakdowns, or public safety issues. Our AI City Memory immediately clusters similar reports to dispatch municipal teams without duplicate delays.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SUCCESS STATE */}
        {result ? (
          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Request Confirmed</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Ticket Generated: {result.tracking_id}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your municipal complaint has been logged and assigned an incident record.
                </p>
              </div>
            </div>

            {/* City Memory Intelligence Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>City Memory 2.0 Triage Status</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  result.matched_existing_issue
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }`}>
                  {result.matched_existing_issue ? "Merged into Active Master Work Order" : "Created New Master Issue"}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                {result.match_reason || (result.matched_existing_issue
                  ? `Correlated with Master Issue #${result.issue_id} (${Math.round((result.similarity_score || 0.8) * 100)}% semantic match within local radius).`
                  : `First recorded incident for this location. Master Issue #${result.issue_id} opened for field dispatch.`)}
              </p>
            </div>

            {/* Tracking Link & Share Box */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 space-y-3">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 block">
                Shareable Tracking URL:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/track?id=${result.tracking_id}` : `/track?id=${result.tracking_id}`}
                  className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyShareableTracking(result.tracking_id)}
                  className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 transition-colors"
                >
                  {copiedLink ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href={`/track?id=${result.tracking_id}`}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-center text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Track Live Progress</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setComplaintText("");
                }}
                className="px-5 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        ) : (
          /* FORM STATE */
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            {/* Citizen Contact Section */}
            <div className="space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">1</span>
                Citizen Contact Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rahul@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Incident Details Section */}
            <div className="space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">2</span>
                Incident Description &amp; Category
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Photo Evidence (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{uploadingPhoto ? "Uploading..." : photoUrl ? "Photo Attached ✓" : "Upload Image"}</span>
                    </button>
                    {photoUrl && (
                      <span className="text-[11px] text-emerald-600 font-medium">Ready</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Describe the Issue in Detail <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  placeholder="e.g. Deep pothole across the left lane causing hazards for two-wheelers and night traffic. Please inspect."
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Location & Map Section */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">3</span>
                Location &amp; Coordinates
              </h2>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Street address or landmark"
                  className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locatingUser}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span>{locatingUser ? "Locating..." : "Use My GPS"}</span>
                </button>
              </div>

              {/* Interactive Location Picker Map */}
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <CivicMap
                  issues={[]}
                  height="260px"
                  center={[latitude, longitude]}
                  zoom={15}
                  isPicker={true}
                  pickerCoords={{ lat: latitude, lng: longitude }}
                  onLocationPick={({ lat, lng }) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    setLocationName(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Click anywhere on the map to position the incident pin.</span>
                <span className="font-mono">Lat: {latitude.toFixed(4)}, Lon: {longitude.toFixed(4)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Processing with Qwen3 Triage &amp; City Memory...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>SUBMIT MUNICIPAL WORK ORDER</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
