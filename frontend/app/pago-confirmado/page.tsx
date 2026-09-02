"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";

function PagoConfirmadoForm() {
  const params = useSearchParams();
  const plan = params.get("plan") || "";
  const email = params.get("email") || "";
  const status = params.get("status") || "";
  const rawPaymentId = params.get("payment_id") || params.get("collection_id") || "";
  const paymentId = rawPaymentId ? Number(rawPaymentId) : null;
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const isApproved = status === "approved" || status === "pending";

  useEffect(() => {
    if (!isApproved || !email || !plan) return;
    apiFetch<{ ok: boolean }>("/pagos/verificar", {
      method: "POST",
      body: JSON.stringify({ correo: email, plan_key: plan, payment_id: paymentId }),
    }).catch(() => null);
  }, [email, plan, paymentId, isApproved]);

  async function handleSetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const repeat = String(form.get("repeat") || "");
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== repeat) { setError("Las contraseñas no coinciden."); return; }
    setSaving(true);
    try {
      const res = await apiFetch<{ ok: boolean }>("/pagos/set-password", {
        method: "POST",
        body: JSON.stringify({
          correo: email,
          password,
          plan_key: plan,
          payment_id: paymentId,
        }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        setError("No se pudo guardar la contraseña. Intentá de nuevo.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="card page-pad" style={{ width: "min(440px,100%)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ position: "relative", width: 144, height: 144 }}>
            <img src="/logo.png" alt="MartoTech" width={144} height={144} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </div>
        </div>
        {success ? (
          <>
            <h1 style={{ textAlign: "center" }}>¡Cuenta lista!</h1>
            <p className="muted" style={{ textAlign: "center" }}>
              Tu contraseña fue configurada correctamente. Ya podés ingresar a tu cuenta.
            </p>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => window.location.href = "/dashboard"}>
              Entrar al sistema
            </button>
          </>
        ) : !isApproved ? (
          <>
            <h1 style={{ textAlign: "center" }}>Pago no completado</h1>
            <p className="muted" style={{ textAlign: "center" }}>
              {status === "failure"
                ? "El pago no pudo ser procesado. Podés intentar de nuevo."
                : "Tu pago está pendiente de confirmación. Te notificaremos por correo cuando se acredite."}
            </p>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => window.location.href = "/planes"}>
              Volver a planes
            </button>
          </>
        ) : (
          <>
            <h1 style={{ textAlign: "center" }}>¡Pago aprobado!</h1>
            <p className="muted" style={{ textAlign: "center" }}>
              Tu pago fue confirmado. Ahora configurá tu contraseña para acceder a tu cuenta <strong>{plan === "premium" ? "Premium" : "Pro"}</strong>.
            </p>
            <form onSubmit={handleSetPassword} style={{ display: "grid", gap: 14, marginTop: 20 }}>
              <div className="field">
                <label className="label">Correo</label>
                <input className="input" type="email" value={email} disabled readOnly />
              </div>
              <div className="field">
                <label className="label">Nueva contraseña</label>
                <input className="input" type="password" name="password" required />
              </div>
              <div className="field">
                <label className="label">Repetir contraseña</label>
                <input className="input" type="password" name="repeat" required />
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <button className="btn btn-primary" disabled={saving} style={{ width: "100%" }}>
                {saving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function PagoConfirmadoPage() {
  return <Suspense fallback={<div className="empty" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Cargando…</div>}><PagoConfirmadoForm /></Suspense>;
}
