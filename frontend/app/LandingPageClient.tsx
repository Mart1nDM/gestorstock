"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { PLANS } from "../lib/plan-data";

export default function LandingPageClient({ initialPlan }: { initialPlan: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  async function submitContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError("");
    setSent(false);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await apiFetch("/auth/contact", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      formEl.reset();
      setSelectedPlan(initialPlan);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la consulta.");
    } finally {
      setSending(false);
    }
  }

  return <>
    <header className="topbar"><div className="container topbar-inner">
      <Link href="/" className="brand"><span>●</span> MartoTech</Link>
      <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link className="btn btn-ghost" href="/planes">Planes</Link>
        <a className="btn btn-ghost" href="#contacto">Contacto</a>
        <Link className="btn btn-primary" href="/login">Ingresar</Link>
      </nav>
    </div></header>

    <main>
      <section className="landing-hero"><div className="container hero-grid">
        <div>
          <div className="badge">📦 Gestión de stock en la nube</div>
          <h1 className="hero-title">Tu inventario, ventas y métricas <em>en un solo lugar.</em></h1>
          <p className="hero-copy">Gestor de Stock es la evolución web de tu aplicación actual: productos, stock, ventas, alertas y métricas, separados por cada cuenta de negocio.</p>
          <div className="hero-actions">
            <a href="#contacto" className="btn btn-primary">Solicitar una cuenta</a>
            <Link href="/planes" className="btn btn-secondary">Comparar planes</Link>
            <Link href="/login" className="btn btn-secondary">Ya tengo una cuenta</Link>
          </div>
        </div>
        <div className="card preview">
          <div className="preview-window">
            <div className="muted" style={{ marginBottom: 12 }}>Vista del sistema</div>
            <div className="preview-row">
              <div className="preview-stat"><span className="muted">Productos</span><strong>128</strong></div>
              <div className="preview-stat"><span className="muted">Sin stock</span><strong style={{ color: "var(--danger)" }}>4</strong></div>
              <div className="preview-stat"><span className="muted">Stock bajo</span><strong style={{ color: "var(--warning)" }}>12</strong></div>
              <div className="preview-stat"><span className="muted">Ventas hoy</span><strong style={{ color: "var(--success)" }}>$184k</strong></div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span>Coca-Cola 2.25L</span><span className="status status-ok">24 unidades</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span>Sprite 2.25L</span><span className="status status-low">3 unidades</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fanta 1.5L</span><span className="status status-zero">Sin stock</span></div>
            </div>
          </div>
        </div>
      </div></section>

      <section className="features"><div className="container">
        <div className="page-header"><div><h2 style={{ margin: 0 }}>La misma lógica, ahora preparada para crecer</h2><p className="muted">Tomé como base el funcionamiento de tu aplicación de escritorio actual.</p></div></div>
        <div className="feature-grid">
          <div className="card feature-card"><div style={{ fontSize: 25 }}>📦</div><h3>Productos</h3><p>Alta, edición y baja lógica con búsqueda en tiempo real y ordenamiento por cualquier columna.</p></div>
          <div className="card feature-card"><div style={{ fontSize: 25 }}>🛒</div><h3>Ventas</h3><p>Seleccionás un producto, ingresás cantidad y precio, y el stock se descuenta en una operación atómica.</p></div>
          <div className="card feature-card"><div style={{ fontSize: 25 }}>📊</div><h3>Métricas</h3><p>Productos, stock bajo, sin stock, valor del inventario, ventas del día e histórico.</p></div>
        </div>
      </div></section>

      <section id="contacto" className="contact"><div className="container contact-grid">
        <div><div className="badge">✉️ Solicitud de cuenta</div><h2 style={{ fontSize: 38, margin: "18px 0 10px" }}>¿Querés usar el sistema?</h2><p className="muted" style={{ lineHeight: 1.7 }}>Mandame tus datos y contame qué plan te interesa. Desde el panel de administración puedo crear tu cuenta y enviarte la invitación para que configures tu propia contraseña.</p></div>
        <form className="card page-pad" onSubmit={submitContact}>
          <div className="form-grid">
            <div className="field"><label className="label">Nombre</label><input className="input" name="nombre" required /></div>
            <div className="field"><label className="label">Correo</label><input className="input" type="email" name="correo" required /></div>
            <div className="field"><label className="label">Teléfono</label><input className="input" name="telefono" /></div>
            <div className="field">
              <label className="label">Plan que te interesa</label>
              <select className="select" name="plan" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} required>
                <option value="">Elegí un plan</option>
                {PLANS.map(plan => <option key={plan.key} value={plan.name}>{plan.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}><label className="label">Mensaje</label><textarea className="textarea" name="mensaje" required placeholder="Contame qué necesitás para tu negocio…" /></div>
          {error && <div className="alert alert-error">{error}</div>}
          {sent && <div className="alert alert-success">Consulta enviada. Pronto un administrador se pondrá en contacto.</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={sending}>{sending ? "Enviando…" : "Enviar consulta"}</button>
        </form>
      </div></section>
    </main>
  </>;
}
