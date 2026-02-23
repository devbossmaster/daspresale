"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Menu, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/contracts/utils";

import { useAccount, useChainId, useReadContract } from "wagmi";
import { tokenIcoAbi } from "@/lib/contracts/abi/tokenIcoAbi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";

type NavItem = {
  name: string;
  href: string;
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  // Ownership check
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
      { name: "Dashboard", href: "/dashboard" },
      { name: "Users", href: "/user-dashboard" },
      { name: "Token Sale", href: "/token-sale" },
      { name: "Transfer", href: "/token-transfers" },
      { name: "Transactions", href: "/transaction" },
    ],
    []
  );

  const adminNavigation: NavItem[] = useMemo(
    () => [
      { name: "Admin Panel", href: "/admin/admin-overview" },
      { name: "Token Management", href: "/admin/withdraw-tokens" },
      { name: "Fund Management", href: "/admin/withdraw-usdt" },
    ],
    []
  );

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const NavPill = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
          active
            ? [
                "text-white",
                "border border-white/10",
                "bg-gradient-to-r from-violet-500/18 via-indigo-500/14 to-sky-400/14",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
              ]
            : [
                "text-gray-300 border border-transparent",
                "hover:text-white hover:border-white/8 hover:bg-white/[0.03]",
              ]
        )}
      >
        {active && (
          <>
            <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/40 to-transparent" />
            <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-300/20 to-transparent" />
          </>
        )}
        <span className="relative z-10">{item.name}</span>
      </Link>
    );
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* ambient top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-violet-500/8 via-indigo-500/4 to-transparent" />

      {/* main shell */}
      <div className="mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-3">
        <div
          className={cn(
            "relative h-16 rounded-2xl",
            "bg-[#05030B]/55 backdrop-blur-xl",
            "shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
          )}
        >
          {/* subtle neon lines */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-300/15 to-transparent" />

          {/* inner content */}
          <div className="relative flex h-full items-center px-3 sm:px-4">
            {/* Left: Mobile menu + Brand */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
              <button
                onClick={onMenuClick}
                className={cn(
                  "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl",
                  "bg-white/[0.03] text-gray-200",
                  "hover:bg-white/[0.06] hover:border-white/15 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                )}
                aria-label="Open sidebar"
                type="button"
              >
                <Menu className="h-5 w-5" />
              </button>

              <Link
                href="/"
                className="group flex items-center gap-2.5 shrink-0"
                aria-label="Go to homepage"
              >
                 <div className="leading-tight">
                  <div className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                    Staera
                  </div>
                  <div className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-white/40 -mt-0.5">
                    Ecosystem
                  </div>
                </div>

              
              </Link>
            </div>

            {/* Centered desktop nav */}
            <nav
              className={cn(
                "absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1",
                "max-w-[58vw] overflow-x-auto no-scrollbar rounded-2xl",
                " px-2 py-1.5"
              )}
              aria-label="Main navigation"
            >
              {navigation.map((item) => (
                <NavPill key={item.name} item={item} />
              ))}

              {isOwner && (
                <div className="relative group/focus ml-1">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap",
                      "text-gray-300 border border-transparent",
                      "hover:text-white hover:bg-white/[0.03] hover:border-white/8 transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                    )}
                    aria-haspopup="menu"
                    aria-expanded={undefined}
                  >
                    <span>Administration</span>
                    <ChevronDown className="h-4 w-4 text-gray-500 transition-transform duration-200 group-hover/focus:rotate-180" />
                  </button>

                  <div
                    className={cn(
                      "absolute left-0 top-full mt-2 w-72 rounded-2xl border border-white/10",
                      "bg-[#05030B]/90 backdrop-blur-xl shadow-2xl shadow-black/50",
                      "opacity-0 translate-y-1 pointer-events-none",
                      "group-hover/focus:opacity-100 group-hover/focus:translate-y-0 group-hover/focus:pointer-events-auto",
                      "transition-all duration-200"
                    )}
                    role="menu"
                  >
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/30 to-transparent" />
                    <div className="p-2">
                      <div className="px-2 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/40">
                        Admin Tools
                      </div>

                      {adminNavigation.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            role="menuitem"
                            className={cn(
                              "block rounded-xl px-3 py-2.5 text-sm transition-all",
                              "border border-transparent",
                              active
                                ? "text-white bg-white/[0.04] border-white/10"
                                : "text-gray-300 hover:text-white hover:bg-white/[0.03] hover:border-white/8"
                            )}
                          >
                            <span className="font-medium">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </nav>

            {/* Right: Wallet */}
            <div className="ml-auto shrink-0 flex items-center">
              <div
                className={cn(
                  "rounded-xl bg-white/[0.03] px-1.5 py-1",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                )}
              >
                <appkit-button />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}