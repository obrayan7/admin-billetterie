import { formatPrice, prisma, providerLabel, ticketNumber } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Neutralise l'injection de formules (=, +, -, @) à l'ouverture dans Excel. */
function cell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const toCsv = (rows: unknown[][]) => "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
const iso = (d: Date | null) => (d ? d.toISOString() : "");

export async function GET(req: Request, { params }: { params: { type: string } }) {
  await requireAdmin();
  const eventId = new URL(req.url).searchParams.get("event") ?? undefined;
  let csv: string;

  if (params.type === "orders") {
    const orders = await prisma.order.findMany({
      where: { status: "PAID", ...(eventId ? { items: { some: { ticketType: { eventId } } } } : {}) },
      orderBy: { paidAt: "desc" },
      include: { items: { include: { ticketType: { include: { event: true } } } }, payments: { where: { status: "PAID" } } },
    });
    csv = toCsv([
      ["Commande", "Date de paiement", "E-mail", "Événements", "Billets", "Total TTC (€)", "Moyen de paiement"],
      ...orders.map((o) => [
        o.id.slice(-8).toUpperCase(), iso(o.paidAt), o.email,
        [...new Set(o.items.map((i) => i.ticketType.event.title))].join(" | "),
        o.items.map((i) => `${i.quantity} × ${i.ticketType.name}`).join(" | "),
        formatPrice(o.totalCents).replace(/\s/g, " "),
        o.payments.map((p) => providerLabel(p.provider)).join(", "),
      ]),
    ]);
  } else if (params.type === "participants") {
    const tickets = await prisma.ticket.findMany({
      where: { orderItem: { order: { status: "PAID" }, ...(eventId ? { ticketType: { eventId } } : {}) } },
      include: { orderItem: { include: { order: true, ticketType: { include: { event: true } } } } },
      orderBy: { orderItem: { order: { paidAt: "asc" } } },
    });
    csv = toCsv([
      ["Événement", "Date de l'événement", "Catégorie", "Titulaire", "N° billet", "Siège", "Code billet", "Statut", "Utilisé le", "E-mail acheteur", "Commande"],
      ...tickets.map((t) => [
        t.orderItem.ticketType.event.title, iso(t.orderItem.ticketType.event.startsAt), t.orderItem.ticketType.name,
        t.orderItem.order.holderName, ticketNumber(t.serial, t.orderItem.ticketType.event.startsAt), t.seat ?? "Placement libre",
        t.code, t.status === "USED" ? "Utilisé" : "Valide", iso(t.usedAt), t.orderItem.order.email, t.orderItem.order.id.slice(-8).toUpperCase(),
      ]),
    ]);
  } else {
    return new Response("Introuvable", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
