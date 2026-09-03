"use client";

import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import type { Product } from "../../types";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const columns: [keyof Product, string][] = [
  ["id", "ID"], ["nombre", "Nombre"], ["marca", "Marca"], ["categoria", "Categoría"], ["sabor", "Sabor"], ["cantidad", "Stock"], ["cantidad_minima", "Mín."], ["precio_costo", "P. Costo"], ["precio_venta", "P. Venta"], ["proveedor", "Proveedor"], ["fecha_ingreso", "Ingreso"], ["fecha_vencimiento", "Vencimiento"],
];
const initial: Partial<Product> = { unidad_medida: "Unidad", cantidad: 0, cantidad_minima: 0, precio_costo: 0, precio_venta: 0 };

export default function ProductosPage() {
  return <Suspense fallback={<AppShell><div className="card section-card">Cargando inventario...</div></AppShell>}><ProductosContent /></Suspense>;
}

function ProductosContent() {
  const params = useSearchParams(); const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]); const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof Product>("nombre"); const [asc, setAsc] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null); const [showForm, setShowForm] = useState(params.get("nuevo") === "1");
  const [error, setError] = useState("");

  async function load(query = q) {
    try { setProducts(await apiFetch<Product[]>(`/productos?q=${encodeURIComponent(query)}&sort=${String(sort)}&direction=${asc ? "asc" : "desc"}`)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el inventario."); }
  }
  useEffect(() => { const id = setTimeout(() => load(), 180); return () => clearTimeout(id); }, [q, sort, asc]);
  function order(col: keyof Product) { if (col === sort) setAsc(!asc); else { setSort(col); setAsc(true); } }
  function openNew() { setEditing(null); setShowForm(true); router.replace("/productos?nuevo=1"); }
  function openEdit(p: Product) { setEditing(p); setShowForm(true); router.replace("/productos"); }
  async function remove(p: Product) { if (!confirm(`Dar de baja "${p.nombre}"? El producto no se borrará físicamente.`)) return; await apiFetch(`/productos/${p.id}`, { method: "DELETE" }); load(); }

  return <AppShell>
    <div className="page-header"><div><h1>🔎 Inventario</h1><p className="muted">Búsqueda en tiempo real y ordenamiento por columna.</p></div><button className="btn btn-primary" onClick={openNew}>＋ Agregar producto</button></div>
    <div className="card section-card">
      <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Buscar por nombre, marca, categoría, código o proveedor…" />
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="card table-wrap"><table><thead><tr>{columns.map(([key, label]) => <th key={String(key)} onClick={() => order(key)}>{label}{sort === key ? (asc ? " ↑" : " ↓") : ""}</th>)}<th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {products.map(p => <tr key={p.id}>{columns.map(([key]) => <td key={String(key)}>{String(key).includes("precio") ? money(Number(p[key] ?? 0)) : String(p[key] ?? "—")}</td>)}<td><span className={`status ${Number(p.cantidad) === 0 ? "status-zero" : Number(p.cantidad) <= Number(p.cantidad_minima) ? "status-low" : "status-ok"}`}>{Number(p.cantidad) === 0 ? "Sin stock" : Number(p.cantidad) <= Number(p.cantidad_minima) ? "Stock bajo" : "Normal"}</span></td><td><div className="actions"><button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Editar</button><button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Dar de baja</button></div></td></tr>)}
      {!products.length && <tr><td colSpan={15}><div className="empty">No hay productos para mostrar.</div></td></tr>}
    </tbody></table></div>
    <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Total: {products.length} productos en la búsqueda.</div>
    {showForm && <ProductModal product={editing} onClose={() => { setShowForm(false); router.replace("/productos"); }} onSaved={() => { setShowForm(false); router.replace("/productos"); load(); }} />}
  </AppShell>;
}

function ProductModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, unknown>>(product ? { ...product } : { ...initial }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  async function save(e: React.FormEvent) { e.preventDefault(); setError(""); setSaving(true); try { await apiFetch(product ? `/productos/${product.id}` : "/productos", { method: product ? "PUT" : "POST", body: JSON.stringify(form) }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setSaving(false); } }
  const field = (key: string, label: string, type = "text") => <div className="field"><label className="label">{label}{["nombre", "cantidad"].includes(key) ? " *" : ""}</label><input className="input" type={type} value={String(form[key] ?? "")} onChange={e => set(key, e.target.value)} /></div>;
  return <div className="modal-backdrop"><div className="modal"><div className="page-header"><div><h2 style={{ margin: 0 }}>{product ? "✏️ Editar producto" : "➕ Agregar producto"}</h2><p className="muted">Completa los datos del producto.</p></div><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
    <form onSubmit={save}>
      <div className="card section-card"><h3 className="section-title">📦 Identificación</h3><div className="form-grid">{field("nombre", "Nombre")}{field("codigo_barras", "Código de barras / SKU")}{field("marca", "Marca")}{field("categoria", "Categoría")}{field("sabor", "Sabor / Variante")}{field("unidad_medida", "Unidad de medida")}</div></div>
      <div className="card section-card"><h3 className="section-title">📊 Stock</h3><div className="form-grid">{field("cantidad", "Cantidad disponible", "number")}{field("cantidad_minima", "Stock mínimo", "number")}{field("ubicacion", "Ubicación en depósito")}</div></div>
      <div className="card section-card"><h3 className="section-title">💰 Precios</h3><div className="form-grid">{field("precio_costo", "Precio de costo ($)", "number")}{field("precio_venta", "Precio de venta ($)", "number")}</div></div>
      <div className="card section-card"><h3 className="section-title">🚚 Proveedor</h3><div className="form-grid">{field("proveedor", "Proveedor")}</div></div>
      <div className="card section-card"><h3 className="section-title">🗓️ Fechas</h3><div className="form-grid">{field("fecha_ingreso", "Fecha de ingreso (DD/MM/AAAA)")}{field("fecha_vencimiento", "Fecha de vencimiento (DD/MM/AAAA)")}</div></div>
      <div className="card section-card"><h3 className="section-title">📝 Observaciones</h3><textarea className="textarea" value={String(form.descripcion ?? "")} onChange={e => set("descripcion", e.target.value)} /></div>
      {error && <div className="alert alert-error">{error}</div>}<div className="actions"><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando…" : "💾 Guardar producto"}</button><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button></div>
    </form>
  </div></div>;
}
function money(value: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(Number(value)); }
