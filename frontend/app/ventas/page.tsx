"use client";

import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import type { Product, Sale } from "../../types";
import { useEffect, useState } from "react";

export default function VentasPage() {
  const [q,setQ]=useState(""); const [products,setProducts]=useState<Product[]>([]); const [selected,setSelected]=useState<Product|null>(null); const [cantidad,setCantidad]=useState("1"); const [precio,setPrecio]=useState(""); const [sales,setSales]=useState<Sale[]>([]); const [error,setError]=useState(""); const [saving,setSaving]=useState(false);
  useEffect(()=>{ const id=setTimeout(()=>{ if(!q.trim()){setProducts([]);return;} apiFetch<Product[]>(`/productos?q=${encodeURIComponent(q)}&sort=nombre&direction=asc`).then(setProducts).catch(e=>setError(e.message)); },180); return()=>clearTimeout(id); },[q]);
  async function loadSales(){ try{ setSales(await apiFetch<Sale[]>("/ventas?today=true")); }catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el historial.");} }
  useEffect(()=>{loadSales();},[]);
  function select(p:Product){setSelected(p);setPrecio(String(p.precio_venta));setProducts([]);setQ(p.nombre);}
  async function sell(){ setError(""); if(!selected)return setError("Primero seleccioná un producto."); const qty=Number(cantidad); const unit=Number(precio||0); if(!Number.isInteger(qty)||qty<=0)return setError("La cantidad debe ser un entero mayor a 0."); if(qty>selected.cantidad)return setError(`Stock insuficiente. Hay ${selected.cantidad} unidades.`); setSaving(true); try{ await apiFetch("/ventas",{method:"POST",body:JSON.stringify({producto_id:selected.id,cantidad:qty,precio_venta:unit})}); setSelected(null);setQ("");setCantidad("1");setPrecio("");await loadSales(); }catch(e){setError(e instanceof Error?e.message:"No se pudo registrar la venta.");}finally{setSaving(false);} }
  const total=Number(cantidad||0)*Number(precio||0); const todayTotal=sales.reduce((a,s)=>a+s.total,0);
  return <AppShell><div className="page-header"><div><h1>🛒 Ventas</h1><p className="muted">Registrá una venta y el sistema descontará el stock automáticamente.</p></div></div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="grid-2">
      <div className="card section-card"><h3 className="section-title">🔎 Buscar producto</h3><input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Escribí el nombre del producto…" />
        {products.length>0&&<div className="card" style={{marginTop:10,maxHeight:250,overflow:"auto"}}>{products.slice(0,8).map(p=><button key={p.id} onClick={()=>select(p)} style={{display:"block",width:"100%",border:0,borderBottom:"1px solid var(--border)",background:"transparent",color:"var(--text)",padding:12,textAlign:"left"}}><strong>{p.nombre}</strong><span className="muted"> · Stock: {p.cantidad} · ${p.precio_venta.toLocaleString("es-AR")}</span></button>)}</div>}
        {selected&&<div className="card" style={{marginTop:14,padding:14}}><div className="muted">Producto seleccionado</div><h3 style={{margin:"6px 0"}}>{selected.nombre}</h3><div className="muted">{selected.categoria||"Sin categoría"} · Stock actual: <strong style={{color:selected.cantidad===0?"var(--danger)":"var(--success)"}}>{selected.cantidad}</strong></div></div>}
      </div>
      <div className="card section-card"><h3 className="section-title">💳 Registrar venta</h3><div className="form-grid"><div className="field"><label className="label">Cantidad *</label><input className="input" type="number" min="1" value={cantidad} onChange={e=>setCantidad(e.target.value)} /></div><div className="field"><label className="label">Precio unitario ($)</label><input className="input" type="number" min="0" step="0.01" value={precio} onChange={e=>setPrecio(e.target.value)} /></div></div><div style={{marginTop:16,fontSize:28,fontWeight:800,color:"var(--success)"}}>{money(total)}</div><button className="btn btn-success" style={{marginTop:14}} disabled={saving} onClick={sell}>✅ Confirmar venta</button></div>
    </div>
    <div className="card section-card" style={{marginTop:16}}><div className="page-header" style={{marginBottom:12}}><div><h3 style={{margin:0}}>📋 Ventas de hoy</h3><div className="muted" style={{fontSize:13}}>Total vendido hoy: <strong style={{color:"var(--text)"}}>{money(todayTotal)}</strong> · Transacciones: {sales.length}</div></div></div>
      <div className="table-wrap"><table style={{minWidth:700}}><thead><tr><th>Hora</th><th>Producto</th><th>Cantidad</th><th>Precio unit.</th><th>Total</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{new Date(s.fecha).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</td><td>{s.nombre}</td><td>{s.cantidad}</td><td>{money(s.precio_venta)}</td><td>{money(s.total)}</td></tr>)}{!sales.length&&<tr><td colSpan={5}><div className="empty">No hay ventas registradas hoy.</div></td></tr>}</tbody></table></div>
    </div>
  </AppShell>;
}
function money(v:number){return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2}).format(v)}
