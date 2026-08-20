"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ApiError, apiFetch } from "../lib/api";
import type { Profile } from "../types";

const links = [
  ["📊", "Dashboard", "/dashboard"],
  ["➕", "Agregar Producto", "/productos?nuevo=1"],
  ["🔎", "Inventario", "/productos"],
  ["🛒", "Ventas", "/ventas"],
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportSuccess, setSupportSuccess] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await apiFetch<Profile>("/auth/me");
        if (alive) setProfile(me);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await supabase.auth.signOut();
          router.replace("/login");
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

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
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
  if (authError) return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="card page-pad" style={{ width: "min(560px,100%)" }}><h1>No se pudo abrir el sistema</h1><p className="alert alert-error">{authError}</p><button className="btn btn-secondary" onClick={() => router.replace("/login")}>Volver al login</button></div></main>;
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
        <header className="app-topbar">
          <div><strong>Gestor de Stock</strong></div>
          <div className="muted" style={{ fontSize: 13 }}>{profile.correo}</div>
        </header>
        <section className="content">{children}</section>
      </main>

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
    </div>
  );
}
