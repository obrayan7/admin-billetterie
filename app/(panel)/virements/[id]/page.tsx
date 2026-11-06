import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAccountNumber, formatDate, formatPrice, prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";
import { confirmBankPayment, rejectBankPayment } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // la confirmation émet les billets, génère les PDF et envoie l'e-mail

const DONE: Record<string, string> = {
  confirmed: "Virement confirmé : les billets ont été générés et envoyés au client par e-mail.",
  already: "Ce virement est confirmé. La commande était déjà payée (par un autre moyen) : aucun nouveau billet n'a été émis.",
  rejected: "Preuve refusée : le client a reçu le motif par e-mail et peut renvoyer un justificatif.",
};

export default async function BankPaymentPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; done?: string } }) {
  await requireAdmin();
  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    select: {
      id: true, provider: true, status: true, externalId: true, amountCents: true, createdAt: true, reviewedAt: true, reviewedBy: true, rejectionReason: true,
      proofs: { select: { id: true, filename: true, mimeType: true, size: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      order: {
        select: {
          id: true, status: true, email: true, holderName: true, totalCents: true, expiresAt: true, paidAt: true,
          items: { select: { id: true, quantity: true, unitCents: true, ticketType: { select: { name: true, event: { select: { title: true, startsAt: true } } } }, _count: { select: { tickets: true } } } },
        },
      },
    },
  });
  if (!payment || payment.provider !== "BANK_TRANSFER") notFound();
  const accounts = await prisma.bankAccount.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const { order } = payment;
  const open = ["PENDING", "PROOF_SUBMITTED", "REJECTED", "EXPIRED"].includes(payment.status);
  const ticketsIssued = order.items.reduce((n, i) => n + i._count.tickets, 0);

  return (
    <>
      <div className="row">
        <h1>Virement — commande {order.id.slice(-8).toUpperCase()}</h1>
        <Link href="/virements" className="btn btn-ghost">Retour</Link>
      </div>
      {searchParams.error && <p className="alert" role="alert">{searchParams.error}</p>}
      {searchParams.done && DONE[searchParams.done] && <p className="notice" role="status">{DONE[searchParams.done]}</p>}

      <div className="card">
        <div className="kvA">
          <span>Montant à recevoir</span><strong style={{ fontSize: "1.4rem" }}>{formatPrice(order.totalCents)}</strong>
          <span>Référence attendue dans le libellé</span><strong>{order.id.slice(-8).toUpperCase()}</strong>
          <span>Client</span><span>{order.holderName ?? "—"} — {order.email}</span>
          <span>Statut du paiement</span><span>{payment.status}{payment.reviewedBy ? ` — traité par ${payment.reviewedBy} le ${formatDate(payment.reviewedAt!, true)}` : ""}</span>
          <span>Statut de la commande</span><span>{order.status}{order.status === "PENDING" ? ` — places réservées jusqu'au ${formatDate(order.expiresAt, true)}` : ""}</span>
        </div>
        {payment.rejectionReason && <p className="hint">Motif du dernier refus : {payment.rejectionReason}</p>}
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>Événement</th><th>Billet</th><th>Qté</th><th>Prix</th></tr></thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}><td>{i.ticketType.event.title}<br /><span className="hint">{formatDate(i.ticketType.event.startsAt, true)}</span></td><td>{i.ticketType.name}</td><td>{i.quantity}</td><td>{formatPrice(i.unitCents)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card" aria-labelledby="proofs">
        <h2 id="proofs">Preuves envoyées par le client ({payment.proofs.length})</h2>
        {payment.proofs.length === 0 ? <p>Le client n'a pas encore envoyé de preuve. Si vous avez reçu le virement, vous pouvez quand même le confirmer ci-dessous.</p> : (
          <div className="proofs">
            {payment.proofs.map((p) => (
              <figure key={p.id}>
                {p.mimeType.startsWith("image/") ? (
                  <a href={`/api/proofs/${p.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/proofs/${p.id}`} alt={`Preuve de virement : ${p.filename}`} />
                  </a>
                ) : (
                  <a className="btn btn-ghost" href={`/api/proofs/${p.id}`}>Télécharger le PDF</a>
                )}
                <figcaption className="hint">{p.filename} — reçu le {formatDate(p.createdAt, true)} ({Math.round(p.size / 1024)} Ko)</figcaption>
              </figure>
            ))}
          </div>
        )}
        <p className="hint">Comparez avec votre relevé bancaire : montant, date et référence du virement.</p>
      </section>

      {open && (
        <div className="grid2" style={{ alignItems: "start" }}>
          <section className="card" aria-labelledby="confirm">
            <h2 id="confirm">Confirmer le paiement</h2>
            <p className="hint">Les billets sont générés et envoyés au client immédiatement.</p>
            <form action={confirmBankPayment.bind(null, payment.id)} className="stack">
              <label style={{ display: "flex", gap: 10, fontWeight: 400 }}>
                <input type="checkbox" name="verified" style={{ minHeight: 0, marginTop: 4 }} />
                <span>Je certifie avoir reçu <strong>{formatPrice(order.totalCents)}</strong> sur le compte avec la référence <strong>{order.id.slice(-8).toUpperCase()}</strong>.</span>
              </label>
              <div><button type="submit">Confirmer et envoyer les billets</button></div>
            </form>
          </section>
          <section className="card" aria-labelledby="reject">
            <h2 id="reject">Refuser la preuve</h2>
            <form action={rejectBankPayment.bind(null, payment.id)} className="stack">
              <label>Motif (envoyé au client)
                <textarea name="reason" minLength={5} maxLength={500} placeholder="Ex. : le montant reçu ne correspond pas, la capture est illisible…" style={{ minHeight: 90 }} />
              </label>
              <div><button type="submit" className="btn-danger">Refuser</button></div>
            </form>
          </section>
        </div>
      )}
      {payment.status === "PAID" && <p className="notice">Paiement confirmé — {ticketsIssued} billet{ticketsIssued > 1 ? "s" : ""} émis. <Link href={`/commandes/${order.id}`}>Voir la commande</Link></p>}

      <section className="card" aria-labelledby="accounts" style={{ marginTop: 24 }}>
        <h2 id="accounts">Comptes bancaires communiqués aux clients</h2>
        {accounts.length === 0 ? <p>Aucun compte actif. <Link href="/comptes-bancaires">En ajouter un</Link></p> : accounts.map((a) => (
          <p key={a.id} style={{ margin: "6px 0" }}><strong>{a.label}</strong> — {a.bankName}, {a.accountHolder} — {formatAccountNumber(a.accountNumber)}{a.bic ? ` — ${a.bic}` : ""}</p>
        ))}
      </section>
    </>
  );
}
