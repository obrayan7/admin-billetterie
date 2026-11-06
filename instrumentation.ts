export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runEnvCheck } = await import("@rideau/db/src/env-check");
  runEnvCheck("admin");
}
