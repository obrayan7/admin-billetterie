"use server";

import { scanTicket } from "@rideau/db";
import { requireStaff } from "@/lib/auth";

export type ScanOutcome = { result: "valid" | "used" | "invalid"; event?: string; category?: string; usedAt?: string; seat?: string; holder?: string };

export async function scan(code: string): Promise<ScanOutcome> {
  await requireStaff();
  const r = await scanTicket(String(code).slice(0, 100));
  return {
    result: r.result,
    event: "event" in r ? r.event : undefined,
    category: "category" in r ? r.category : undefined,
    seat: "seat" in r && r.seat ? r.seat : undefined,
    holder: "holder" in r && r.holder ? r.holder : undefined,
    usedAt: "usedAt" in r && r.usedAt ? r.usedAt.toISOString() : undefined,
  };
}
