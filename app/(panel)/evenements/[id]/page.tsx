import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice, imageVariant, prisma } from "@rideau/db";
import { EventForm } from "@/components/EventForm";
import {
  addTicketType, deleteImage, deleteTicketType, moveImage, setCover, updateEvent, updateImageAlt, uploadImages,
} from "../../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // traitement des images

export default async function EditEventPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { error?: string; saved?: string } }) {
  const [event, categories, venues] = await Promise.all([
    prisma.event.findUnique({
      where: { id: params.id },
      include: { images: { orderBy: { position: "asc" } }, ticketTypes: { orderBy: { priceCents: "asc" } } },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.venue.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!event) notFound();

  const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
  // Images S3 : URL absolue ; images locales (dev) : relative au site public
  const assetUrl = (u: string) => (u.startsWith("http") ? u : `${webUrl}${u}`);

  return (
    <>
      <div className="row">
        <h1>{event.title}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {event.status === "PUBLISHED" && <a className="btn btn-ghost" href={`${webUrl}/evenements/${event.slug}`} target="_blank" rel="noreferrer">Voir sur le site</a>}
          <Link href="/" className="btn btn-ghost">Retour</Link>
        </div>
      </div>

      {searchParams.error && <p className="alert" role="alert">{searchParams.error}</p>}
      {searchParams.saved && <p role="status" className="hint">Modifications enregistrées.</p>}

      <section className="card" aria-labelledby="infos">
        <h2 id="infos">Informations</h2>
        <EventForm
          action={updateEvent.bind(null, event.id)}
          categories={categories}
          venues={venues}
          showStatus
          submitLabel="Enregistrer"
          defaults={{
            title: event.title, organizer: event.organizer ?? "", description: event.description, categoryId: event.categoryId,
            venueId: event.venueId, startsAt: event.startsAt, status: event.status,
          }}
        />
      </section>

      <section className="card" aria-labelledby="billets">
        <h2 id="billets">Types de billets</h2>
        {event.ticketTypes.length > 0 && (
          <div className="scroll">
            <table>
              <thead><tr><th>Nom</th><th>Prix</th><th>Quantité</th><th>Max / commande</th><th>Sièges</th><th /></tr></thead>
              <tbody>
                {event.ticketTypes.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{formatPrice(t.priceCents)}</td>
                    <td>{t.quantity}</td>
                    <td>{t.maxPerOrder}</td>
                    <td>{t.seatPrefix ? `${t.seatPrefix}1, ${t.seatPrefix}2…` : "Placement libre"}</td>
                    <td>
                      <form action={deleteTicketType.bind(null, event.id, t.id)}>
                        <button type="submit" className="btn-danger btn-sm">Supprimer</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <h3 style={{ margin: "20px 0 10px", fontSize: "1rem" }}>Ajouter un type de billet</h3>
        <form action={addTicketType.bind(null, event.id)} className="stack">
          <div className="grid2">
            <label>Nom <input name="name" placeholder="Fosse, Balcon, Plein tarif…" required /></label>
            <label>Prix TTC (€) <input name="price" inputMode="decimal" placeholder="35,00" required /></label>
            <label>Quantité disponible <input type="number" name="quantity" min={1} defaultValue={100} required /></label>
            <label>Maximum par commande <input type="number" name="maxPerOrder" min={1} max={20} defaultValue={8} required /></label>
            <label>Numérotation des sièges <span className="hint">(facultatif : lettre « A » → A1, A2… ; vide = placement libre)</span><input name="seatPrefix" maxLength={3} placeholder="A" /></label>
          </div>
          <div><button type="submit">Ajouter le billet</button></div>
        </form>
      </section>

      <section className="card" aria-labelledby="images">
        <h2 id="images">Images ({event.images.length})</h2>
        <p className="hint">JPG, PNG ou WebP, {Number(process.env.MAX_UPLOAD_MB) || 5} Mo maximum par image (et par envoi). La première image marquée « couverture » apparaît sur les cartes et en tête de la page.</p>
        {event.images.length > 0 && (
          <div className="images">
            {event.images.map((img, i) => (
              <div className="img-card" key={img.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(imageVariant(img.url, 400))} alt={img.alt ?? ""} />
                <div className="meta">
                  {img.isCover ? <span className="badge PUBLISHED">Couverture</span> : (
                    <form action={setCover.bind(null, event.id, img.id)}><button type="submit" className="btn-ghost btn-sm">Définir comme couverture</button></form>
                  )}
                  <form action={updateImageAlt.bind(null, event.id, img.id)} style={{ display: "flex", gap: 4 }}>
                    <input name="alt" defaultValue={img.alt ?? ""} placeholder="Texte alternatif" aria-label="Texte alternatif" style={{ minHeight: 32, flex: 1, minWidth: 0 }} />
                    <button type="submit" className="btn-ghost btn-sm">OK</button>
                  </form>
                  <div className="actions">
                    {i > 0 && <form action={moveImage.bind(null, event.id, img.id, "up")}><button type="submit" className="btn-ghost btn-sm" aria-label="Monter l'image">↑</button></form>}
                    {i < event.images.length - 1 && <form action={moveImage.bind(null, event.id, img.id, "down")}><button type="submit" className="btn-ghost btn-sm" aria-label="Descendre l'image">↓</button></form>}
                    <form action={deleteImage.bind(null, event.id, img.id)}><button type="submit" className="btn-danger btn-sm">Supprimer</button></form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <form action={uploadImages.bind(null, event.id)} className="stack" encType="multipart/form-data">
          <label>Ajouter des images
            <input type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple required />
          </label>
          <label>Texte alternatif <span className="hint">(décrit l'image pour les lecteurs d'écran, facultatif)</span>
            <input name="alt" maxLength={160} />
          </label>
          <div><button type="submit">Téléverser</button></div>
        </form>
      </section>
    </>
  );
}
