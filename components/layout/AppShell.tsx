"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#05030B] overflow-hidden">
      <div className="pointer-events-none fixed inset-0 opacity-60 bg-gradient-to-br from-[#0f172a] via-[#020617] to-[#020617] animate-gradient" />
      <div className="pointer-events-none fixed inset-x-0 top-8 h-64 bg-gradient-to-b from-purple-500/20 via-transparent to-transparent" />

      <Header onMenuClick={() => setSidebarOpen(true)} />

      {/* ✅ Mobile overlay only */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="relative flex min-h-screen pt-16">
        {/* ✅ Sidebar exists ONLY on mobile */}
        <div className="md:hidden">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="min-w-0 flex-1 flex flex-col overflow-y-auto">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="w-full max-w-6xl mx-auto min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
