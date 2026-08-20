"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
      if (!data.session) setError("La invitación no es válida o ya venció.");
    })();
  }, []);

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const repeat = String(form.get("repeat"));
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== repeat) return setError("Las contraseñas no coinciden.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      return;
    }
    await apiFetch("/auth/invitations/complete", { method: "POST" }).catch(() => null);
    setDone(true);
  }

  return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="card page-pad" style={{ width: "min(440px,100%)" }}>
    <Link href="/" className="brand" style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
      <div style={{ position: "relative", width: 144, height: 144 }}>
        <Image src="/logo.png" alt="MartoTech" fill sizes="144px" priority style={{ objectFit: "contain" }} />
      </div>
    </Link>
    {!ready && !error && <p className="muted">Validando invitación…</p>}
    {error && <div className="alert alert-error">{error}</div>}
    {done ? <><h1>Cuenta lista</h1><p className="muted">Tu contraseña fue configurada correctamente.</p><button className="btn btn-primary" onClick={() => router.replace("/dashboard")}>Entrar al sistema</button></> : ready ? <><h1>Crear contraseña</h1><p className="muted">Esta contraseña la conocés solamente vos.</p><form onSubmit={savePassword} style={{ display: "grid", gap: 14, marginTop: 20 }}><div className="field"><label className="label">Nueva contraseña</label><input className="input" type="password" name="password" required /></div><div className="field"><label className="label">Repetir contraseña</label><input className="input" type="password" name="repeat" required /></div><button className="btn btn-primary">Guardar contraseña</button></form></> : null}
  </div></main>;
}

