"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { callBankApi } from "@/lib/web-api";

const back = (paymentId: string, error: string): never => redirect(`/virements/${paymentId}?error=${encodeURIComponent(error)}`);

/** Confirme le virement : le site émet les billets et les envoie au client. */
export async function confirmBankPayment(paymentId: string, formData: FormData) {
  const admin = await requireAdmin();
  if (formData.get("verified") !== "on") back(paymentId, "Cochez la case pour certifier que le montant a bien été reçu sur le compte.");
  const result = await callBankApi({ action: "confirm", paymentId, reviewer: admin.email });
  if (!result.ok) back(paymentId, result.error ?? "La confirmation a échoué.");
  console.info(`[audit] ${admin.email} a confirmé le virement ${paymentId}`);
  revalidatePath("/virements");
  redirect(`/virements/${paymentId}?done=${result.alreadyPaid ? "already" : "confirmed"}`);
}

/** Refuse la preuve (motif envoyé au client, qui peut en renvoyer une autre). */
export async function rejectBankPayment(paymentId: string, formData: FormData) {
  const admin = await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) back(paymentId, "Indiquez le motif du refus (5 caractères minimum) : il sera envoyé au client.");
  const result = await callBankApi({ action: "reject", paymentId, reviewer: admin.email, reason });
  if (!result.ok) back(paymentId, result.error ?? "Le refus a échoué.");
  console.info(`[audit] ${admin.email} a refusé la preuve du virement ${paymentId}`);
  revalidatePath("/virements");
  redirect(`/virements/${paymentId}?done=rejected`);
}
