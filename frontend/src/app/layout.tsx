import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivicPulse AI — Civic Problem Intelligence Platform",
  description: "AI-Powered Civic Complaint Triage, Routing, and City Memory Clustering with Qwen3 and BGE-M3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
      style={{ colorScheme: "light" }}
    >
      <body
        className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0"
        style={{ backgroundColor: "#f8fafc", color: "#0f172a" }}
      >
        <Suspense fallback={<div className="h-16 bg-white border-b border-slate-200" />}>
          <Navbar />
        </Suspense>
        <main
          className="flex-1 flex flex-col bg-slate-50 text-slate-900"
          style={{ backgroundColor: "#f8fafc" }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}

