import Link from "next/link";
import { formatDate, formatPrice, prisma, providerLabel, type Prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { PENDING: "En attente", PAID: "Payée", CANCELLED: "Annulée", EXPIRED: "Expirée" };

export default async function OrdersPage({ searchParams }: { searchParams: { event?: string; status?: string; q?: string } }) {
  await requireAdmin();
  const where: Prisma.OrderWhereInput = {};
  if (searchParams.status && STATUS[searchParams.status]) where.status = searchParams.status as Prisma.OrderWhereInput["status"];
  if (searchParams.event) where.items = { some: { ticketType: { eventId: searchParams.event } } };
  if (searchParams.q) where.email = { contains: searchParams.q.trim(), mode: "insensitive" };
  // Les paniers en cours (sans e-mail) ne sont pas des commandes : on les masque par défaut
  if (!searchParams.status) where.OR = [{ status: "PAID" }, { email: { not: null } }];

  const [orders, events] = await Promise.all([
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, take: 200,
      include: { items: { include: { ticketType: { include: { event: true } } } }, payments: { select: { provider: true, status: true } } },
    }),
    prisma.event.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, title: true } }),
  ]);
  const exportQs = searchParams.event ? `?event=${searchParams.event}` : "";

  return (
    <>
      <div className="row">
        <h1>Commandes</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn btn-ghost" href={`/api/export/orders${exportQs}`}>Exporter les commandes (CSV)</a>
          <a className="btn btn-ghost" href={`/api/export/participants${exportQs}`}>Exporter les participants (CSV)</a>
        </div>
      </div>

      <form className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <label>Événement
          <select name="event" defaultValue={searchParams.event ?? ""}>
            <option value="">Tous</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </label>
        <label>Statut
          <select name="status" defaultValue={searchParams.status ?? ""}>
            <option value="">Payées et en cours</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>E-mail <input name="q" defaultValue={searchParams.q} placeholder="contient…" /></label>
        <button type="submit">Filtrer</button>
      </form>

      <div className="card scroll">
        {orders.length === 0 ? <p>Aucune commande ne correspond.</p> : (
          <table>
            <thead><tr><th>Commande</th><th>Date</th><th>Client</th><th>Événements</th><th>Total</th><th>Paiement</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id.slice(-8).toUpperCase()}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{o.email ?? "—"}</td>
                  <td>{[...new Set(o.items.map((i) => i.ticketType.event.title))].join(", ")}</td>
                  <td>{formatPrice(o.totalCents)}</td>
                  <td>{[...new Set(o.payments.map((p) => providerLabel(p.provider)))].join(", ") || "—"}</td>
                  <td><span className={`badge ${o.status === "PAID" ? "PUBLISHED" : "ARCHIVED"}`}>{STATUS[o.status]}</span></td>
                  <td><Link className="btn btn-ghost btn-sm" href={`/commandes/${o.id}`}>Détail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {orders.length === 200 && <p className="hint">Seules les 200 commandes les plus récentes sont affichées : utilisez l&apos;export CSV pour tout récupérer.</p>}
    </>
  );
}
