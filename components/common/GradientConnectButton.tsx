// components/common/GradientConnectButton.tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function GradientConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) return null;

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className="w-full rounded-xl bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF] px-6 py-3 text-sm font-semibold text-black flex items-center justify-center"
            >
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="w-full rounded-xl bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-200 border border-white/10"
            >
              Wrong Network
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            className="w-full rounded-xl bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF] px-6 py-3 text-sm font-semibold text-black flex items-center justify-center"
          >
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
