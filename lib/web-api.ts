type BankResult = { ok: boolean; error?: string; issued?: boolean; alreadyPaid?: boolean };

/**
 * Appelle l'API interne du site public pour confirmer / refuser un virement.
 * La confirmation émet les billets, génère les PDF et envoie l'e-mail : cette logique n'existe qu'à un seul endroit (le site).
 * L'opération est idempotente : on peut la rejouer sans risque si la réponse est perdue.
 */
export async function callBankApi(body: { action: "confirm" | "reject"; paymentId: string; reviewer: string; reason?: string }): Promise<BankResult> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return { ok: false, error: "INTERNAL_API_SECRET n'est pas configuré côté admin." };
  const base = (process.env.WEB_INTERNAL_URL || process.env.WEB_URL || "http://localhost:3000").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/internal/bank`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000), // génération des PDF + envoi de l'e-mail
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as BankResult;
    if (!res.ok) return { ok: false, error: json.error ?? `Le site a répondu avec une erreur (${res.status}).` };
    return json;
  } catch {
    return { ok: false, error: "Le site public ne répond pas. Réessayez dans un instant : l'opération peut être rejouée sans risque." };
  }
}
