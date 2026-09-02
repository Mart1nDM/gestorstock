"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

type TurnstileApi = {
  render: (container: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  execute: (widgetId?: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
    __turnstilePending?: Array<() => void>;
    __turnstileScriptInitiated?: boolean;
  }
}

export type TurnstileWidgetHandle = {
  solve: () => Promise<string>;
};

type Props = {
  onToken?: (token: string | null) => void;
};

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>(function TurnstileWidget({ onToken }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingResolveRef = useRef<((token: string) => void) | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [loadFailed, setLoadFailed] = useState(false);
  const [solving, setSolving] = useState(false);
  const [failed, setFailed] = useState(false);
  onTokenRef.current = onToken;

  const clearPending = useCallback(() => {
    if (pendingResolveRef.current) {
      pendingResolveRef.current("");
      pendingResolveRef.current = null;
    }
  }, []);

  const resolveWith = useCallback((token: string) => {
    if (pendingResolveRef.current) {
      pendingResolveRef.current(token);
      pendingResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!SITE_KEY) {
      setLoadFailed(true);
      return;
    }

    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      if (containerRef.current.childElementCount > 0) return;
      containerRef.current.innerHTML = "";
      const cb = (token: string) => {
        if (cancelled) return;
        lastTokenRef.current = token;
        onTokenRef.current?.(token);
        resolveWith(token);
        setSolving(false);
        setFailed(false);
      };
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: "flexible",
        execution: "execute",
        "error-callback": () => {
          if (cancelled) return;
          clearPending();
          setSolving(false);
          setFailed(true);
          onTokenRef.current?.(null);
        },
        callback: cb,
        "expired-callback": () => {
          if (cancelled) return;
          lastTokenRef.current = null;
          onTokenRef.current?.(null);
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
        clearPending();
        if (widgetIdRef.current) {
          try {
            window.turnstile?.reset(widgetIdRef.current);
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
      clearPending();
      const pending = window.__turnstilePending || [];
      const idx = pending.indexOf(render);
      if (idx !== -1) pending.splice(idx, 1);
      if (widgetIdRef.current) {
        try {
          window.turnstile?.reset(widgetIdRef.current);
        } catch {
          /* noop */
        }
      }
    };
  }, [clearPending, resolveWith]);

  useImperativeHandle(ref, () => ({
    solve: () => {
      return new Promise<string>((resolve) => {
        setFailed(false);
        setSolving(true);
        const t = window.turnstile;
        const id = widgetIdRef.current;
        if (!t || !id) {
          setSolving(false);
          resolve("");
          return;
        }
        pendingResolveRef.current = (token) => {
          setSolving(false);
          resolve(token);
        };
        try {
          t.execute(id);
        } catch {
          setSolving(false);
          resolve("");
        }
      });
    },
  }));

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
      {solving && <span className="muted">Verificando…</span>}
      {failed && (
        <div className="turnstile-retry">
          <span className="muted" role="alert">No se pudo completar la verificación. Reintentá.</span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setFailed(false)}>Reintentar</button>
        </div>
      )}
      {loadFailed && (
        <div className="turnstile-retry">
          <span className="muted" role="alert">No se pudo cargar la verificación de seguridad.</span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLoadFailed(false)}>Reintentar</button>
        </div>
      )}
    </div>
  );
});

export default TurnstileWidget;
