"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ApiError, apiFetch } from "../lib/api";
import type { Profile } from "../types";
import { PLAN_BY_KEY, type PlanKey } from "../lib/plan-data";

const links = [
  ["📊", "Dashboard", "/dashboard"],
  ["📈", "Métricas", "/metricas"],
  ["➕", "Agregar Producto", "/productos?nuevo=1"],
  ["🔎", "Inventario", "/productos"],
  ["🛒", "Ventas", "/ventas"],
  ["🔗", "Compartir", "/compartir"],
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportSuccess, setSupportSuccess] = useState("");
  const activePlanKey = profile?.plan_nombre?.toLowerCase() as PlanKey | undefined;
  const activePlan = activePlanKey && PLAN_BY_KEY[activePlanKey];

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("gestor-stock-theme");
    const nextDarkMode = savedTheme !== "light";
    setDarkMode(nextDarkMode);
    document.documentElement.dataset.theme = nextDarkMode ? "dark" : "light";
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await apiFetch<Profile>("/auth/me");
        if (alive) setProfile(me);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await supabase.auth.signOut();
          router.replace("/");
          return;
        }
        if (alive) setAuthError(error instanceof Error ? error.message : "No se pudo validar la sesión.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    window.localStorage.removeItem("gestor-stock-theme");
    setDarkMode(true);
    document.documentElement.dataset.theme = "dark";
    router.replace("/");
  }

  function toggleTheme() {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    document.documentElement.dataset.theme = nextDarkMode ? "dark" : "light";
    window.localStorage.setItem("gestor-stock-theme", nextDarkMode ? "dark" : "light");
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    setPasswordError("");
    setPasswordSuccess("");
    if (password.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordLoading(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPasswordSuccess("Contraseña actualizada correctamente.");
    e.currentTarget.reset();
  }

  async function sendSupportTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const form = new FormData(e.currentTarget);
    const subject = String(form.get("subject") || "").trim();
    const message = String(form.get("message") || "").trim();
    if (!subject || !message) {
      setSupportError("Completá el asunto y el mensaje.");
      return;
    }
    setSupportLoading(true);
    setSupportError("");
    setSupportSuccess("");
    try {
      await apiFetch("/auth/contact", {
        method: "POST",
        body: JSON.stringify({
          nombre: `${profile.nombre} ${profile.apellido}`.trim() || profile.nombre,
          correo: profile.correo,
          telefono: profile.telefono || "",
          plan: "Soporte",
          mensaje: `Asunto: ${subject}\n\n${message}`,
        }),
      });
      setSupportSuccess("Tu ticket fue enviado. Te vamos a responder por correo.");
      e.currentTarget.reset();
      window.setTimeout(() => setSupportOpen(false), 900);
    } catch (error) {
      setSupportError(error instanceof Error ? error.message : "No se pudo enviar el ticket.");
    } finally {
      setSupportLoading(false);
    }
  }

  if (loading) return <div className="empty" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Cargando sistema...</div>;
  if (authError) return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="card page-pad" style={{ width: "min(560px,100%)" }}><h1>No se pudo abrir el sistema</h1><p className="alert alert-error">{authError}</p><button className="btn btn-secondary" onClick={() => router.replace("/")}>Volver al inicio</button></div></main>;
  if (!profile) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="MartoTech" style={{ display: "flex", justifyContent: "center", paddingBottom: 18 }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <img src="/logo.png" alt="MartoTech" width={140} height={140} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </div>
        </Link>
        <div className="nav">
          {links.map(([icon, label, href]) => (
            <Link key={href} className={pathname === href || pathname.startsWith(href.split("?")[0]) ? "active" : ""} href={href}>
              <span>{icon}</span> <span className="nav-label">{label}</span>
            </Link>
          ))}
          {profile.rol === "superadmin" && (
            <Link className={pathname.startsWith("/superadmin") ? "active" : ""} href="/superadmin">
              <span>🛡️</span> <span className="nav-label">SuperAdmin</span>
            </Link>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="card page-pad" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }} className="nav-label">{profile.nombre} {profile.apellido}</div>
            <div className="muted nav-label" style={{ fontSize: 12 }}>{profile.plan_nombre || "Plan pendiente"}</div>
          </div>
          <button className="nav" style={{ padding: 0 }} onClick={logout}><span style={{ padding: 10 }}>🚪 <span className="nav-label">Cerrar sesión</span></span></button>
        </div>
      </aside>
      <main className="main-area">
        <header className={scrolled ? "app-topbar scrolled" : "app-topbar"}>
          <div className="app-topbar-left">
            <button type="button" className="hamburger-btn" onClick={() => setDrawerOpen(o => !o)} aria-label={drawerOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={drawerOpen}>
              <span className="hamburger-line" /><span className="hamburger-line" /><span className="hamburger-line" />
            </button>
            <strong>Gestor de Stock</strong>
          </div>
          <div className="app-account-info">
            <span className="plan-pill" style={{ borderColor: activePlan?.accent }}>{activePlan?.name || profile.plan_nombre || "Plan a definir"}</span>
            {activePlan && <span className="muted plan-limit-text">{activePlan.products}</span>}
            <button type="button" className="profile-trigger" onClick={() => setProfileOpen(open => !open)} aria-label="Abrir perfil" aria-expanded={profileOpen} title="Perfil">
              <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" />
              </svg>
            </button>
          </div>
          {profileOpen && (
            <div className="profile-menu">
              <div className="profile-summary"><strong>{profile.nombre} {profile.apellido}</strong><span className="muted">{profile.correo}</span></div>
              <button type="button" onClick={() => { setPasswordOpen(true); setProfileOpen(false); setPasswordError(""); setPasswordSuccess(""); }}>🔒 Cambiar contraseña</button>
              <button type="button" onClick={toggleTheme}>{darkMode ? "☀️ Activar modo claro" : "🌙 Activar modo oscuro"}</button>
            </div>
          )}
        </header>
        <section className="content">{children}</section>
      </main>

      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}
      <aside className={`mobile-drawer ${drawerOpen ? "open" : ""}`} role="menu">
        <div className="drawer-brand">
          <img src="/logo.png" alt="MartoTech" width={48} height={48} style={{ objectFit: "contain", borderRadius: 10 }} />
          <span>Gestor de Stock</span>
        </div>
        <nav className="drawer-nav">
          {links.map(([icon, label, href]) => (
            <Link key={href} href={href} role="menuitem" className={pathname === href || pathname.startsWith(href.split("?")[0]) ? "active" : ""} onClick={() => setDrawerOpen(false)}>
              <span>{icon}</span><span>{label}</span>
            </Link>
          ))}
          {profile.rol === "superadmin" && (
            <Link href="/superadmin" role="menuitem" className={pathname.startsWith("/superadmin") ? "active" : ""} onClick={() => setDrawerOpen(false)}>
              <span>🛡️</span><span>SuperAdmin</span>
            </Link>
          )}
        </nav>
        <div className="drawer-footer">
          <div className="drawer-user">
            <div className="drawer-user-name">{profile.nombre} {profile.apellido}</div>
            <div className="muted" style={{ fontSize: 12 }}>{profile.plan_nombre || "Plan pendiente"}</div>
          </div>
          <button type="button" role="menuitem" className="drawer-logout" onClick={() => { setDrawerOpen(false); logout(); }}>🚪 Cerrar sesión</button>
        </div>
      </aside>

      <button
        type="button"
        className="support-fab"
        onClick={() => setSupportOpen(true)}
        aria-label="Abrir soporte"
        title="Soporte"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a8 8 0 0 1 16 0v2" />
          <path d="M4 13h2a2 2 0 0 1 2 2v2H5a1 1 0 0 1-1-1v-3Z" />
          <path d="M20 13h-2a2 2 0 0 0-2 2v2h3a1 1 0 0 0 1-1v-3Z" />
          <path d="M12 19h2" />
        </svg>
      </button>

      {supportOpen && (
        <div className="modal-backdrop" onClick={() => setSupportOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="page-header" style={{ alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Soporte</h2>
                <p className="muted" style={{ marginBottom: 0 }}>Abrí un ticket y te respondemos por correo.</p>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSupportOpen(false)}>Cerrar</button>
            </div>
            <form onSubmit={sendSupportTicket} style={{ display: "grid", gap: 14 }}>
              <div className="field">
                <label className="label">Asunto</label>
                <input className="input" name="subject" placeholder="Problema con ventas, login, plan..." />
              </div>
              <div className="field">
                <label className="label">Mensaje</label>
                <textarea className="textarea" name="message" placeholder="Contanos qué pasó y qué necesitás." />
              </div>
              {supportError && <div className="alert alert-error">{supportError}</div>}
              {supportSuccess && <div className="alert alert-success">{supportSuccess}</div>}
              <button className="btn btn-primary" disabled={supportLoading}>{supportLoading ? "Enviando…" : "Enviar ticket"}</button>
            </form>
          </div>
        </div>
      )}

      {passwordOpen && (
        <div className="modal-backdrop" onClick={() => setPasswordOpen(false)}>
          <div className="modal password-modal" onClick={e => e.stopPropagation()}>
            <div className="page-header" style={{ alignItems: "center", marginBottom: 16 }}>
              <div><h2 style={{ margin: 0 }}>Cambiar contraseña</h2><p className="muted" style={{ marginBottom: 0 }}>Elegí una contraseña nueva para tu cuenta.</p></div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPasswordOpen(false)}>Cerrar</button>
            </div>
            <form onSubmit={changePassword} className="password-form">
              <div className="field"><label className="label">Nueva contraseña</label><input className="input" name="password" type="password" minLength={6} required /></div>
              <div className="field"><label className="label">Repetir contraseña</label><input className="input" name="confirmation" type="password" minLength={6} required /></div>
              {passwordError && <div className="alert alert-error">{passwordError}</div>}
              {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}
              <button className="btn btn-primary" disabled={passwordLoading}>{passwordLoading ? "Actualizando…" : "Actualizar contraseña"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
