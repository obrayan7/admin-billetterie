"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@rideau/db";
import { COOKIE, createSession } from "@/lib/auth";

// Limitation basique des tentatives (en mémoire, par e-mail). À remplacer par Redis en multi-instances.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const now = Date.now();
  const rec = attempts.get(email);
  if (rec && now - rec.first < WINDOW_MS && rec.count >= MAX_ATTEMPTS) redirect("/login?error=trop");
  if (!rec || now - rec.first >= WINDOW_MS) attempts.set(email, { count: 0, first: now });

  const user = await prisma.user.findUnique({ where: { email } });
  // Comparaison factice si l'utilisateur n'existe pas, pour garder un temps de réponse constant
  const hash = user?.password ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
  const ok = (await bcrypt.compare(password, hash)) && (user?.role === "ADMIN" || user?.role === "CONTROLLER");

  if (!ok || !user) {
    attempts.get(email)!.count += 1;
    redirect("/login?error=1");
  }
  attempts.delete(email);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  cookies().delete(COOKIE);
  redirect("/login");
}
