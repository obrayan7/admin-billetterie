import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatPrice, prisma, providerLabel } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrderDetail({ params }: { params: { id: string } }) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { email: true } },
      payments: { orderBy: { createdAt: "desc" } },
      items: { include: { ticketType: { include: { event: true } }, tickets: true } },
    },
  });
  if (!order) notFound();

  return (
    <>
      <div className="row">
        <h1>Commande {order.id.slice(-8).toUpperCase()}</h1>
        <Link href="/commandes" className="btn btn-ghost">Retour</Link>
      </div>
      <div className="card">
        <p><strong>Statut :</strong> {order.status} — <strong>Total :</strong> {formatPrice(order.totalCents)}</p>
        <p><strong>E-mail :</strong> {order.email ?? "—"} {order.user ? `(compte ${order.user.email})` : "(achat invité)"}</p>
        <p><strong>Créée :</strong> {formatDate(order.createdAt, true)}{order.paidAt && <> — <strong>payée :</strong> {formatDate(order.paidAt, true)}</>}</p>
      </div>

      <div className="card scroll">
        <h2>Articles et billets</h2>
        <table>
          <thead><tr><th>Événement</th><th>Billet</th><th>Qté</th><th>Prix unitaire</th><th>Codes (statut)</th></tr></thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>{i.ticketType.event.title}</td>
                <td>{i.ticketType.name}</td>
                <td>{i.quantity}</td>
                <td>{formatPrice(i.unitCents)}</td>
                <td>{i.tickets.length === 0 ? "—" : i.tickets.map((t) => <div key={t.id}><code>{t.code.slice(0, 8)}…</code> {t.status === "USED" ? "utilisé" : "valide"}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card scroll">
        <h2>Paiements</h2>
        {order.payments.length === 0 ? <p>Aucune tentative de paiement.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Moyen</th><th>Montant</th><th>Statut</th><th>Référence prestataire</th></tr></thead>
            <tbody>
              {order.payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.createdAt, true)}</td>
                  <td>{p.provider === "STRIPE" ? "Carte (Stripe)" : providerLabel(p.provider)}</td>
                  <td>{formatPrice(p.amountCents)}</td>
                  <td>{p.status}</td>
                  <td><code>{p.externalId}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
