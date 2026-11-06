const TZ = "Europe/Paris";

type Parts = Record<string, string>;
function parisParts(d: Date): Parts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** "2026-12-05T20:30" (heure de Paris) -> Date UTC */
export function parisToDate(local: string): Date {
  const asUtc = new Date(`${local}:00Z`);
  const p = parisParts(asUtc);
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(asUtc.getTime() - (wall - asUtc.getTime()));
}

/** Date UTC -> "2026-12-05T20:30" (valeur d'un input datetime-local, heure de Paris) */
export function toParisInput(d: Date): string {
  const p = parisParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
