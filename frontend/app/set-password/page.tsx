"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";
import { useRouter, useSearchParams } from "next/navigation";

type InvitationInfo = {
  ok: boolean;
  profile_id: string;
  nombre: string;
  correo: string;
  plan: string | null;
};

type PageState = "loading" | "ready" | "no-session" | "invalid";

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<PageState>("loading");
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    let subscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    if (!token) {
      setState("invalid");
      return;
    }

    (async () => {
      try {
        const inv = await apiFetch<InvitationInfo>(`/auth/invitations/${encodeURIComponent(token)}`);
        if (!alive) return;
        if (!inv || !inv.ok) {
          setState("invalid");
          return;
        }
        setInvitation(inv);

        const matchSession = (sessionUserId: string | undefined) => {
          if (!alive) return;
          if (!sessionUserId || sessionUserId !== inv.profile_id) {
            setState("invalid");
            return;
          }
          setState("ready");
        };

        subscription = supabase.auth.onAuthStateChange((_event, session) => {
          matchSession(session?.user?.id);
        });

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          matchSession(data.session.user.id);
          return;
        }

        timer = window.setTimeout(() => {
          if (!alive) return;
          setState(current => (current === "ready" ? current : "no-session"));
        }, 12000);
      } catch {
        if (alive) setState("invalid");
      }
    })();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      if (subscription) subscription.data.subscription.unsubscribe();
    };
  }, [token]);

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const repeat = String(form.get("repeat"));
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== repeat) return setError("Las contraseñas no coinciden.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }
    await apiFetch(`/auth/invitations/complete?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
    setSaving(false);
    setDone(true);
  }

  return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="card page-pad" style={{ width: "min(440px,100%)" }}>
    <Link href="/" className="brand" style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
      <div style={{ position: "relative", width: 144, height: 144 }}>
        <img src="/logo.png" alt="MartoTech" width={144} height={144} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
    </Link>
    {state === "loading" && <p className="muted">Validando invitación…</p>}
    {state === "no-session" && <div className="alert alert-error">No se pudo iniciar sesión con este enlace. Abrí el correo de invitación en este navegador y volvé a hacer clic en el enlace.</div>}
    {state === "invalid" && <div className="alert alert-error">El enlace de invitación no es válido, ya fue usado o no corresponde a tu cuenta.</div>}
    {done && <>
      <h1>Cuenta lista</h1>
      <p className="muted">Tu contraseña fue configurada correctamente.</p>
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.replace("/dashboard")}>Entrar al sistema</button>
    </>}
    {state === "ready" && !done && <>
      <h1>Crear contraseña</h1>
      <p className="muted">Hola{invitation?.nombre ? ` ${invitation.nombre}` : ""}. Esta contraseña la vas a usar para entrar a {invitation?.correo}. La conocés solamente vos.</p>
      <form onSubmit={savePassword} style={{ display: "grid", gap: 14, marginTop: 20 }}>
        <div className="field"><label className="label">Nueva contraseña</label><input className="input" type="password" name="password" required /></div>
        <div className="field"><label className="label">Repetir contraseña</label><input className="input" type="password" name="repeat" required /></div>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </>}
  </div></main>;
}

export default function SetPasswordPage() {
  return <Suspense fallback={<div className="empty" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Cargando…</div>}><SetPasswordForm /></Suspense>;
}