import { toParisInput } from "@/lib/time";

type Option = { id: string; name: string };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  categories: Option[];
  venues: Option[];
  submitLabel: string;
  showStatus?: boolean;
  defaults?: {
    title: string; organizer: string; description: string; categoryId: string; venueId: string; startsAt: Date; status: string;
  };
};

export function EventForm({ action, categories, venues, submitLabel, showStatus, defaults }: Props) {
  return (
    <form action={action} className="stack">
      <label>Titre
        <input name="title" defaultValue={defaults?.title} required minLength={3} maxLength={140} />
      </label>
      <div className="grid2">
        <label>Catégorie
          <select name="categoryId" defaultValue={defaults?.categoryId} required>
            <option value="">Choisir…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Lieu
          <select name="venueId" defaultValue={defaults?.venueId} required>
            <option value="">Choisir…</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
      </div>
      <label>Date et heure <span className="hint">(heure de Paris)</span>
        <input type="datetime-local" name="startsAt" defaultValue={defaults ? toParisInput(defaults.startsAt) : undefined} required />
      </label>
      <label>Organisateur <span className="hint">(affiché sur les billets : « Organisé par … »)</span>
        <input name="organizer" defaultValue={defaults?.organizer} maxLength={120} />
      </label>
      <label>Description
        <textarea name="description" defaultValue={defaults?.description} required minLength={10} />
      </label>
      {showStatus && (
        <label>Statut
          <select name="status" defaultValue={defaults?.status ?? "DRAFT"}>
            <option value="DRAFT">Brouillon (invisible)</option>
            <option value="PUBLISHED">Publié (visible sur le site)</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
          <span className="hint">Pour publier, l'événement doit avoir au moins une image et un type de billet.</span>
        </label>
      )}
      <div><button type="submit">{submitLabel}</button></div>
    </form>
  );
}
