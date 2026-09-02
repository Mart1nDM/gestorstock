"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export type TurnstileWidgetHandle = {
  solve: () => Promise<string>;
};

const TurnstileWidget = forwardRef<TurnstileWidgetHandle>(function TurnstileWidget(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingResolveRef = useRef<((token: string) => void) | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const clearPending = useCallback(() => {
    if (pendingResolveRef.current) {
      pendingResolveRef.current("");
      pendingResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!SITE_KEY) {
      setLoadFailed(true);
      return;
    }

    let cancelled = false;
    const t = window.turnstile;
    const container = containerRef.current;

    if (t && container && container.childElementCount === 0) {
      widgetIdRef.current = t.render(container, {
        sitekey: SITE_KEY,
        size: "flexible",
        execution: "execute",
        callback: (token: string) => {
          if (!cancelled && pendingResolveRef.current) {
            pendingResolveRef.current(token);
            pendingResolveRef.current = null;
          }
        },
        "error-callback": () => {
          if (!cancelled) clearPending();
        },
        "expired-callback": () => {
          if (!cancelled) clearPending();
        },
      });
    }

    return () => {
      cancelled = true;
      clearPending();
      if (widgetIdRef.current) {
        try { window.turnstile?.reset(widgetIdRef.current); } catch { /* noop */ }
      }
    };
  }, [clearPending]);

  useImperativeHandle(ref, () => ({
    solve: () => new Promise<string>((resolve) => {
      setLoadFailed(false);
      pendingResolveRef.current = (token) => resolve(token);
      try {
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.execute(widgetIdRef.current);
        } else {
          resolve("");
        }
      } catch {
        resolve("");
      }
    }),
  }));

  if (!SITE_KEY) {
    return <div className="turnstile-wrap"><span className="muted" role="alert">Verificación no disponible.</span></div>;
  }

  return (
    <div className="turnstile-wrap">
      <div ref={containerRef} />
      {loadFailed && <span className="muted" role="alert">No se pudo cargar la verificación.</span>}
    </div>
  );
});

export default TurnstileWidget;
