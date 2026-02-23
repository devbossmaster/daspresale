import { clsx, type ClassValue } from "clsx"

export function safeJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(
      value,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
    ),
  );
}

