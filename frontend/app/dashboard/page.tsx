"use client";

import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import type { Dashboard } from "../../types";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { apiFetch<Dashboard>("/dashboard").then(setData).catch((e) => setError(e.message)); }, []);

  return <AppShell><div className="page-header"><div><h1>📊 Dashboard</h1><p className="muted">Resumen general del inventario y las ventas.</p></div><Link href="/productos?nuevo=1" className="btn btn-primary">＋ Agregar producto</Link></div>
    {error && <div className="alert alert-error">{error}</div>}
    {!data ? <div className="empty">Cargando métricas…</div> : <>
      <div className="grid-4">
        <Metric icon="📦" title="Total productos" value={data.stock.total_productos} />
        <Metric icon="⚠️" title="Sin stock" value={data.stock.sin_stock} danger />
        <Metric icon="📉" title="Stock bajo" value={data.stock.stock_bajo} warning />
        <Metric icon="💵" title="Valor inventario" value={money(data.stock.valor_inventario)} success />
      </div>
      <div style={{ height: 14 }} />
      <div className="grid-4">
        <Metric icon="🛒" title="Ventas hoy" value={data.ventas.ventas_hoy} purple />
        <Metric icon="💳" title="Total hoy" value={money(data.ventas.total_hoy)} success />
        <Metric icon="📈" title="Histórico vendido" value={money(data.ventas.historico_vendido)} warning />
        <Metric icon="🏷️" title="Categorías" value={data.categorias} />
      </div>
      <div className="card section-card" style={{ marginTop: 16 }}><div className="muted">Unidades en stock</div><div style={{ fontSize: 27, fontWeight: 800 }}>{data.stock.unidades}</div><div className="muted" style={{ marginTop: 12 }}>Unidades vendidas históricas: <strong style={{ color: "var(--text)" }}>{data.ventas.unidades_vendidas}</strong></div></div>
      <div className="card section-card best-seller" style={{ marginTop: 16 }}><span className="best-seller-icon" style={{ fontSize: 25 }}>🏆</span><span className="muted">Producto más vendido (histórico):</span><strong>{data.producto_mas_vendido || "—"}</strong></div>
    </>}
  </AppShell>;
}
function Metric({ icon, title, value, danger, warning, success, purple }: { icon: string; title: string; value: string|number; danger?: boolean; warning?: boolean; success?: boolean; purple?: boolean }) {
  const color = danger ? "var(--danger)" : warning ? "var(--warning)" : success ? "var(--success)" : purple ? "var(--accent-2)" : "var(--accent)";
  return <div className="card metric"><div className="icon" style={{ color }}>{icon}</div><div className="value" style={{ color }}>{value}</div><div className="muted">{title}</div></div>;
}
function money(value: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value); }
