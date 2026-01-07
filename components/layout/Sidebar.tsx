// components/layout/Sidebar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  ShoppingCart,
  Repeat,
  History,
  Shield,
  Wallet,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/contracts/utils";

// ✅ add these
import { useAccount, useChainId, useReadContract } from "wagmi";
import { tokenIcoAbi } from "@/lib/contracts/abi/tokenIcoAbi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
};

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ✅ ownership check
  const chainId = useChainId();
  const ico = getTokenIcoAddress(chainId);
  const { address } = useAccount();

  const ownerRead = useReadContract({
    address: ico,
    abi: tokenIcoAbi,
    functionName: "owner",
    query: { enabled: !!ico },
  });

  const owner = (ownerRead.data as `0x${string}` | undefined) ?? undefined;

  const isOwner = useMemo(() => {
    if (!address || !owner) return false;
    if (owner === ZERO_ADDR) return false;
    return address.toLowerCase() === owner.toLowerCase();
  }, [address, owner]);

  const navigation: NavItem[] = useMemo(
    () => [
      { name: "Dashboard", href: "/dashboard", icon: Home, description: "Overview & analytics" },
      { name: "Users", href: "/user-dashboard", icon: Users, description: "User management" },
      { name: "Token Sale", href: "/token-sale", icon: ShoppingCart, description: "Buy & sell tokens" },
      { name: "Transfer", href: "/token-transfers", icon: Repeat, description: "Transfer tokens" },
      { name: "Transactions", href: "/transaction", icon: History, description: "Transaction history" },
    ],
    []
  );

  const adminNavigation: NavItem[] = useMemo(
    () => [
      { name: "Admin Panel", href: "/admin/admin-overview", icon: Shield, description: "System administration" },
      { name: "Withdrawals", href: "/admin/withdraw-tokens", icon: Wallet, description: "Token withdrawal" },
    ],
    []
  );

  // Close drawer on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Lock body scroll when open (mobile drawer)
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200",
          "hover:bg-gradient-to-r hover:from-gray-800/50 hover:to-gray-900/50",
          active
            ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-l-4 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)]"
            : "text-gray-300 hover:text-white",
          isCollapsed && "justify-center px-2"
        )}
        aria-current={active ? "page" : undefined}
      >
        <div className="relative">
          <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110 text-blue-400")} />
          {active && <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
        </div>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium leading-tight">{item.name}</div>
              {item.badge && (
                <span
                  className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    active ? "bg-blue-500/30 text-blue-200" : "bg-gray-800 text-gray-400"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>
            {item.description && <div className="text-xs text-gray-500 truncate mt-0.5">{item.description}</div>}
          </div>
        )}

        {!isCollapsed && active && <ChevronRight className="h-4 w-4 text-blue-400 ml-2" />}
      </Link>
    );
  };

  return (
    <>
      {/* Overlay (mobile only) */}
      {open && (
        <div
          className="lg:hidden  fixed inset-0 z-40 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static cutive inset-y-0 left-0 z-50 lg:z-auto",
          "w-72 bg-gradient-to-b from-gray-950 via-gray-900 to-black text-gray-100",
          "border-r border-gray-800/50 shadow-2xl shadow-black/30",
          "transform transition-all duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          "flex flex-col",
          isCollapsed && "w-20"
        )}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className="h-16 px-4 border-b border-gray-800/50 flex items-center justify-between bg-gradient-to-r from-gray-900/50 to-black/50">
          <div className={cn("flex items-center gap-2 transition-all duration-300", isCollapsed && "justify-center w-full")}>
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                S
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <div className="font-bold text-lg bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Staera
                </div>
                <div className="text-[10px] text-gray-500 leading-tight">Token Platform</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Collapse toggle (desktop) */}
            <button
              onClick={() => setIsCollapsed((v) => !v)}
              className={cn(
                "hidden lg:flex items-center justify-center w-8 h-8 rounded-lg",
                "bg-gray-800/50 hover:bg-gray-700/50 transition-colors",
                "text-gray-400 hover:text-white",
                isCollapsed && "rotate-180"
              )}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Close (mobile) */}
            <button
              type="button"
              className="lg:hidden rounded-lg p-2 bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          <div className="space-y-2">
            {!isCollapsed && (
              <div className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                <span>Navigation</span>
                <span className="text-[10px] text-gray-600">{navigation.length}</span>
              </div>
            )}
            <div className="space-y-1">{navigation.map((item) => <NavLink key={item.name} item={item} />)}</div>
          </div>

          {/* ✅ Render admin links only for owner */}
          {isOwner && (
            <div className="space-y-2">
              {!isCollapsed && (
                <div className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Administration
                </div>
              )}
              <div className="space-y-1">{adminNavigation.map((item) => <NavLink key={item.name} item={item} />)}</div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
