"use client";

import { Menu } from "lucide-react";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#05030B]/30 backdrop-blur-lg">
      <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5 text-gray-200" />
          </button>
        </div>

        {/* Wallet connect button */}
        <div className="shrink-0">
          <appkit-button />
        </div>
      </div>
    </header>
  );
}