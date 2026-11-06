import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@rideau/db";

export const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 8; // 8 heures

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SESSION_SECRET manquant ou trop court (16 caractères minimum).");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

async function currentUser() {
  const token = cookies().get(COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload?.sub) return null;
  return prisma.user.findUnique({ where: { id: payload.sub } });
}

/** Administrateur uniquement. À appeler au début de chaque page et de chaque action serveur du panneau. */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "CONTROLLER") redirect("/scan");
  if (user.role !== "ADMIN") redirect("/login");
  return user;
}

/** Administrateur ou contrôleur (scan des billets à l'entrée). */
export async function requireStaff() {
  const user = await currentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "CONTROLLER")) redirect("/login");
  return user;
}
