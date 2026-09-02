"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../lib/api";

type Props = {
  planKey: string;
  planNombre: string;
  precioMensual: number;
  onClose: () => void;
};

export default function PaymentFormModal({ planKey, planNombre, precioMensual, onClose }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const nombre = String(form.get("nombre") || "").trim();
    const apellido = String(form.get("apellido") || "").trim();
    const correo = String(form.get("correo") || "").trim();
    const telefono = String(form.get("telefono") || "").trim() || undefined;

    if (!nombre) { setError("El nombre es obligatorio."); setLoading(false); return; }
    if (!correo) { setError("El correo es obligatorio."); setLoading(false); return; }

    try {
      const res = await apiFetch<{ ok: boolean; init_point: string; preferencia_id: string }>("/pagos/preferencia", {
        method: "POST",
        body: JSON.stringify({ nombre, apellido, correo, telefono, plan_key: planKey }),
      });
      if (res.ok && res.init_point) {
        window.location.href = res.init_point;
      } else {
        setError("No se pudo iniciar el pago. Intentá de nuevo.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo conectar con el servidor.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card page-pad modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Elegir plan {planNombre}</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 20, lineHeight: 1, padding: "4px 8px" }}>&times;</button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Pago único de <strong>${precioMensual.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS</strong>. Completá tus datos para ir a MercadoPago. La cuenta es para 1 usuario.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div className="field">
            <label className="label">Nombre *</label>
            <input className="input" name="nombre" type="text" required />
          </div>
          <div className="field">
            <label className="label">Apellido</label>
            <input className="input" name="apellido" type="text" />
          </div>
          <div className="field">
            <label className="label">Correo *</label>
            <input className="input" name="correo" type="email" required />
          </div>
          <div className="field">
            <label className="label">Teléfono (opcional)</label>
            <input className="input" name="telefono" type="tel" />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Redirigiendo a MercadoPago…" : "Ir a pagar"}
          </button>
          <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", margin: 0 }}>
            Te redirigimos a MercadoPago para completar el pago de forma segura.
          </p>
        </form>
      </div>
    </div>
  );
}
