"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Menu, ChevronDown } from "lucide-react";
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
      { name: "Token Managment", href: "/admin/withdraw-tokens" },
      { name: "Fund Managment", href: "/admin/withdraw-usdt" },
    ],
    []
  );

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  const NavPill = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        className={cn(
          "rounded-xl px-3 py-2 text-sm font-medium transition-all whitespace-nowrap",
          "hover:bg-white/5 hover:text-white",
          active
            ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-white ring-1 ring-blue-500/20"
            : "text-gray-300"
        )}
        aria-current={active ? "page" : undefined}
      >
        {item.name}
      </Link>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#05030B]/30 backdrop-blur-lg">
      {/* Make container relative so we can absolute-center the nav */}
      <div className="relative h-16 px-4 sm:px-6 lg:px-8 flex items-center">
        {/* Left: Mobile menu + Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5 text-gray-200" />
          </button>

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white">
              Staera
            </div>
          </Link>
        </div>

        {/* ✅ Centered Nav (between logo and wallet) */}
        <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 max-w-[60vw] overflow-x-auto">
          {navigation.map((item) => (
            <NavPill key={item.name} item={item} />
          ))}

          {/* Admin dropdown (text-only, no icons) */}
          {isOwner && (
            <div className="relative group ml-1">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all whitespace-nowrap",
                  "text-gray-300 hover:bg-white/5 hover:text-white"
                )}
                aria-haspopup="menu"
              >
                <span>Administration</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              <div
                className={cn(
                  "absolute left-0 top-full mt-2 w-64 rounded-2xl border border-white/10",
                  "bg-[#05030B]/90 backdrop-blur-lg shadow-2xl shadow-black/40",
                  "opacity-0 translate-y-1 pointer-events-none",
                  "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
                  "transition-all duration-200"
                )}
                role="menu"
              >
                <div className="p-2">
                  {adminNavigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "block rounded-xl px-3 py-2 text-sm transition-all",
                        "hover:bg-white/5",
                        isActive(item.href) ? "text-white bg-white/5" : "text-gray-300"
                      )}
                      role="menuitem"
                    >
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Right: Wallet connect */}
        <div className="ml-auto shrink-0">
          <appkit-button />
        </div>
      </div>
    </header>
  );
}
