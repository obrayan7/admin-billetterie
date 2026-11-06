import Link from "next/link";
import { formatDate, formatPrice, prisma, type Prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABS: Record<string, { label: string; statuses: Prisma.PaymentWhereInput["status"] }> = {
  review: { label: "À vérifier", statuses: "PROOF_SUBMITTED" },
  waiting: { label: "En attente de preuve", statuses: { in: ["PENDING", "EXPIRED"] } },
  paid: { label: "Confirmés", statuses: "PAID" },
  rejected: { label: "Refusés", statuses: "REJECTED" },
};
const STATUS_LABEL: Record<string, string> = { PENDING: "En attente de preuve", PROOF_SUBMITTED: "À vérifier", PAID: "Confirmé", REJECTED: "Refusé", EXPIRED: "Expiré" };

export default async function BankPaymentsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requireAdmin();
  const tab = TABS[searchParams.tab ?? ""] ? (searchParams.tab as string) : "review";

  const [payments, counts] = await Promise.all([
    prisma.payment.findMany({
      where: { provider: "BANK_TRANSFER", status: TABS[tab].statuses },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, status: true, createdAt: true, reviewedBy: true,
        _count: { select: { proofs: true } },
        order: { select: { id: true, email: true, holderName: true, totalCents: true } },
      },
    }),
    prisma.payment.groupBy({ by: ["status"], where: { provider: "BANK_TRANSFER" }, _count: true }),
  ]);
  const count = (key: string) => {
    const s = TABS[key].statuses;
    return counts.filter((c) => (typeof s === "string" ? c.status === s : (s as { in: string[] }).in.includes(c.status))).reduce((n, c) => n + c._count, 0);
  };

  return (
    <>
      <div className="row">
        <h1>Virements bancaires</h1>
        <Link href="/comptes-bancaires" className="btn btn-ghost">Gérer les comptes bancaires</Link>
      </div>
      <nav className="tabs" aria-label="Filtrer par statut">
        {Object.entries(TABS).map(([key, t]) => (
          <Link key={key} href={`/virements?tab=${key}`} className={key === tab ? "tab on" : "tab"} aria-current={key === tab ? "page" : undefined}>
            {t.label} <span className="count">{count(key)}</span>
          </Link>
        ))}
      </nav>
      <div className="card scroll">
        {payments.length === 0 ? <p>Aucun virement dans cette catégorie.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Commande</th><th>Client</th><th>Montant attendu</th><th>Preuves</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.createdAt, true)}</td>
                  <td>{p.order.id.slice(-8).toUpperCase()}</td>
                  <td>{p.order.holderName ?? "—"}<br /><span className="hint">{p.order.email}</span></td>
                  <td><strong>{formatPrice(p.order.totalCents)}</strong></td>
                  <td>{p._count.proofs}</td>
                  <td><span className={`badge ${p.status === "PAID" ? "PUBLISHED" : ""}`}>{STATUS_LABEL[p.status]}</span></td>
                  <td><Link className="btn btn-sm" href={`/virements/${p.id}`}>{p.status === "PROOF_SUBMITTED" ? "Vérifier" : "Détail"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
