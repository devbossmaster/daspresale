import { bsc, hardhat } from "wagmi/chains";

function asAddress(v?: string): `0x${string}` | undefined {
  if (!v) return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
}

// IMPORTANT: static env access (Next can inline these)
const TOKENICO_LOCALHOST = asAddress(process.env.NEXT_PUBLIC_TOKENICO_LOCALHOST);
const SALETOKEN_LOCALHOST = asAddress(process.env.NEXT_PUBLIC_SALETOKEN_LOCALHOST);
const USDT_LOCALHOST = asAddress(process.env.NEXT_PUBLIC_USDT_LOCALHOST);

const TOKENICO_BSC = asAddress(process.env.NEXT_PUBLIC_TOKENICO_BSC);
const SALETOKEN_BSC = asAddress(process.env.NEXT_PUBLIC_SALETOKEN_BSC);
const USDT_BSC = asAddress(process.env.NEXT_PUBLIC_USDT_BSC);

export function getTokenIcoAddress(chainId: number) {
  if (chainId === hardhat.id) return TOKENICO_LOCALHOST;
  if (chainId === bsc.id) return TOKENICO_BSC;
  return undefined;
}

export function getSaleTokenAddress(chainId: number) {
  if (chainId === hardhat.id) return SALETOKEN_LOCALHOST;
  if (chainId === bsc.id) return SALETOKEN_BSC;
  return undefined;
}

export function getUsdtAddress(chainId: number) {
  if (chainId === hardhat.id) return USDT_LOCALHOST;
  if (chainId === bsc.id) return USDT_BSC;
  return undefined;
}
