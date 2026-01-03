export function trimDecimals(value: string, max: number) {
  if (!value.includes(".")) return value;
  const [i, f] = value.split(".");
  return `${i}.${f.slice(0, max)}`.replace(/\.?0+$/, "");
}

export function fmtNum(s?: string, maxFrac = 4) {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}
