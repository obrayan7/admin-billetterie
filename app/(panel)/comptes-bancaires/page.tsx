import Link from "next/link";
import { formatAccountNumber, formatDate, prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";
import { createBankAccount, deleteBankAccount, updateBankAccount } from "../actions-settings";

export const dynamic = "force-dynamic";

type A = { label?: string; bankName?: string; accountHolder?: string; accountNumber?: string; bic?: string | null; instructions?: string | null; active?: boolean };

function Fields({ a }: { a?: A }) {
  return (
    <>
      <div className="grid2">
        <label>Libellé interne <span className="hint">(ex. « Compte principal EUR »)</span><input name="label" defaultValue={a?.label} required /></label>
        <label>Banque<input name="bankName" defaultValue={a?.bankName} required /></label>
        <label>Titulaire du compte<input name="accountHolder" defaultValue={a?.accountHolder} required /></label>
        <label>IBAN <span className="hint">(ou numéro de compte)</span><input name="accountNumber" defaultValue={a?.accountNumber ? formatAccountNumber(a.accountNumber) : ""} required autoComplete="off" spellCheck={false} /></label>
        <label>BIC / SWIFT <span className="hint">(facultatif)</span><input name="bic" defaultValue={a?.bic ?? ""} maxLength={11} autoComplete="off" /></label>
      </div>
      <label>Consignes affichées au client <span className="hint">(facultatif)</span>
        <textarea name="instructions" defaultValue={a?.instructions ?? ""} maxLength={500} style={{ minHeight: 70 }} placeholder="Ex. : indiquez la référence de commande dans le libellé du virement." />
      </label>
      <label style={{ display: "flex", gap: 10, fontWeight: 400 }}>
        <input type="checkbox" name="active" defaultChecked={a?.active ?? true} style={{ minHeight: 0 }} /> Compte actif (affiché aux clients)
      </label>
    </>
  );
}

export default async function BankAccountsPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  await requireAdmin();
  const accounts = await prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <div className="row">
        <h1>Comptes bancaires</h1>
        <Link href="/virements" className="btn btn-ghost">Voir les virements</Link>
      </div>
      <p className="hint">Ces coordonnées sont envoyées par e-mail et affichées aux clients qui choisissent le virement. Sans compte actif, l'option n'apparaît pas au paiement. Toute modification demande votre mot de passe.</p>
      {searchParams.error && <p className="alert" role="alert">{searchParams.error}</p>}
      {searchParams.saved && <p className="notice" role="status">Modifications enregistrées.</p>}

      {accounts.map((a) => (
        <details className="item" key={a.id}>
          <summary><span>{a.label} — {a.bankName} {a.active ? "" : "(désactivé)"}</span><span className="hint">{formatAccountNumber(a.accountNumber)}</span></summary>
          <div>
            <form action={updateBankAccount.bind(null, a.id)} className="stack" style={{ maxWidth: "none" }}>
              <Fields a={a} />
              <label style={{ maxWidth: 320 }}>Votre mot de passe (confirmation)<input type="password" name="confirmPassword" autoComplete="current-password" required /></label>
              <div><button type="submit">Enregistrer</button> <span className="hint">Dernière modification : {formatDate(a.updatedAt, true)}</span></div>
            </form>
            <form action={deleteBankAccount.bind(null, a.id)} style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <label style={{ maxWidth: 260 }}>Mot de passe pour supprimer<input type="password" name="confirmPassword" autoComplete="current-password" required /></label>
              <button type="submit" className="btn-danger">Supprimer ce compte</button>
            </form>
          </div>
        </details>
      ))}

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Ajouter un compte bancaire</h2>
        <form action={createBankAccount} className="stack" style={{ maxWidth: "none" }}>
          <Fields />
          <label style={{ maxWidth: 320 }}>Votre mot de passe (confirmation)<input type="password" name="confirmPassword" autoComplete="current-password" required /></label>
          <div><button type="submit">Ajouter le compte</button></div>
        </form>
      </section>
    </>
  );
}
