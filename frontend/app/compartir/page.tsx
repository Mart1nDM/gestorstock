"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";

type Compartido = {
  id: number;
  miembro_id: string;
  token: string;
  estado: string;
  created_at: string;
  correo: string | null;
  nombre: string | null;
};

type CompartirResp = { compartidos: Compartido[]; max_miembros: number; es_pro: boolean };
type InventarioCompartido = {
  owner_id: string;
  owner_correo: string;
  owner_nombre: string;
  productos: { id: number; nombre: string; unidad_medida: string | null; cantidad: number; cantidad_minima: number; precio_venta: number }[];
};
type InventariosResp = { inventarios: InventarioCompartido[] };

function CompartirContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [esPro, setEsPro] = useState(false);
  const [compartidos, setCompartidos] = useState<Compartido[]>([]);
  const [inventarios, setInventarios] = useState<InventarioCompartido[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function reload() {
    try {
      const [c, inv] = await Promise.all([
        apiFetch<CompartirResp>("/compartir").catch(() => null),
        apiFetch<InventariosResp>("/compartir/inventario").catch(() => ({ inventarios: [] as InventarioCompartido[] })),
      ]);
      if (c) {
        setEsPro(c.es_pro);
        setCompartidos(c.compartidos);
      }
      setInventarios(inv?.inventarios ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo cargar la compartición.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
      if (token) {
        try {
          await apiFetch("/compartir/aceptar", { method: "POST", body: JSON.stringify({ token }) });
          setMsg("Inventario compartido vinculado correctamente.");
          router.replace("/compartir");
          await reload();
        } catch (e) {
          setErr(e instanceof Error ? e.message : "No se pudo vincular el inventario.");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function generarLink() {
    setGenerating(true);
    setErr("");
    setCopied(false);
    setMsg("");
    try {
      const res = await apiFetch<{ ok: boolean; link: string }>("/compartir/link", { method: "POST" });
      if (!res.ok || !res.link) throw new Error("No se pudo generar el link.");
      await copyLink(res.link);
      setMsg("Link de invitación generado y copiado. Compartilo con hasta 5 personas.");
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo generar el link.");
    } finally {
      setGenerating(false);
    }
  }

  const copyLink = useCallback(async (link: string) => {
    await copyToClipboard(link);
  }, []);

  async function copyToClipboard(text: string) {
    if (navigator.share && window.innerWidth <= 900) {
      try {
        await navigator.share({ title: "Invitación a inventario", text, url: text });
        setMsg("Invitación compartida.");
        return;
      } catch {
        // fallback a clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setMsg("No se pudo copiar el link automáticamente. Copialo manualmente.");
    }
  }

  async function revocar(id: number) {
    if (!confirm("¿Revocar el acceso de esta persona a tu inventario?")) return;
    try {
      await apiFetch(`/compartir/${id}/revocar`, { method: "POST" });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo revocar.");
    }
  }

  if (loading) return <div className="empty">Cargando compartición…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>🔗 Inventario compartido</h1>
          <p className="muted">Compartí tu inventario con tu equipo (solo plan Pro).</p>
        </div>
      </div>

      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}
      {copied && <div className="alert alert-success">¡Link copiado al portapapeles!</div>}

      {esPro ? (
        <div className="card section-card">
          <div className="section-title">Mi inventario (Soy el dueño)</div>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Generá un enlace para que otros encargados entren con el mismo inventario (hasta {5} personas). Cada persona puede ser de cualquier plan.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <button className="btn btn-primary" onClick={generarLink} disabled={generating}>
              {generating ? "Generando…" : "＋ Generar link de invitación"}
            </button>
          </div>

          {compartidos.length > 0 && (
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="plans-table" style={{ minWidth: 0 }}>
                <thead><tr><th>Persona</th><th>Correo</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {compartidos.map(c => (
                    <tr key={c.id}>
                      <td>{c.nombre || "Pendiente"}</td>
                      <td>{c.correo || "—"}</td>
                      <td><span className={`status ${c.estado === "activo" ? "status-ok" : c.estado === "pendiente" ? "status-low" : "status-zero"}`}>{c.estado}</span></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => revocar(c.id)}>Revocar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card section-card">
          <div className="alert alert-error" style={{ marginBottom: 0 }}>
            La compartición de inventario es una función del plan <strong>Pro</strong>. <a href="/planes" style={{ color: "var(--accent)" }}>Ver planes</a>
          </div>
        </div>
      )}

      <div className="card section-card" style={{ marginTop: 14 }}>
        <div className="section-title">Inventarios que me compartieron</div>
        {inventarios.length === 0 ? (
          <p className="muted">Todavía no te compartieron ningún inventario.</p>
        ) : (
          inventarios.map(inv => (
            <div key={inv.owner_id} className="card page-pad" style={{ marginBottom: 12 }}>
              <div><strong>{inv.owner_nombre}</strong> <span className="muted">({inv.owner_correo})</span></div>
              <div className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>{inv.productos.length} productos</div>
              <div className="table-wrap" style={{ overflowX: "auto" }}>
                <table className="plans-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>Producto</th><th>Unidad</th><th>Stock</th><th>P. venta</th></tr></thead>
                  <tbody>
                    {inv.productos.slice(0, 50).map(p => (
                      <tr key={`${inv.owner_id}-${p.id}`}>
                        <td>{p.nombre}</td>
                        <td>{p.unidad_medida || "—"}</td>
                        <td><span className={`status ${Number(p.cantidad) === 0 ? "status-zero" : Number(p.cantidad) <= Number(p.cantidad_minima) ? "status-low" : "status-ok"}`}>{p.cantidad}</span></td>
                        <td>{money(p.precio_venta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(Number(v || 0));
}

export default function CompartirPage() {
  return (
    <Suspense fallback={<AppShell><div className="card section-card">Cargando…</div></AppShell>}>
      <AppShell><CompartirContent /></AppShell>
    </Suspense>
  );
}
