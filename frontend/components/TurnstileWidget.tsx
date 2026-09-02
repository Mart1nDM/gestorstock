"use client";

import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

type TurnstileApi = {
  render: (container: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
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
  onToken: (token: string | null) => void;
};

export default function TurnstileWidget({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [loadFailed, setLoadFailed] = useState(false);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) {
      setLoadFailed(true);
      return;
    }

    let cancelled = false;
    const container = containerRef.current;
    const render = () => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      if (containerRef.current.childElementCount > 0) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: "flexible",
        callback: (token: string) => onTokenRef.current(token),
        "error-callback": () => onTokenRef.current(null),
        "expired-callback": () => {
          onTokenRef.current(null);
          if (window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
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
      return () => {
        cancelled = true;
        if (window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            /* noop */
          }
        }
      };
    }

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
      script.onerror = () => {
        if (!cancelled) setLoadFailed(true);
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      const pending = window.__turnstilePending || [];
      const idx = pending.indexOf(render);
      if (idx !== -1) pending.splice(idx, 1);
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  if (!SITE_KEY) {
    return (
      <div className="turnstile-wrap">
        <span className="muted" role="alert">
          Verificación de seguridad no disponible (falta configurar la Site Key de Cloudflare).
        </span>
      </div>
    );
  }

  return (
    <div className="turnstile-wrap">
      <div ref={containerRef} />
      {loadFailed && (
        <span className="muted" role="alert">
          No se pudo cargar la verificación de seguridad. Reintentá en unos segundos.
        </span>
      )}
    </div>
  );
}