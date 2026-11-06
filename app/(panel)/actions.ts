"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, slugify } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";
import { deleteImageFiles, saveImage } from "@/lib/images";
import { parisToDate } from "@/lib/time";

const MAX_IMAGES_PER_EVENT = 12;

const eventSchema = z.object({
  title: z.string().trim().min(3).max(140),
  organizer: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10),
  categoryId: z.string().min(1),
  venueId: z.string().min(1),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

function fail(eventId: string, message: string): never {
  redirect(`/evenements/${eventId}?error=${encodeURIComponent(message)}`);
}

export async function createEvent(formData: FormData) {
  await requireAdmin();
  const parsed = eventSchema.safeParse({ ...Object.fromEntries(formData), status: "DRAFT" });
  if (!parsed.success) redirect(`/evenements/nouveau?error=${encodeURIComponent("Formulaire incomplet ou invalide.")}`);
  const d = parsed.data;
  const event = await prisma.event.create({
    data: {
      title: d.title,
      organizer: d.organizer || null,
      description: d.description,
      categoryId: d.categoryId,
      venueId: d.venueId,
      startsAt: parisToDate(d.startsAt),
      status: "DRAFT",
      slug: `${slugify(d.title)}-${randomBytes(2).toString("hex")}`,
    },
  });
  revalidatePath("/");
  redirect(`/evenements/${event.id}`);
}

export async function updateEvent(eventId: string, formData: FormData) {
  await requireAdmin();
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(eventId, "Formulaire incomplet ou invalide.");
  const d = parsed.data;

  if (d.status === "PUBLISHED") {
    const [images, tickets] = await Promise.all([
      prisma.eventImage.count({ where: { eventId } }),
      prisma.ticketType.count({ where: { eventId } }),
    ]);
    if (images === 0) fail(eventId, "Ajoutez au moins une image (couverture) avant de publier.");
    if (tickets === 0) fail(eventId, "Ajoutez au moins un type de billet avant de publier.");
  }

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title: d.title,
      organizer: d.organizer || null,
      description: d.description,
      categoryId: d.categoryId,
      venueId: d.venueId,
      startsAt: parisToDate(d.startsAt),
      status: d.status,
    },
  });
  revalidatePath("/");
  redirect(`/evenements/${eventId}?saved=1`);
}

/* ---------- Types de billets ---------- */

const ticketSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.string().transform((s) => Math.round(parseFloat(s.replace(",", ".")) * 100)).pipe(z.number().int().min(0).max(1_000_000)),
  quantity: z.coerce.number().int().min(1).max(100_000),
  maxPerOrder: z.coerce.number().int().min(1).max(20),
  seatPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{0,3}$/).optional(),
});

export async function addTicketType(eventId: string, formData: FormData) {
  await requireAdmin();
  const parsed = ticketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(eventId, "Type de billet invalide : vérifiez le nom, le prix et la quantité.");
  const { name, price, quantity, maxPerOrder, seatPrefix } = parsed.data;
  await prisma.ticketType.create({ data: { eventId, name, priceCents: price, quantity, maxPerOrder, seatPrefix: seatPrefix || null } });
  revalidatePath(`/evenements/${eventId}`);
  redirect(`/evenements/${eventId}?saved=1`);
}

export async function deleteTicketType(eventId: string, ticketTypeId: string) {
  await requireAdmin();
  const sold = await prisma.orderItem.count({ where: { ticketTypeId } });
  if (sold > 0) fail(eventId, "Ce billet a déjà été commandé : il ne peut plus être supprimé.");
  await prisma.ticketType.delete({ where: { id: ticketTypeId } });
  revalidatePath(`/evenements/${eventId}`);
  redirect(`/evenements/${eventId}`);
}

/* ---------- Images ---------- */

export async function uploadImages(eventId: string, formData: FormData) {
  await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) fail(eventId, "Sélectionnez au moins une image.");
  const alt = String(formData.get("alt") ?? "").trim() || null;

  const existing = await prisma.eventImage.findMany({ where: { eventId }, orderBy: { position: "asc" } });
  if (existing.length + files.length > MAX_IMAGES_PER_EVENT) fail(eventId, `Maximum ${MAX_IMAGES_PER_EVENT} images par événement.`);

  let position = existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
  let hasCover = existing.some((i) => i.isCover);
  const saved: string[] = [];
  try {
    for (const file of files) {
      const url = await saveImage(file);
      saved.push(url);
      await prisma.eventImage.create({ data: { eventId, url, alt, position: position++, isCover: !hasCover } });
      hasCover = true;
    }
  } catch (e) {
    fail(eventId, e instanceof Error ? e.message : "Échec du téléversement.");
  }
  revalidatePath(`/evenements/${eventId}`);
  redirect(`/evenements/${eventId}?saved=1`);
}

export async function setCover(eventId: string, imageId: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.eventImage.updateMany({ where: { eventId }, data: { isCover: false } }),
    prisma.eventImage.update({ where: { id: imageId }, data: { isCover: true } }),
  ]);
  revalidatePath(`/evenements/${eventId}`);
}

export async function moveImage(eventId: string, imageId: string, direction: "up" | "down") {
  await requireAdmin();
  const images = await prisma.eventImage.findMany({ where: { eventId }, orderBy: { position: "asc" } });
  const i = images.findIndex((img) => img.id === imageId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= images.length) return;
  // Réécrit des positions contiguës pour éviter les doublons
  const order = images.map((img) => img.id);
  [order[i], order[j]] = [order[j], order[i]];
  await prisma.$transaction(order.map((id, position) => prisma.eventImage.update({ where: { id }, data: { position } })));
  revalidatePath(`/evenements/${eventId}`);
}

export async function updateImageAlt(eventId: string, imageId: string, formData: FormData) {
  await requireAdmin();
  const alt = String(formData.get("alt") ?? "").trim() || null;
  await prisma.eventImage.update({ where: { id: imageId }, data: { alt } });
  revalidatePath(`/evenements/${eventId}`);
}

export async function deleteImage(eventId: string, imageId: string) {
  await requireAdmin();
  const image = await prisma.eventImage.findUnique({ where: { id: imageId } });
  if (!image || image.eventId !== eventId) return;
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { images: true } });
  if (event?.status === "PUBLISHED" && event.images.length === 1) {
    fail(eventId, "Un événement publié doit garder au moins une image. Passez-le en brouillon d'abord.");
  }
  await prisma.eventImage.delete({ where: { id: imageId } });
  await deleteImageFiles(image.url);
  if (image.isCover) {
    const next = await prisma.eventImage.findFirst({ where: { eventId }, orderBy: { position: "asc" } });
    if (next) await prisma.eventImage.update({ where: { id: next.id }, data: { isCover: true } });
  }
  revalidatePath(`/evenements/${eventId}`);
}
