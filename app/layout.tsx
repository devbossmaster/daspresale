// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";

import ContextProvider from "@/context";
import { headers } from "next/headers";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Web3 Presale Platform",
  description: "Modern token presale platform for Web3 projects",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookies = (await headers()).get("cookie") ?? "";

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#05030B] text-gray-100 min-h-screen`}>
        <ContextProvider cookies={cookies}>
          <AppShell>
            <div className="">{children}</div></AppShell>
        </ContextProvider>
      </body>
    </html>
  );
}
