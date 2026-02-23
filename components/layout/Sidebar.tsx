"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Home, Users, ShoppingCart, Repeat, History, Shield, Wallet, X } from "lucide-react";
import { cn } from "@/lib/contracts/utils";

import { useAccount, useChainId, useReadContract } from "wagmi";
import { tokenIcoAbi } from "@/lib/contracts/abi/tokenIcoAbi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  // ✅ owner check (same as before)
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
      { name: "Token Managment", href: "/admin/withdraw-tokens", icon: Wallet, description: "Token withdrawal" },
      { name: "Fund Managment", href: "/admin/withdraw-usdt", icon: Wallet, description: "Fund withdrawal" },
    ],
    []
  );

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
            ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-l-4 border-blue-500 text-white"
            : "text-gray-300 hover:text-white"
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className={cn("h-5 w-5", active ? "text-blue-300" : "text-gray-400")} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight">{item.name}</div>
          {item.description && <div className="text-xs text-gray-500 truncate mt-0.5">{item.description}</div>}
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Overlay (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ✅ Mobile-only drawer (no lg/md desktop behavior at all) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:hidden",
          "w-72 bg-gradient-to-b from-gray-950 via-gray-900 to-black text-gray-100",
          "border-r border-gray-800/50 shadow-2xl shadow-black/30",
          "transform transition-all duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "flex flex-col"
        )}
        aria-label="Mobile navigation"
      >
        {/* ✅ Minimal header (no duplicate S/brand) */}
        <div className="h-16 px-4 border-b border-gray-800/50 flex items-center justify-between bg-gradient-to-r from-gray-900/50 to-black/50">
          <div className="text-sm font-semibold text-gray-200 text-xl">Staera</div>
          <button
            type="button"
            className="rounded-lg p-2 bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-gray-300"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>

          {isOwner && (
            <div className="space-y-2">
              <div className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Administration
              </div>
              <div className="space-y-1">
                {adminNavigation.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
