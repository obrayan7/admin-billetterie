import { prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";
import { createCategory, deleteCategory, updateCategory } from "../actions-settings";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { events: true } } } });

  return (
    <>
      <h1>Catégories</h1>
      {searchParams.error && <p className="alert" role="alert">{searchParams.error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Nom</th><th>Événements</th><th /></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <form action={updateCategory.bind(null, c.id)} style={{ display: "flex", gap: 8 }}>
                    <input name="name" defaultValue={c.name} aria-label={`Nom de la catégorie ${c.name}`} required />
                    <button type="submit" className="btn-ghost btn-sm">Renommer</button>
                  </form>
                </td>
                <td>{c._count.events}</td>
                <td>
                  <form action={deleteCategory.bind(null, c.id)}><button type="submit" className="btn-danger btn-sm">Supprimer</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card">
        <h2>Ajouter une catégorie</h2>
        <form action={createCategory} className="stack">
          <label>Nom <input name="name" required /></label>
          <div><button type="submit">Ajouter</button></div>
        </form>
      </section>
    </>
  );
}
