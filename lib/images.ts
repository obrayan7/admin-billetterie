import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

// 5 Mo par défaut ; sur Vercel (corps de requête limité à 4,5 Mo au total) définir MAX_UPLOAD_MB=4
const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const WIDTHS = [400, 800, 1600] as const;

/**
 * Deux modes de stockage :
 *  - S3 (production) : n'importe quel stockage compatible S3 hébergé dans l'UE (Scaleway, Cloudflare R2, OVH…).
 *    Activé dès que S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY et S3_PUBLIC_URL sont renseignés.
 *  - Dossier local (développement uniquement) : écrit dans apps/web/public/uploads.
 */
const s3Enabled = () =>
  Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_PUBLIC_URL);

const publicBase = () => (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");

let client: S3Client | null = null;
function s3() {
  return (client ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  }));
}

function localDir() {
  return process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "../web/public/uploads");
}

export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error(`« ${file.name} » dépasse ${MAX_MB} Mo.`);
  const input = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.format || !["jpeg", "png", "webp"].includes(meta.format)) {
    throw new Error(`« ${file.name} » n'est pas une image JPG, PNG ou WebP valide.`);
  }

  const id = randomUUID();
  const variants = await Promise.all(
    WIDTHS.map(async (w) => ({
      name: `${id}-${w}.webp`,
      body: await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    })),
  );

  if (s3Enabled()) {
    const uploaded: string[] = [];
    try {
      for (const v of variants) {
        await s3().send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET!, Key: `events/${v.name}`, Body: v.body,
          ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable",
        }));
        uploaded.push(`events/${v.name}`);
      }
    } catch (e) {
      await removeKeys(uploaded).catch(() => {});
      throw new Error("Échec de l'envoi vers le stockage d'images. Vérifiez la configuration S3.");
    }
    return `${publicBase()}/events/${id}-1600.webp`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Stockage d'images non configuré (variables S3_*).");
  }
  await fs.mkdir(localDir(), { recursive: true });
  await Promise.all(variants.map((v) => fs.writeFile(path.join(localDir(), v.name), v.body)));
  return `/uploads/${id}-1600.webp`;
}

async function removeKeys(keys: string[]) {
  if (keys.length === 0) return;
  await s3().send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET!, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
}

export async function deleteImageFiles(url: string) {
  if (s3Enabled() && url.startsWith(publicBase())) {
    const key = url.slice(publicBase().length + 1); // events/<id>-1600.webp
    const base = key.replace(/-1600\.webp$/, "");
    await removeKeys(WIDTHS.map((w) => `${base}-${w}.webp`));
    return;
  }
  const base = path.basename(url).replace(/-1600\.webp$/, "");
  await Promise.all(WIDTHS.map((w) => fs.rm(path.join(localDir(), `${base}-${w}.webp`), { force: true })));
}
