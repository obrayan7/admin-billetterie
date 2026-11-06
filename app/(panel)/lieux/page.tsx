import { prisma } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";
import { createVenue, deleteVenue, updateVenue } from "../actions-settings";

export const dynamic = "force-dynamic";

type V = { name?: string; address?: string; city?: string; country?: string; lat?: number | null; lng?: number | null };

function VenueFields({ v }: { v?: V }) {
  return (
    <>
      <div className="grid2">
        <label>Nom <input name="name" defaultValue={v?.name} required /></label>
        <label>Adresse <input name="address" defaultValue={v?.address} required /></label>
        <label>Ville <input name="city" defaultValue={v?.city} required /></label>
        <label>Pays <span className="hint">(code à 2 lettres)</span><input name="country" defaultValue={v?.country ?? "FR"} maxLength={2} required /></label>
        <label>Latitude <span className="hint">(facultatif)</span><input name="lat" inputMode="decimal" defaultValue={v?.lat ?? ""} /></label>
        <label>Longitude <span className="hint">(facultatif)</span><input name="lng" inputMode="decimal" defaultValue={v?.lng ?? ""} /></label>
      </div>
    </>
  );
}

export default async function VenuesPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  const venues = await prisma.venue.findMany({ orderBy: [{ city: "asc" }, { name: "asc" }], include: { _count: { select: { events: true } } } });

  return (
    <>
      <h1>Lieux</h1>
      {searchParams.error && <p className="alert" role="alert">{searchParams.error}</p>}
      {venues.map((v) => (
        <details className="item" key={v.id}>
          <summary><span>{v.name} — {v.city}</span><span className="hint">{v._count.events} événement{v._count.events > 1 ? "s" : ""}</span></summary>
          <div>
            <form action={updateVenue.bind(null, v.id)} className="stack" style={{ maxWidth: "none" }}>
              <VenueFields v={v} />
              <div style={{ display: "flex", gap: 8 }}><button type="submit">Enregistrer</button></div>
            </form>
            <form action={deleteVenue.bind(null, v.id)} style={{ marginTop: 10 }}>
              <button type="submit" className="btn-danger btn-sm">Supprimer ce lieu</button>
            </form>
          </div>
        </details>
      ))}
      <section className="card" style={{ marginTop: 24 }}>
        <h2>Ajouter un lieu</h2>
        <form action={createVenue} className="stack" style={{ maxWidth: "none" }}>
          <VenueFields />
          <div><button type="submit">Ajouter le lieu</button></div>
        </form>
      </section>
    </>
  );
}
