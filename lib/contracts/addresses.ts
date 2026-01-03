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
const TOKENICO_LOCALHOST = asAddress(process.env.NEXT_PUBLIC_TOKENICO_LOCALHOST);
const SALETOKEN_LOCALHOST = asAddress(process.env.NEXT_PUBLIC_SALETOKEN_LOCALHOST);
const USDT_LOCALHOST = asAddress(process.env.NEXT_PUBLIC_USDT_LOCALHOST);

const TOKENICO_BSC = asAddress(process.env.NEXT_PUBLIC_TOKENICO_BSC);
const SALETOKEN_BSC = asAddress(process.env.NEXT_PUBLIC_SALETOKEN_BSC);
const USDT_BSC = asAddress(process.env.NEXT_PUBLIC_USDT_BSC);

const TOKENICO_BSC_TESTNET = asAddress(process.env.NEXT_PUBLIC_TOKENICO_BSC_TESTNET);
const SALETOKEN_BSC_TESTNET = asAddress(process.env.NEXT_PUBLIC_SALETOKEN_BSC_TESTNET);
const USDT_BSC_TESTNET = asAddress(process.env.NEXT_PUBLIC_USDT_BSC_TESTNET);

export function getTokenIcoAddress(chainId?: number) {
  if (!chainId) return undefined;
  if (chainId === hardhat.id) return TOKENICO_LOCALHOST;
  if (chainId === bsc.id) return TOKENICO_BSC;
  if (chainId === bscTestnet.id) return TOKENICO_BSC_TESTNET;
  return undefined;
}

export function getSaleTokenAddress(chainId?: number) {
  if (!chainId) return undefined;
  if (chainId === hardhat.id) return SALETOKEN_LOCALHOST;
  if (chainId === bsc.id) return SALETOKEN_BSC;
  if (chainId === bscTestnet.id) return SALETOKEN_BSC_TESTNET;
  return undefined;
}

export function getUsdtAddress(chainId?: number) {
  if (!chainId) return undefined;
  if (chainId === hardhat.id) return USDT_LOCALHOST;
  if (chainId === bsc.id) return USDT_BSC;
  if (chainId === bscTestnet.id) return USDT_BSC_TESTNET;
  return undefined;
}
