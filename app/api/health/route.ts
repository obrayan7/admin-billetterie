import { NextResponse } from "next/server";
import { prisma } from "@rideau/db";

export const dynamic = "force-dynamic";

/** Sonde de disponibilité (supervision, Docker) : vérifie l'accès à la base de données. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
