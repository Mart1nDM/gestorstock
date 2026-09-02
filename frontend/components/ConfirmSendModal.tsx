"use client";

import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

type TurnstileApi = {
  render: (container: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  execute: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
    __turnstilePending?: Array<() => void>;
    __turnstileScriptInitiated?: boolean;
  }
}

type Props = {
  onConfirm: (token: string) => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmSendModal({ onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [solving, setSolving] = useState(true);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) {
      setFailed(true);
      return;
    }

    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      if (containerRef.current.childElementCount > 0) return;
      containerRef.current.innerHTML = "";
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: "normal",
        callback: (token: string) => {
          if (!cancelled) {
            setSolving(false);
            setVerified(true);
            setFailed(false);
            onConfirm(token);
          }
        },
        "error-callback": () => {
          if (!cancelled) {
            setSolving(false);
            setFailed(true);
          }
        },
      });
    };

    const enqueueRender = () => {
      window.__turnstilePending = window.__turnstilePending || [];
      window.__turnstilePending.push(render);
    };

    if (window.turnstile) {
      render();
    } else {
      enqueueRender();
      window.onTurnstileLoad = () => {
        (window.__turnstilePending || []).splice(0).forEach(fn => fn());
      };
      if (!window.__turnstileScriptInitiated) {
        window.__turnstileScriptInitiated = true;
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = TURNSTILE_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      const pending = window.__turnstilePending || [];
      const idx = pending.indexOf(render);
      if (idx !== -1) pending.splice(idx, 1);
      if (widgetIdRef.current) {
        try { window.turnstile?.reset(widgetIdRef.current); } catch { /* noop */ }
      }
    };
  }, []);

  function handleRetry() {
    setFailed(false);
    setSolving(true);
    if (window.turnstile && widgetIdRef.current) {
      try { window.turnstile.reset(widgetIdRef.current); } catch { /* noop */ }
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal confirm-send-modal" onClick={e => e.stopPropagation()}>
        <div className="page-header" style={{ alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Confirmar envío</h2>
            <p className="muted" style={{ marginBottom: 0 }}>Completá la verificación para enviar tu solicitud.</p>
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancelar</button>
        </div>

        <div className="confirm-send-body">
          {!verified && (
            <div className="confirm-send-instructions">
              Resolvé la verificación de seguridad y hacé clic en <strong>Enviar</strong>.
            </div>
          )}
          {verified && (
            <div className="confirm-send-success">
              ✓ Verificado correctamente. Enviando…
            </div>
          )}
          {failed && (
            <div className="confirm-send-failed">
              <span>No se pudo verificar. Reintentá.</span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleRetry}>Reintentar</button>
            </div>
          )}

          <div className="confirm-send-turnstile">
            <div ref={containerRef} />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 14 }}
            disabled={!verified}
            onClick={() => onConfirm("")}
          >
            {solving ? "Verificando…" : verified ? "Enviar solicitud" : "Esperando verificación…"}
          </button>
        </div>
      </div>
    </div>
  );
}
