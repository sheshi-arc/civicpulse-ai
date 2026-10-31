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
        className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16 md:pb-0"
      >
        <Suspense fallback={<div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" />}>
          <Navbar />
        </Suspense>
        <main
          className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        >
          {children}
        </main>
      </body>
    </html>
  );
}

