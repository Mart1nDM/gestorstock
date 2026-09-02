"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { PLANS } from "../lib/plan-data";
import TurnstileWidget from "../components/TurnstileWidget";

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
  const [contactToken, setContactToken] = useState<string | null>(null);
  const [regToken, setRegToken] = useState<string | null>(null);
  const [supportToken, setSupportToken] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  function openAuth(tab: AuthTab) {
    setAuthTab(tab);
    setLoginError("");
    setRegError("");
    setRegSent(false);
    setRegSending(false);
    setRegToken(null);
    setAuthOpen(true);
  }

  async function submitContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contactToken) {
      setError("Verificá que no sos un robot para continuar.");
      return;
    }
    setSending(true);
    setError("");
    setSent(false);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await apiFetch("/auth/contact", {
        method: "POST",
        body: JSON.stringify({ ...Object.fromEntries(form.entries()), cf_turnstile_response: contactToken }),
      });
      formEl.reset();
      setSelectedPlan(initialPlan);
      setContactToken(null);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la consulta.");
    } finally {
      setSending(false);
    }
  }

  async function submitSupport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supportToken) {
      setSupportError("Verificá que no sos un robot para continuar.");
      return;
    }
    setSupportSending(true);
    setSupportError("");
    setSupportSent(false);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const medio = String(form.get("medio_contacto") || "correo");
    const mensaje = String(form.get("mensaje") || "").trim();
    try {
      await apiFetch("/auth/contact", {
        method: "POST",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          correo: form.get("correo"),
          telefono: form.get("telefono"),
          plan: "Soporte",
          mensaje: `Solicitud de contraseña temporal. Medio preferido: ${medio}.\n\n${mensaje}`,
          cf_turnstile_response: supportToken,
        }),
      });
      formEl.reset();
      setSupportToken(null);
      setSupportSent(true);
    } catch (err) {
      setSupportError(err instanceof Error ? err.message : "No se pudo enviar el ticket.");
    } finally {
      setSupportSending(false);
    }
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
    if (!regToken) {
      setRegError("Verificá que no sos un robot para continuar.");
      return;
    }
    setRegSending(true);
    setRegError("");
    setRegSent(false);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const regPlan = String(form.get("plan") || selectedPlan);
    try {
      await apiFetch("/auth/contact", {
        method: "POST",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          correo: form.get("correo"),
          telefono: form.get("telefono"),
          plan: regPlan,
          mensaje: "Solicitud para crear una cuenta. Quiero comenzar a usar el gestor.",
          cf_turnstile_response: regToken,
        }),
      });
      formEl.reset();
      setRegToken(null);
      setRegSent(true);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setRegSending(false);
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
          <div style={{ margin: "12px 0" }}>
            <TurnstileWidget onToken={setContactToken} />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {sent && <div className="alert alert-success">Consulta enviada. Pronto un administrador se pondrá en contacto.</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={sending}>{sending ? "Enviando…" : "Enviar consulta"}</button>
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
              <div className="field"><label className="label">Correo</label><input className="input" type="email" name="correo" required /></div>
              <div className="field"><label className="label">Teléfono</label><input className="input" name="telefono" /></div>
              <div className="field">
                <label className="label">Plan que te interesa</label>
                <select className="select" name="plan" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} required>
                  <option value="">Elegí un plan</option>
                  {PLANS.map(plan => <option key={plan.key} value={plan.name}>{plan.name}</option>)}
                </select>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Un administrador creará tu cuenta y recibirás la invitación para configurar tu contraseña.</p>
              <div style={{ margin: "12px 0" }}>
                <TurnstileWidget onToken={setRegToken} />
              </div>
              {regError && <div className="alert alert-error">{regError}</div>}
              {regSent && <div className="alert alert-success">Solicitud enviada. Pronto se pondrán en contacto contigo.</div>}
              <button className="btn btn-primary" disabled={regSending}>{regSending ? "Enviando…" : "Enviar solicitud"}</button>
            </form>
          )}
        </div>
      </div>
    )}

    <button type="button" className="public-support-fab" onClick={() => { setSupportOpen(true); setSupportSent(false); setSupportError(""); setSupportSending(false); setSupportToken(null); }} aria-label="Contactar soporte" title="Soporte">
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
            <div style={{ margin: "12px 0" }}>
              <TurnstileWidget onToken={setSupportToken} />
            </div>
            {supportError && <div className="alert alert-error">{supportError}</div>}
            {supportSent && <div className="alert alert-success">Ticket enviado. Soporte se pondrá en contacto para darte una contraseña temporal.</div>}
            <button className="btn btn-primary" disabled={supportSending}>{supportSending ? "Enviando…" : "Enviar ticket a soporte"}</button>
          </form>
        </div>
      </div>
    )}
  </>;
}
