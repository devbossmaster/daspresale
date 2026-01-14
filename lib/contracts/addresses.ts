// lib/contracts/addresses.ts
import { bsc, bscTestnet, hardhat } from "wagmi/chains";
import { isAddress } from "viem";

function asAddress(v?: string): `0x${string}` | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (!t) return undefined;

  // strict:false allows lowercase/non-checksummed strings safely
  if (!isAddress(t, { strict: false })) return undefined;

  return t.toLowerCase() as `0x${string}`;
}

// IMPORTANT: static env access (Next can inline these)

const TOKENICO_BSC = asAddress(process.env.NEXT_PUBLIC_TOKENICO_BSC);
const SALETOKEN_BSC = asAddress(process.env.NEXT_PUBLIC_SALETOKEN_BSC);
const USDT_BSC = asAddress(process.env.NEXT_PUBLIC_USDT_BSC);

export function getTokenIcoAddress(chainId?: number) {
  if (!chainId) return undefined;
  if (chainId === bsc.id) return TOKENICO_BSC;
  return undefined;
}

export function getSaleTokenAddress(chainId?: number) {
  if (!chainId) return undefined;
  if (chainId === bsc.id) return SALETOKEN_BSC;
  return undefined;
}

export function getUsdtAddress(chainId?: number) {
  if (!chainId) return undefined;
  if (chainId === bsc.id) return USDT_BSC;
  return undefined;
}
