"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import ConfirmSendModal from "../components/ConfirmSendModal";

type AuthTab = "login" | "register";

export default function LandingPageClient({ initialPlan }: { initialPlan: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [supportSent, setSupportSent] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [regSent, setRegSent] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSending, setRegSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<"contact" | "register" | "support">("contact");
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [pendingFormEl, setPendingFormEl] = useState<HTMLFormElement | null>(null);

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  function openAuth(tab: AuthTab) {
    setAuthTab(tab);
    setLoginError("");
    setRegError("");
    setRegSent(false);
    setRegSending(false);
    setAuthOpen(true);
  }

  function openConfirm(type: "contact" | "register" | "support", payload: Record<string, unknown>, formEl: HTMLFormElement) {
    setPendingPayload(payload);
    setPendingFormEl(formEl);
    setConfirmType(type);
    setConfirmOpen(true);
  }

  async function submitContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSent(false);
    const form = new FormData(e.currentTarget);
    const nombre = String(form.get("nombre") || "").trim();
    const apellido = String(form.get("apellido") || "").trim();
    openConfirm("contact", {
      nombre: apellido ? `${nombre} ${apellido}` : nombre,
      correo: form.get("correo"),
      telefono: form.get("telefono"),
      plan: "Gratis",
      mensaje: "Quiero probar el sistema con una cuenta gratuita.",
    }, e.currentTarget);
  }

  async function submitSupport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSupportError("");
    setSupportSent(false);
    const form = new FormData(e.currentTarget);
    const medio = String(form.get("medio_contacto") || "correo");
    const mensaje = String(form.get("mensaje") || "").trim();
    openConfirm("support", {
      nombre: form.get("nombre"),
      correo: form.get("correo"),
      telefono: form.get("telefono"),
      plan: "Soporte",
      mensaje: `Solicitud de contraseña temporal. Medio preferido: ${medio}.\n\n${mensaje}`,
    }, e.currentTarget);
  }

  async function submitLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) setLoginError("Correo o contraseña incorrectos, o la cuenta está bloqueada.");
    else router.replace("/dashboard");
    setLoginLoading(false);
  }

  async function submitRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRegError("");
    setRegSent(false);
    const form = new FormData(e.currentTarget);
    const nombre = String(form.get("nombre") || "").trim();
    const apellido = String(form.get("apellido") || "").trim();
    openConfirm("register", {
      nombre: apellido ? `${nombre} ${apellido}` : nombre,
      correo: form.get("correo"),
      telefono: form.get("telefono"),
      plan: "Gratis",
      mensaje: "Solicitud para crear una cuenta gratuita de prueba. Quiero comenzar a usar el gestor.",
    }, e.currentTarget);
  }

  function openSupport() {
    setSupportOpen(true);
    setSupportSent(false);
    setSupportError("");
    setSupportSending(false);
  }

  async function handleConfirmSend(token: string) {
    if (!pendingPayload) return;
    const payload = { ...pendingPayload, cf_turnstile_response: token };
    try {
      await apiFetch("/auth/contact", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setConfirmOpen(false);
      setPendingPayload(null);
      if (confirmType === "contact") {
        pendingFormEl?.reset();
        setSelectedPlan(initialPlan);
        setSent(true);
      } else if (confirmType === "register") {
        pendingFormEl?.reset();
        setRegSent(true);
      } else {
        pendingFormEl?.reset();
        setSupportSent(true);
      }
    } catch (err) {
      setConfirmOpen(false);
      const msg = err instanceof Error ? err.message : "No se pudo enviar la solicitud.";
      if (confirmType === "contact") setError(msg);
      else if (confirmType === "register") setRegError(msg);
      else setSupportError(msg);
    }
  }

  return <>
    <header className="topbar"><div className="container topbar-inner">
      <Link href="/" className="brand"><img src="/logo.png" alt="MartoTech" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8, verticalAlign: "middle", marginRight: 10 }} /> GESTOR ONLINE</Link>
      <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link className="btn btn-ghost" href="/planes">Planes</Link>
        <Link className="btn btn-secondary" href="/#solicitar" onClick={() => openAuth("register")}>Solicitar cuenta</Link>
        <button className="btn btn-primary" onClick={() => openAuth("login")}>Ingresar</button>
      </nav>
    </div></header>

    <main>
      <section className="landing-hero"><div className="container hero-grid">
        <div>
          <div className="badge">📦 Gestión de stock en la nube</div>
          <h1 className="hero-title">Tu inventario, ventas y métricas <em>en un solo lugar.</em></h1>
          <p className="hero-copy">Gestor Online es la evolución web de tu aplicación actual: productos, stock, ventas, alertas y métricas, separados por cada cuenta de negocio.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => openAuth("register")}>Solicitar una cuenta</button>
            <Link href="/planes" className="btn btn-secondary">Comparar planes</Link>
            <button className="btn btn-secondary" onClick={() => openAuth("login")}>Ya tengo una cuenta</button>
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

      <section id="contacto" className="contact"><div id="solicitar" className="container contact-grid">
        <div><div className="badge">🚀 Probá el sistema gratis</div><h2 style={{ fontSize: 38, margin: "18px 0 10px" }}>¿Querés probar el sistema?</h2><p className="muted" style={{ lineHeight: 1.7 }}>Dejame tus datos y te creo una cuenta gratuita de prueba. Desde el panel de administración activo tu acceso y te envío la invitación para que configures tu propia contraseña.</p></div>
        <form className="card page-pad" onSubmit={submitContact}>
          <div className="form-grid">
            <div className="field"><label className="label">Nombre</label><input className="input" name="nombre" required /></div>
            <div className="field"><label className="label">Apellido</label><input className="input" name="apellido" /></div>
            <div className="field"><label className="label">Correo</label><input className="input" type="email" name="correo" required /></div>
            <div className="field"><label className="label">Teléfono</label><input className="input" name="telefono" /></div>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {sent && <div className="alert alert-success">Solicitud enviada. Te contacto para crear tu cuenta gratuita.</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={sending}>{sending ? "Enviando…" : "Pedir mi cuenta gratuita"}</button>
        </form>
      </div></section>
    </main>

    <footer className="footer"><div className="container footer-inner">
      <div className="footer-brand"><img src="/logo.png" alt="MartoTech" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6, verticalAlign: "middle", marginRight: 9 }} /> Gestor Online</div>
      <div className="footer-social">
        <a href="https://instagram.com/TU_USUARIO" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </a>
        <a href="https://github.com/TU_USUARIO" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"/></svg>
        </a>
      </div>
      <div className="footer-copy">© 2026 MartoTech. Todos los derechos reservados.</div>
    </div></footer>

    {authOpen && (
      <div className="modal-backdrop auth-modal" onClick={() => setAuthOpen(false)}>
        <div className="modal" onClick={event => event.stopPropagation()}>
          <div className="page-header" style={{ alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{authTab === "login" ? "Ingresar" : "Solicitar cuenta"}</h2>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setAuthOpen(false)}>Cerrar</button>
          </div>
          <div className="auth-tabs">
            <button type="button" className={authTab === "login" ? "active" : ""} onClick={() => setAuthTab("login")}>Iniciar sesión</button>
            <button type="button" className={authTab === "register" ? "active" : ""} onClick={() => setAuthTab("register")}>Solicitar cuenta</button>
          </div>

          {authTab === "login" ? (
            <form className="auth-form" onSubmit={submitLogin}>
              <div className="field"><label className="label">Correo electrónico</label><input className="input" type="email" name="email" autoComplete="email" required /></div>
              <div className="field"><label className="label">Contraseña</label><input className="input" type="password" name="password" autoComplete="current-password" required /></div>
              {loginError && <div className="alert alert-error">{loginError}</div>}
              <button className="btn btn-primary" disabled={loginLoading}>{loginLoading ? "Ingresando…" : "Ingresar"}</button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={submitRegister}>
              <div className="field"><label className="label">Nombre</label><input className="input" name="nombre" required /></div>
              <div className="field"><label className="label">Apellido</label><input className="input" name="apellido" /></div>
              <div className="field"><label className="label">Correo</label><input className="input" type="email" name="correo" required /></div>
              <div className="field"><label className="label">Teléfono</label><input className="input" name="telefono" /></div>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Pedís una cuenta gratuita de prueba. Un administrador la activa y recibís la invitación para configurar tu contraseña.</p>
              {regError && <div className="alert alert-error">{regError}</div>}
              {regSent && <div className="alert alert-success">Solicitud enviada. Pronto se pondrán en contacto contigo.</div>}
              <button className="btn btn-primary" disabled={regSending}>{regSending ? "Enviando…" : "Enviar solicitud"}</button>
            </form>
          )}
        </div>
      </div>
    )}

    <button type="button" className="public-support-fab" onClick={openSupport} aria-label="Contactar soporte" title="Soporte">
      <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a8 8 0 0 1 16 0v2" />
        <path d="M4 13h2a2 2 0 0 1 2 2v2H5a1 1 0 0 1-1-1v-3Z" />
        <path d="M20 13h-2a2 2 0 0 0-2 2v2h3a1 1 0 0 0 1-1v-3Z" />
        <path d="M12 19h2" />
      </svg>
    </button>
    {supportOpen && (
      <div className="modal-backdrop" onClick={() => setSupportOpen(false)}>
        <div className="modal public-support-modal" onClick={event => event.stopPropagation()}>
          <div className="page-header" style={{ alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Soporte de acceso</h2>
              <p className="muted" style={{ marginBottom: 0 }}>Solicitá una contraseña temporal por correo o teléfono.</p>
            </div>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSupportOpen(false)}>Cerrar</button>
          </div>
          <form onSubmit={submitSupport} className="support-form">
            <div className="form-grid">
              <div className="field"><label className="label">Nombre</label><input className="input" name="nombre" required /></div>
              <div className="field"><label className="label">Correo de la cuenta</label><input className="input" type="email" name="correo" required /></div>
              <div className="field"><label className="label">Teléfono</label><input className="input" name="telefono" placeholder="Opcional" /></div>
              <div className="field"><label className="label">Preferís respuesta por</label><select className="select" name="medio_contacto" defaultValue="correo"><option value="correo">Correo</option><option value="telefono">Teléfono</option></select></div>
            </div>
            <div className="field"><label className="label">Mensaje</label><textarea className="textarea" name="mensaje" required placeholder="Indicá que olvidaste tu contraseña y cómo podemos contactarte." /></div>
            {supportError && <div className="alert alert-error">{supportError}</div>}
            {supportSent && <div className="alert alert-success">Ticket enviado. Soporte se pondrá en contacto para darte una contraseña temporal.</div>}
            <button className="btn btn-primary" disabled={supportSending}>{supportSending ? "Enviando…" : "Enviar ticket a soporte"}</button>
          </form>
        </div>
      </div>
    )}

    {confirmOpen && pendingPayload && (
      <ConfirmSendModal
        key={`${confirmType}-${Date.now()}`}
        onConfirm={handleConfirmSend}
        onCancel={() => { setConfirmOpen(false); setPendingPayload(null); setPendingFormEl(null); }}
      />
    )}
  </>;
}
