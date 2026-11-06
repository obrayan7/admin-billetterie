import { formatDate, prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";
import { createStaffUser, deleteStaffUser } from "../actions-settings";

export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams: { error?: string } }) {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "CONTROLLER"] } }, orderBy: { createdAt: "asc" } });

  return (
    <>
      <h1>Équipe</h1>
      <p className="hint">Les <strong>administrateurs</strong> gèrent tout. Les <strong>contrôleurs</strong> n&apos;ont accès qu&apos;au scanner de billets (personnel d&apos;accueil).</p>
      {searchParams.error && <p className="alert" role="alert">{searchParams.error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>E-mail</th><th>Nom</th><th>Rôle</th><th>Créé le</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name ?? "—"}</td>
                <td>{u.role === "ADMIN" ? "Administrateur" : "Contrôleur"}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td>{u.id !== me.id && <form action={deleteStaffUser.bind(null, u.id)}><button type="submit" className="btn-danger btn-sm">Supprimer</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card">
        <h2>Ajouter un membre</h2>
        <form action={createStaffUser} className="stack">
          <label>E-mail <input type="email" name="email" required autoComplete="off" /></label>
          <label>Nom <input name="name" /></label>
          <label>Mot de passe initial <span className="hint">(10 caractères minimum, à communiquer de façon sécurisée)</span>
            <input type="password" name="password" minLength={10} required autoComplete="new-password" />
          </label>
          <label>Rôle
            <select name="role" defaultValue="CONTROLLER">
              <option value="CONTROLLER">Contrôleur (scanner uniquement)</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </label>
          <div><button type="submit">Ajouter</button></div>
        </form>
      </section>
    </>
  );
}
