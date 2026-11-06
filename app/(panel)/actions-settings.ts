"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidBic, isValidIban, looksLikeIban, prisma, slugify } from "@rideau/db";
import { requireAdmin } from "@/lib/auth";

const back = (path: string, error: string): never => redirect(`${path}?error=${encodeURIComponent(error)}`);

/* ---------- Lieux ---------- */
const venueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().length(2).toUpperCase().default("FR"),
  lat: z.string().optional().transform((v) => (v ? parseFloat(v.replace(",", ".")) : null)),
  lng: z.string().optional().transform((v) => (v ? parseFloat(v.replace(",", ".")) : null)),
});

function parseVenue(formData: FormData, path: string) {
  const parsed = venueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "Lieu invalide : nom, adresse, ville et pays (2 lettres) sont obligatoires.");
  const d = parsed.data!;
  if ((d.lat !== null && Number.isNaN(d.lat)) || (d.lng !== null && Number.isNaN(d.lng))) back(path, "Coordonnées GPS invalides.");
  return d;
}

export async function createVenue(formData: FormData) {
  await requireAdmin();
  await prisma.venue.create({ data: parseVenue(formData, "/lieux") });
  revalidatePath("/lieux");
  redirect("/lieux");
}

export async function updateVenue(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.venue.update({ where: { id }, data: parseVenue(formData, "/lieux") });
  revalidatePath("/lieux");
  redirect("/lieux");
}

export async function deleteVenue(id: string) {
  await requireAdmin();
  if ((await prisma.event.count({ where: { venueId: id } })) > 0) back("/lieux", "Ce lieu est utilisé par des événements : impossible de le supprimer.");
  await prisma.venue.delete({ where: { id } });
  revalidatePath("/lieux");
  redirect("/lieux");
}

/* ---------- Catégories ---------- */
const nameSchema = z.string().trim().min(2).max(60);

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) back("/categories", "Nom de catégorie invalide (2 caractères minimum).");
  const slug = slugify(name.data!);
  if (await prisma.category.findFirst({ where: { OR: [{ slug }, { name: name.data! }] } })) back("/categories", "Cette catégorie existe déjà.");
  await prisma.category.create({ data: { name: name.data!, slug } });
  revalidatePath("/categories");
  redirect("/categories");
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin();
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) back("/categories", "Nom de catégorie invalide.");
  // Le slug (utilisé dans les URL de filtre) est conservé : on ne change que le nom affiché
  await prisma.category.update({ where: { id }, data: { name: name.data! } }).catch(() => back("/categories", "Ce nom est déjà utilisé."));
  revalidatePath("/categories");
  redirect("/categories");
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  if ((await prisma.event.count({ where: { categoryId: id } })) > 0) back("/categories", "Cette catégorie est utilisée par des événements : impossible de la supprimer.");
  await prisma.category.delete({ where: { id } });
  revalidatePath("/categories");
  redirect("/categories");
}

/* ---------- Équipe (administrateurs et contrôleurs) ---------- */
const staffSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(100).optional(),
  password: z.string().min(10, "Mot de passe : 10 caractères minimum."),
  role: z.enum(["ADMIN", "CONTROLLER"]),
});

export async function createStaffUser(formData: FormData) {
  await requireAdmin();
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/equipe", parsed.error.issues[0]?.message ?? "Formulaire invalide.");
  const d = parsed.data!;
  if (await prisma.user.findUnique({ where: { email: d.email } })) back("/equipe", "Cette adresse est déjà utilisée par un compte.");
  await prisma.user.create({ data: { email: d.email, name: d.name || null, role: d.role, password: await bcrypt.hash(d.password, 12) } });
  revalidatePath("/equipe");
  redirect("/equipe");
}

export async function deleteStaffUser(id: string) {
  const me = await requireAdmin();
  if (me.id === id) back("/equipe", "Vous ne pouvez pas supprimer votre propre compte.");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role === "CUSTOMER") back("/equipe", "Utilisateur introuvable.");
  if (target!.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) back("/equipe", "Il doit rester au moins un administrateur.");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/equipe");
  redirect("/equipe");
}

/* ---------- Comptes bancaires (virements) ---------- */
// Action sensible : un IBAN modifié détournerait les paiements des clients.
// Elle exige le mot de passe de l'administrateur, valide l'IBAN (clé de contrôle) et est tracée dans les logs.
const bankSchema = z.object({
  label: z.string().trim().min(2).max(80),
  bankName: z.string().trim().min(2).max(120),
  accountHolder: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(5).max(40),
  bic: z.string().trim().max(11).optional(),
  instructions: z.string().trim().max(500).optional(),
});

async function checkBankForm(formData: FormData) {
  const admin = await requireAdmin();
  const password = String(formData.get("confirmPassword") ?? "");
  if (!admin.password || !(await bcrypt.compare(password, admin.password))) back("/comptes-bancaires", "Mot de passe incorrect : les coordonnées bancaires n'ont pas été modifiées.");
  return admin;
}

function parseBank(formData: FormData) {
  const parsed = bankSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/comptes-bancaires", "Compte invalide : libellé, banque, titulaire et IBAN / numéro de compte sont obligatoires.");
  const d = parsed.data!;
  const compact = d.accountNumber.replace(/\s/g, "").toUpperCase();
  if (looksLikeIban(compact)) {
    if (!isValidIban(compact)) back("/comptes-bancaires", "Cet IBAN est invalide (clé de contrôle incorrecte). Vérifiez-le caractère par caractère : un IBAN erroné ferait partir les paiements vers un mauvais compte.");
  } else if (!/^[A-Z0-9 -]{5,34}$/i.test(d.accountNumber)) {
    back("/comptes-bancaires", "Numéro de compte invalide (lettres, chiffres, espaces et tirets uniquement).");
  }
  if (d.bic && !isValidBic(d.bic)) back("/comptes-bancaires", "BIC invalide (8 ou 11 caractères).");
  return {
    label: d.label, bankName: d.bankName, accountHolder: d.accountHolder,
    accountNumber: looksLikeIban(compact) ? compact : d.accountNumber.trim(),
    bic: d.bic ? d.bic.replace(/\s/g, "").toUpperCase() : null,
    instructions: d.instructions || null,
    active: formData.get("active") === "on",
  };
}

export async function createBankAccount(formData: FormData) {
  const admin = await checkBankForm(formData);
  const account = await prisma.bankAccount.create({ data: parseBank(formData) });
  console.info(`[audit] ${admin.email} a ajouté le compte bancaire ${account.id}`);
  revalidatePath("/comptes-bancaires");
  redirect("/comptes-bancaires?saved=1");
}

export async function updateBankAccount(id: string, formData: FormData) {
  const admin = await checkBankForm(formData);
  await prisma.bankAccount.update({ where: { id }, data: parseBank(formData) });
  console.info(`[audit] ${admin.email} a modifié le compte bancaire ${id}`);
  revalidatePath("/comptes-bancaires");
  redirect("/comptes-bancaires?saved=1");
}

export async function deleteBankAccount(id: string, formData: FormData) {
  const admin = await checkBankForm(formData);
  await prisma.bankAccount.delete({ where: { id } });
  console.info(`[audit] ${admin.email} a supprimé le compte bancaire ${id}`);
  revalidatePath("/comptes-bancaires");
  redirect("/comptes-bancaires?saved=1");
}
