import Link from "next/link";
import { prisma } from "@rideau/db";
import { EventForm } from "@/components/EventForm";
import { createEvent } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewEventPage({ searchParams }: { searchParams: { error?: string } }) {
  const [categories, venues] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.venue.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <div className="row">
        <h1>Nouvel événement</h1>
        <Link href="/" className="btn btn-ghost">Retour</Link>
      </div>
      {searchParams.error && <p className="alert" role="alert">{searchParams.error}</p>}
      <div className="card">
        <p className="hint">L'événement est créé en brouillon. Vous ajouterez ensuite les images et les billets, puis vous le publierez.</p>
        <EventForm action={createEvent} categories={categories} venues={venues} submitLabel="Créer le brouillon" />
      </div>
    </>
  );
}
