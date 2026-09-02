"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { PlanInfo } from "../../types";
import { PLAN_CATALOG } from "../../lib/plan-catalog";
import PaymentFormModal from "../../components/PaymentFormModal";

function chooseHref(planKey: string) {
  return `/?plan=${planKey}#contacto`;
}

function formatLimite(value: number | null): string {
  if (value === null) return "Ilimitados";
  if (value === 1) return "1 cuenta";
  return `Hasta ${value}`;
}

export default function PlansPage() {
  const [planes, setPlanes] = useState<PlanInfo[]>(PLAN_CATALOG);
  const [paidPlan, setPaidPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    apiFetch<{ planes: PlanInfo[] }>("/planes")
      .then((data) => { if (data.planes?.length) setPlanes(data.planes); })
      .catch(() => { /* si la API no responde, mostramos el catálogo local */ });
  }, []);

  const esPagado = (key: string) => key === "premium" || key === "pro";

  return (
    <main>
      {paidPlan && (
        <PaymentFormModal
          planKey={paidPlan.key}
          planNombre={paidPlan.nombre}
          precioMensual={paidPlan.precio_mensual}
          onClose={() => setPaidPlan(null)}
        />
      )}
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand"><img src="/logo.png" alt="MartoTech" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8, verticalAlign: "middle", marginRight: 10 }} /> GESTOR ONLINE</Link>
          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link className="btn btn-ghost" href="/">Inicio</Link>
            <Link className="btn btn-primary" href="/#contacto">Solicitar una cuenta</Link>
          </nav>
        </div>
      </header>

      <section className="plans-hero">
        <div className="container">
          <div className="badge">📋 Comparación de planes</div>
          <h1 className="hero-title" style={{ maxWidth: 760 }}>Elegí el plan que acompaña el ritmo de tu negocio.</h1>
          <p className="hero-copy" style={{ maxWidth: 760 }}>
            Empezá gratis, subí a Premium cuando necesites más capacidad y pasá a Pro si querés análisis, reportes y soporte más cercano.
          </p>
        </div>
      </section>

      <section className="plans-section">
        <div className="container">
          <div className="plans-grid">
            {planes.map((plan) => (
                <article
                  key={plan.key}
                  className={`card plan-card ${plan.destacado ? "featured" : ""}`}
                  style={{ borderTopColor: plan.accent }}
                >
                  {plan.destacado && <div className="plan-tag">Más elegido</div>}
                  <div className="plan-head">
                    <div>
                      <h2>{plan.nombre}</h2>
                      <p className="muted">{plan.subtitle}</p>
                    </div>
                    <div className="plan-price" style={{ color: plan.accent }}>{plan.precio}</div>
                  </div>
                  <div className="plan-limit">{plan.products}</div>

                  <div className="plan-detail">
                    <div className="plan-detail-row"><span>Productos</span><strong>{formatLimite(plan.limites.productos)}</strong></div>
                    <div className="plan-detail-row"><span>Usuarios</span><strong>{typeof plan.limites.usuarios === "number" ? formatLimite(plan.limites.usuarios) : plan.limites.usuarios}</strong></div>
                    <div className="plan-detail-row"><span>Historial de ventas</span><strong>{plan.limites.historial_ventas}</strong></div>
                    <div className="plan-detail-row"><span>Metas de ventas</span><strong>{plan.metas_ventas ? "Sí" : "No"}</strong></div>
                  </div>

                  <div className="plan-block">
                    <div className="plan-block-title">🛟 Soporte</div>
                    <div className="plan-detail-row"><span>Nivel</span><strong>{plan.soporte.nivel}</strong></div>
                    <div className="plan-detail-row"><span>Prioridad</span><strong>{plan.soporte.prioridad}</strong></div>
                    <div className="plan-detail-row"><span>Respuesta</span><strong>{plan.soporte.tiempo}</strong></div>
                    <div className="plan-detail-row"><span>Canales</span><strong>{plan.soporte.canal.join(" · ")}</strong></div>
                    <div className="plan-detail-row"><span>Atención</span><strong>{plan.soporte.personalizado ? "Personalizada" : "Estandarizada"}</strong></div>
                  </div>

                  <div className="plan-block">
                    <div className="plan-block-title">📊 Métricas y gráficas</div>
                    <ul className="plan-list">
                      {plan.graficas.map(item => <li key={item}>✓ {item}</li>)}
                    </ul>
                    <div className="plan-block-title" style={{ marginTop: 10 }}>📑 Reportes</div>
                    <ul className="plan-list">
                      {plan.reportes.map(item => <li key={item}>✓ {item}</li>)}
                    </ul>
                  </div>

                  <div className="plan-footer">
                    {esPagado(plan.key) ? (
                      <button className="btn btn-primary" type="button" onClick={() => setPaidPlan(plan)}>
                        Pagar {plan.nombre}
                      </button>
                    ) : (
                      <Link className="btn btn-primary" href={chooseHref(plan.key)}>
                        Solicitar gratis
                      </Link>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
      </section>

      <section className="plans-section plans-compare-band">
        <div className="container">
          <div className="page-header">
            <div>
              <h2 style={{ margin: 0 }}>Comparación lado a lado</h2>
              <p className="muted">Una vista rápida para ver qué desbloquea cada escalón.</p>
            </div>
          </div>
          <div className="table-wrap plans-table-wrap">
            <table className="plans-table">
              <thead>
                <tr>
                  <th>Característica</th>
                  {planes.map(plan => <th key={plan.key}>{plan.nombre}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr><td>Precio</td>{planes.map(p => <td key={p.key}>{p.precio}</td>)}</tr>
                <tr><td>Productos</td>{planes.map(p => <td key={p.key}>{formatLimite(p.limites.productos)}</td>)}</tr>
                <tr><td>Usuarios</td>{planes.map(p => <td key={p.key}>{typeof p.limites.usuarios === "number" ? formatLimite(p.limites.usuarios) : p.limites.usuarios}</td>)}</tr>
                <tr><td>Historial de ventas</td>{planes.map(p => <td key={p.key}>{p.limites.historial_ventas}</td>)}</tr>
                <tr><td>Metas de ventas</td>{planes.map(p => <td key={p.key}>{p.metas_ventas ? "Sí" : "No"}</td>)}</tr>
                <tr><td>Gráficas</td>{planes.map(p => <td key={p.key}>{p.graficas.join(", ")}</td>)}</tr>
                <tr><td>Reportes</td>{planes.map(p => <td key={p.key}>{p.reportes.join(", ")}</td>)}</tr>
                <tr><td>Nivel de soporte</td>{planes.map(p => <td key={p.key}>{p.soporte.nivel} ({p.soporte.prioridad})</td>)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="plans-section">
        <div className="container">
          <div className="card page-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>¿Ya tenés claro cuál te sirve?</h2>
              <p className="muted" style={{ marginBottom: 0 }}>Al tocar elegir plan, te llevo al formulario con ese plan ya cargado.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {planes.map(plan => (
                esPagado(plan.key) ? (
                  <button key={plan.key} className="btn btn-secondary" type="button" onClick={() => setPaidPlan(plan)}>
                    Pagar {plan.nombre}
                  </button>
                ) : (
                  <Link key={plan.key} className="btn btn-secondary" href={chooseHref(plan.key)}>
                    Elegir {plan.nombre}
                  </Link>
                )
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
