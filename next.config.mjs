import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const prod = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" }, // l'admin ne doit jamais être indexé
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }, // caméra : scanner de billets
  ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rideau/db"],
  poweredByHeader: false,
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  experimental: {
    instrumentationHook: true,
    outputFileTracingRoot: root,
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
    serverActions: { bodySizeLimit: "30mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
