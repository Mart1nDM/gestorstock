"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    if (error) setError("Correo o contraseña incorrectos, o la cuenta está bloqueada.");
    else router.replace("/dashboard");
    setLoading(false);
  }

  async function sendReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetError("");
    setResetMessage("");
    setResetLoading(true);
    const email = resetEmail.trim();
    if (!email) {
      setResetError("Escribí el correo de la cuenta.");
      setResetLoading(false);
      return;
    }
    const redirectTo = `${window.location.origin}/set-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) setResetError(error.message);
    else setResetMessage("Te enviamos un enlace para restablecer la contraseña.");
    setResetLoading(false);
  }

  return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
    <div className="card page-pad" style={{ width: "min(440px,100%)" }}>
      <Link href="/" className="brand" style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div style={{ position: "relative", width: 144, height: 144 }}>
          <Image src="/logo.png" alt="MartoTech" fill sizes="144px" priority style={{ objectFit: "contain" }} />
        </div>
      </Link>
      <h1 style={{ marginBottom: 6 }}>Ingresar</h1><p className="muted">Accedé a tu gestor de stock.</p>
      <form onSubmit={login} style={{ display: "grid", gap: 14, marginTop: 20 }}>
        <div className="field"><label className="label">Correo electrónico</label><input className="input" type="email" name="email" required /></div>
        <div className="field"><label className="label">Contraseña</label><input className="input" type="password" name="password" required /></div>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</button>
      </form>
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)", display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Restablecer contraseña</h3>
          <p className="muted" style={{ margin: "6px 0 0" }}>Te enviamos un link para crear una nueva.</p>
        </div>
        <form onSubmit={sendReset} style={{ display: "grid", gap: 12 }}>
          <div className="field">
            <label className="label">Correo de la cuenta</label>
            <input className="input" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="nombre@correo.com" />
          </div>
          {resetError && <div className="alert alert-error">{resetError}</div>}
          {resetMessage && <div className="alert alert-success">{resetMessage}</div>}
          <button className="btn btn-secondary" disabled={resetLoading}>{resetLoading ? "Enviando…" : "Enviar enlace de restablecimiento"}</button>
        </form>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>Las cuentas se crean desde administración. La contraseña la configura cada usuario mediante su invitación.</p>
    </div>
  </main>;
}

