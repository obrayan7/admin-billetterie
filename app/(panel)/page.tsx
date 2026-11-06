import Link from "next/link";
import { formatDate, formatPrice, prisma } from "@rideau/db";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { DRAFT: "Brouillon", PUBLISHED: "Publié", ARCHIVED: "Archivé" };

export default async function EventsPage() {
  const since = new Date(Date.now() - 30 * 864e5);
  const [events, revenue, revenue30, paidOrders, ticketsSold, soldByType, toReview] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: { venue: true, category: true, ticketTypes: { select: { id: true, quantity: true } }, _count: { select: { images: true } } },
    }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
    prisma.order.aggregate({ where: { status: "PAID", paidAt: { gte: since } }, _sum: { totalCents: true } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.ticket.count(),
    prisma.orderItem.groupBy({ by: ["ticketTypeId"], where: { order: { status: "PAID" } }, _sum: { quantity: true } }),
    prisma.payment.count({ where: { provider: "BANK_TRANSFER", status: "PROOF_SUBMITTED" } }),
  ]);
  const sold = new Map(soldByType.map((r) => [r.ticketTypeId, r._sum.quantity ?? 0]));
  const fill = (e: (typeof events)[number]) => {
    const cap = e.ticketTypes.reduce((s, t) => s + t.quantity, 0);
    const s = e.ticketTypes.reduce((n, t) => n + (sold.get(t.id) ?? 0), 0);
    return { cap, sold: s, pct: cap ? Math.round((s / cap) * 100) : 0 };
  };

  return (
    <>
      <div className="stats">
        <div className="stat"><strong>{formatPrice(revenue._sum.totalCents ?? 0)}</strong><span>Chiffre d&apos;affaires total</span></div>
        <div className="stat"><strong>{formatPrice(revenue30._sum.totalCents ?? 0)}</strong><span>30 derniers jours</span></div>
        <div className="stat"><strong>{paidOrders}</strong><span>Commandes payées</span></div>
        <div className="stat"><strong>{ticketsSold}</strong><span>Billets émis</span></div>
        <Link href="/virements" className="stat" style={{ textDecoration: "none", color: "inherit", borderColor: toReview > 0 ? "var(--accent)" : undefined }}><strong>{toReview}</strong><span>Virements à vérifier</span></Link>
      </div>

      <div className="row">
        <h1>Événements</h1>
        <Link href="/evenements/nouveau" className="btn">Nouvel événement</Link>
      </div>
      <div className="card scroll">
        {events.length === 0 ? (
          <p>Aucun événement. Créez le premier avec « Nouvel événement ».</p>
        ) : (
          <table>
            <thead>
              <tr><th>Événement</th><th>Date</th><th>Lieu</th><th>Remplissage</th><th>Statut</th><th /></tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const f = fill(e);
                return (
                  <tr key={e.id}>
                    <td><strong>{e.title}</strong><br /><span className="hint">{e.category.name} · {e._count.images} image{e._count.images > 1 ? "s" : ""}</span></td>
                    <td>{formatDate(e.startsAt, true)}</td>
                    <td>{e.venue.name}<br /><span className="hint">{e.venue.city}</span></td>
                    <td>
                      <div className="bar" role="img" aria-label={`${f.pct} % vendu`}><i style={{ width: `${f.pct}%` }} /></div>
                      <span className="hint">{f.sold} / {f.cap} billets</span>
                    </td>
                    <td><span className={`badge ${e.status}`}>{STATUS[e.status]}</span></td>
                    <td><Link href={`/evenements/${e.id}`} className="btn btn-ghost btn-sm">Modifier</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
