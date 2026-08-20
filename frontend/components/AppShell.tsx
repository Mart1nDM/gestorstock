"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  if (loading) return <div className="empty" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Cargando sistema...</div>;
  if (authError) return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="card page-pad" style={{ width: "min(560px,100%)" }}><h1>No se pudo abrir el sistema</h1><p className="alert alert-error">{authError}</p><button className="btn btn-secondary" onClick={() => router.replace("/login")}>Volver al login</button></div></main>;
  if (!profile) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="MartoTech" style={{ display: "flex", justifyContent: "center", paddingBottom: 18 }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <Image src="/logo.png" alt="MartoTech" fill sizes="140px" priority style={{ objectFit: "contain" }} />
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
    </div>
  );
}

