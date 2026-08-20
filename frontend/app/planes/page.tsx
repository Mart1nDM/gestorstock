import Link from "next/link";

import { PLANS } from "../../lib/plan-data";

const rows = [
  { label: "Productos", values: ["Hasta 10", "Hasta 100", "Ilimitados"] },
  { label: "Precio", values: ["$0/mes", "$5,99/mes", "$10,99/mes"] },
  { label: "Métricas", values: ["Básicas", "Más métricas y gráficos", "Métricas y análisis avanzados"] },
  { label: "Gráficos", values: ["No", "Sí", "Sí, con análisis"] },
  { label: "Reportes de ventas", values: ["No", "No", "Sí"] },
  { label: "Soporte personalizado", values: ["No", "No", "Sí"] },
];

function chooseHref(planKey: string) {
  return `/?plan=${planKey}#contacto`;
}

export default function PlansPage() {
  return (
    <main>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand"><span>●</span> MartoTech</Link>
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
            {PLANS.map((plan, index) => (
              <article
                key={plan.key}
                className={`card plan-card ${index === 1 ? "featured" : ""}`}
                style={{ borderTopColor: plan.accent }}
              >
                {index === 1 && <div className="plan-tag">Más elegido</div>}
                <div className="plan-head">
                  <div>
                    <h2>{plan.name}</h2>
                    <p className="muted">{plan.subtitle}</p>
                  </div>
                  <div className="plan-price" style={{ color: plan.accent }}>{plan.price}</div>
                </div>
                <div className="plan-limit">{plan.products}</div>
                <ul className="plan-list">
                  {plan.highlights.map(item => <li key={item}>✓ {item}</li>)}
                </ul>
                <div className="plan-footer">
                  <Link className="btn btn-primary" href={chooseHref(plan.key)}>Elegir plan</Link>
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
                  {PLANS.map(plan => <th key={plan.key}>{plan.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {row.values.map(value => <td key={value}>{value}</td>)}
                  </tr>
                ))}
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
              {PLANS.map(plan => (
                <Link key={plan.key} className="btn btn-secondary" href={chooseHref(plan.key)}>
                  Elegir {plan.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
