import { prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Affiche une preuve de virement. Réservé aux administrateurs ; jamais mis en cache. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const proof = await prisma.paymentProof.findUnique({ where: { id: params.id }, select: { data: true, mimeType: true, filename: true } });
  if (!proof) return new Response("Introuvable", { status: 404 });
  const isImage = proof.mimeType.startsWith("image/");
  return new Response(new Uint8Array(proof.data), {
    headers: {
      "Content-Type": proof.mimeType,
      // Images affichées dans la page ; PDF téléchargés (pas d'exécution dans le navigateur)
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="${encodeURIComponent(proof.filename)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
