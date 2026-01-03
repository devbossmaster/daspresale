"use client";

import { Menu } from "lucide-react";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05030B]/70 backdrop-blur">
      <div className="h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5 text-gray-200" />
          </button>

         </div>

        {/* Put your ConnectButton / wallet UI here if you already have it */}
        <div className="shrink-0"><appkit-button /></div>
      </div>
    </header>
  );
}
