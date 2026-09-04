"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { apiFetch } from "../lib/api";
import TurnstileWidget from "./TurnstileWidget";
import type { Dashboard, MetaData, PlanInfo } from "../types";

const PIE_COLORS = ["#4F8EF7", "#7C3AED", "#22C55E", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#8B5CF6"];

const LEVEL: Record<string, number> = { gratis: 0, premium: 1, pro: 2 };

const PLAN_SCOPES: Record<string, number> = {
  graficas: 2,          // todas las gráficas detalladas -> Pro
  torta_categoria: 1,   // Premium+
  metas_ventas: 1,      // Premium+
  historial_metas: 2,   // Pro
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function fmt(v: unknown): string {
  const num = Array.isArray(v) ? Number(v[0] ?? 0) : Number(v ?? 0);
  return money(Number.isFinite(num) ? num : 0);
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function PieDonut({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      {data.length === 0 ? <p className="muted">Sin datos todavía.</p> : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={fmt as any} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function MetricsSection() {
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [error, setError] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalMsg, setGoalMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriodo, setReportPeriodo] = useState("mensual");
  const [reportToken, setReportToken] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch<{ plan: PlanInfo }>("/planes/me"),
      apiFetch<Dashboard>("/dashboard"),
      apiFetch<MetaData>("/metas"),
    ])
      .then(([p, d, m]) => {
        setPlan(p.plan);
        setData(d);
        setMeta(m);
        setGoalInput(m.meta_actual > 0 ? String(m.meta_actual) : "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar las métricas."));
  }, []);

  async function saveGoal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = parseFloat(goalInput);
    if (isNaN(value) || value < 0) return setGoalMsg("Ingresá una meta válida.");
    setSavingGoal(true);
    setGoalMsg("");
    try {
      await apiFetch<{ meta: number }>("/metas", { method: "PUT", body: JSON.stringify({ meta: value }) });
      const fresh = await apiFetch<MetaData>("/metas");
      setMeta(fresh);
      setGoalMsg("Meta guardada.");
    } catch (err) {
      setGoalMsg(err instanceof Error ? err.message : "No se pudo guardar la meta.");
    } finally {
      setSavingGoal(false);
    }
  }

  async function downloadReport() {
    if (!reportToken || !plan || plan.key !== "pro") return;
    setReportError("");
    setReportLoading(true);
    try {
      const res = await fetch("/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: reportPeriodo, cf_turnstile_response: reportToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || "No se pudo generar el reporte.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_${reportPeriodo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setReportOpen(false);
      setReportToken(null);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "No se pudo generar el reporte.");
    } finally {
      setReportLoading(false);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!plan || !data || !meta) return <div className="empty">Cargando métricas…</div>;

  const nivel = LEVEL[plan.key] ?? 0;
  const graficasSecas = data.graficas ?? {
    ventas_por_dia: [], ventas_por_categoria: [], unidades_por_categoria: [],
    stock_por_categoria: [], valor_por_categoria: [], composicion_stock: [],
  };
  const progresoVal = meta.progreso ?? 0;
  const metaLabel = meta.progreso === null ? "Sin meta configurada" : `Progreso: ${meta.progreso}%`;
  const metaColor = meta.progreso === null ? "var(--muted)" : progresoVal >= 100 ? "var(--success)" : progresoVal >= 50 ? "var(--accent)" : "var(--warning)";

  return (
    <div className="metrics-section">
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0 }}>📈 Métricas y gráficas</h2>
          <p className="muted" style={{ marginBottom: 0 }}>Plan <strong style={{ color: "var(--text)" }}>{plan.nombre}</strong> — visualizás {totalCharts(nivel)} secciones.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="card chart-card chart-card-span-2">
          <h3>Ventas de los últimos 14 días</h3>
          {graficasSecas.ventas_por_dia.length === 0 ? <p className="muted">Sin ventas todavía.</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={graficasSecas.ventas_por_dia} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="dia" stroke="var(--muted)" fontSize={12} />
                <YAxis stroke="var(--muted)" fontSize={12} />
                <Tooltip formatter={fmt as any} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
                <Area type="monotone" dataKey="total" name="Ventas" stroke="var(--accent)" fill="rgba(79,142,247,.25)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {nivel >= PLAN_SCOPES.torta_categoria && (
          <PieDonut title="Ventas por categoría 💰" data={graficasSecas.ventas_por_categoria} />
        )}

        <div className="card chart-card">
          <h3>Composición de stock 📦</h3>
          {graficasSecas.composicion_stock.length === 0 ? <p className="muted">Sin datos.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={graficasSecas.composicion_stock} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="name" stroke="var(--muted)" fontSize={12} />
                <YAxis stroke="var(--muted)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
                <Bar dataKey="value" name="Unidades">
                  {(graficasSecas.composicion_stock).map((entry, i) => {
                    const color = entry.name === "Sin stock" ? "var(--danger)" : entry.name === "Stock bajo" ? "var(--warning)" : "var(--success)";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {nivel >= PLAN_SCOPES.graficas && (
          <>
            <PieDonut title="Valor de inventario por categoría 💎" data={graficasSecas.valor_por_categoria} />
            <PieDonut title="Unidades vendidas por categoría 🛒" data={graficasSecas.unidades_por_categoria} />
          </>
        )}
      </div>

      {nivel >= PLAN_SCOPES.metas_ventas && (
        <div className="card section-card">
          <div className="section-title">🎯 Meta de ventas de {meta.periodo}</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="goal-summary">
              <div><span className="muted">Meta</span><strong>{money(meta.meta_actual)}</strong></div>
              <div><span className="muted">Vendido</span><strong>{money(meta.total_periodo)}</strong></div>
              <div><span className="muted">Falta</span><strong>{money(Math.max(0, meta.meta_actual - meta.total_periodo))}</strong></div>
            </div>
            <ProgressBar value={progresoVal} color={metaColor} />
            <div className="muted" style={{ fontSize: 13 }}>{metaLabel}</div>

            <form onSubmit={saveGoal} style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label className="label">Meta mensual (ARS)</label>
                <input className="input" type="number" min="0" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Ej: 200000" />
              </div>
              <button className="btn btn-primary" disabled={savingGoal}>{savingGoal ? "Guardando…" : "Guardar meta"}</button>
            </form>
            {goalMsg && <div className="muted" style={{ fontSize: 13 }}>{goalMsg}</div>}

            {nivel >= PLAN_SCOPES.historial_metas && meta.historial.length > 1 && (
              <div>
                <div className="section-title" style={{ marginTop: 14 }}>Historial de metas</div>
                <div className="table-wrap" style={{ overflowX: "auto" }}>
                  <table className="plans-table" style={{ minWidth: 0 }}>
                    <thead><tr><th>Período</th><th>Meta</th></tr></thead>
                    <tbody>
                      {meta.historial.slice(0, 12).map(h => <tr key={h.periodo}><td>{h.periodo}</td><td>{money(h.meta)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {plan.key === "pro" && (
        <div className="card section-card report-card">
          <div className="section-title">📄 Reporte PDF</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div className="muted" style={{ maxWidth: 420, fontSize: 13 }}>
              Descargá un resumen de tu inventario y ventas en formato PDF. Elegí el período y verificá que no sos un robot.
            </div>
            <button type="button" className="btn btn-report" onClick={() => { setReportPeriodo("mensual"); setReportToken(null); setReportError(""); setReportOpen(true); }}>
              ⬇️ Descargar reporte PDF
            </button>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="modal-backdrop" onClick={() => { if (!reportLoading) setReportOpen(false); }}>
          <div className="modal confirm-send-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="page-header" style={{ alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Descargar reporte PDF</h2>
                <p className="muted" style={{ marginBottom: 0 }}>Elegí el período y completá la verificación de seguridad.</p>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" disabled={reportLoading} onClick={() => setReportOpen(false)}>Cerrar</button>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div className="field">
                <label className="label">Período</label>
                <select className="select" value={reportPeriodo} onChange={e => { setReportPeriodo(e.target.value); setReportToken(null); setReportError(""); }}>
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <TurnstileWidget onToken={setReportToken} />
              {reportError && <div className="alert alert-error">{reportError}</div>}
              <button className="btn btn-report" disabled={!reportToken || reportLoading} style={{ width: "100%" }} onClick={downloadReport}>
                {reportLoading ? "Generando…" : reportToken ? "Descargar PDF" : "Resolvé la verificación…"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function totalCharts(nivel: number): number {
  let charts = 2; // ventas 14 días + composición stock
  if (nivel >= 1) charts += 2; // torta categoría + meta
  if (nivel >= 2) charts += 2; // valor + unidades
  return charts;
}