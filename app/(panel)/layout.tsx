import Link from "next/link";
import { prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";
import { siteName } from "@/lib/site";
import { logout } from "../login/actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const toReview = await prisma.payment.count({ where: { provider: "BANK_TRANSFER", status: "PROOF_SUBMITTED" } });
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Link href="/" className="name">{siteName()}<small>administration</small></Link>
          <form action={logout} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="hint">{user.email}</span>
            <button type="submit" className="btn-ghost btn-sm">Se déconnecter</button>
          </form>
        </div>
      </header>
      <nav className="subnav" aria-label="Sections">
        <div className="inner">
          <Link href="/">Événements</Link>
          <Link href="/commandes">Commandes</Link>
          <Link href="/virements">Virements{toReview > 0 && <span className="pill" aria-label={`${toReview} à vérifier`}>{toReview}</span>}</Link>
          <Link href="/comptes-bancaires">Comptes bancaires</Link>
          <Link href="/lieux">Lieux</Link>
          <Link href="/categories">Catégories</Link>
          <Link href="/equipe">Équipe</Link>
          <Link href="/scan">Scanner</Link>
        </div>
      </nav>
      <div className="container">{children}</div>
    </>
  );
}
