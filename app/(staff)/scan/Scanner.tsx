"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { scan, type ScanOutcome } from "./actions";

const LABEL = { valid: "Billet valide", used: "Billet déjà utilisé", invalid: "Billet invalide" } as const;
const ICON = { valid: "✓", used: "!", invalid: "✗" } as const;

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busy = useRef(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const check = useCallback(async (code: string) => {
    const now = Date.now();
    // Évite de revalider le même QR code en boucle pendant qu'il reste devant la caméra
    if (busy.current || (last.current.code === code && now - last.current.at < 4000)) return;
    busy.current = true;
    last.current = { code, at: now };
    try {
      const r = await scan(code);
      setOutcome(r);
      navigator.vibrate?.(r.result === "valid" ? 80 : [120, 60, 120]);
    } catch {
      setError("Erreur réseau : le billet n'a pas pu être vérifié.");
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          const canvas = canvasRef.current;
          if (canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            const w = 480, h = Math.round((video.videoHeight / video.videoWidth) * 480);
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(video, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) void check(code.data);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Caméra inaccessible. Autorisez-la dans le navigateur (le site doit être en HTTPS) ou saisissez le code à la main.");
        setActive(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, check]);

  return (
    <div>
      <div className="row">
        <h1>Scanner les billets</h1>
        <button type="button" onClick={() => { setError(null); setActive((a) => !a); }}>{active ? "Arrêter la caméra" : "Démarrer la caméra"}</button>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}

      {active && (
        <div className="viewfinder">
          <video ref={videoRef} muted playsInline aria-label="Flux de la caméra" />
          <canvas ref={canvasRef} hidden />
        </div>
      )}

      <div role="status" aria-live="assertive">
        {outcome && (
          <div className={`scan-result ${outcome.result}`}>
            <strong>{ICON[outcome.result]} {LABEL[outcome.result]}</strong>
            {outcome.event && <p style={{ margin: "8px 0 0" }}>{outcome.event} — {outcome.category}{outcome.seat ? ` — siège ${outcome.seat}` : ""}</p>}
            {outcome.holder && <p style={{ margin: "4px 0 0" }}>Titulaire : {outcome.holder}</p>}
            {outcome.result === "used" && outcome.usedAt && (
              <p style={{ margin: "4px 0 0" }}>Scanné le {new Date(outcome.usedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p>
            )}
          </div>
        )}
      </div>

      <form
        className="stack"
        style={{ marginTop: 24 }}
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("code") as HTMLInputElement;
          if (input.value.trim()) { last.current = { code: "", at: 0 }; void check(input.value.trim()); input.value = ""; }
        }}
      >
        <label>Numéro de billet <span className="hint">(EV… — si le QR code est illisible)</span>
          <input name="code" autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </label>
        <div><button type="submit" className="btn-ghost">Vérifier le code</button></div>
      </form>
    </div>
  );
}
