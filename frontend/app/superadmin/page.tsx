"use client";

import { useEffect, useState } from "react";

import AppShell from "../../components/AppShell";
import { apiFetch } from "../../lib/api";
import type { Profile } from "../../types";
import { PLANS } from "../../lib/plan-data";

type ContactRequest = {
  id: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  plan: string | null;
  mensaje: string;
  estado: string;
  creado_en: string;
};

type AccountInvitation = {
  id: number;
  request_id: number | null;
  profile_id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  plan: string | null;
  invite_url: string;
  estado: "pendiente" | "completada";
  created_at: string;
  consumed_at: string | null;
};

type AdminUser = Profile & { created_at: string; plan_nombre?: string | null; invite_pendiente?: boolean };

type PanelData = {
  usuarios: AdminUser[];
  solicitudes: ContactRequest[];
  contactos?: ContactRequest[];
  cuentas: AccountInvitation[];
  planes?: { id: string; nombre: string }[];
};

export default function SuperAdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [invitations, setInvitations] = useState<AccountInvitation[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [temporaryPasswordUserId, setTemporaryPasswordUserId] = useState<string | null>(null);
  const [planSavingUserId, setPlanSavingUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<PanelData>(`/usuarios?q=${encodeURIComponent(q)}`);
      setUsers(data.usuarios ?? []);
      setRequests(data.solicitudes ?? data.contactos ?? []);
      setInvitations(data.cuentas ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el panel.");
    } finally {
      setLoading(false);
    }
  }

  async function changePlan(userId: string, plan: string) {
    setPlanSavingUserId(userId);
    setError("");
    try {
      await apiFetch(`/usuarios/${userId}/plan`, { method: "PUT", body: JSON.stringify({ plan }) });
      setToast("Plan actualizado.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el plan.");
    } finally {
      setPlanSavingUserId(null);
    }
  }

  useEffect(() => {
    apiFetch<Profile>("/auth/me").then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const id = setTimeout(load, 150);
    return () => clearTimeout(id);
  }, [q]);

  async function toggle(id: string) {
    try {
      await apiFetch(`/usuarios/${id}/toggle`, { method: "POST" });
      setToast("Estado actualizado.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    }
  }

  async function inviteRequest(requestId: number) {
    setBusyRequestId(requestId);
    setError("");
    try {
      const data = await apiFetch<{ invite_url: string }>(`/usuarios/solicitudes/${requestId}/invitar`, {
        method: "POST",
      });
      setToast("Invitación generada y enviada por email al usuario.");
      copyToClipboard(data.invite_url);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la invitación.");
    } finally {
      setBusyRequestId(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* noop */
    }
  }

  async function deleteRequest(requestId: number) {
    if (!window.confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.")) return;
    setBusyRequestId(requestId);
    setError("");
    try {
      await apiFetch(`/usuarios/solicitudes/${requestId}`, { method: "DELETE" });
      setToast("Solicitud eliminada.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la solicitud.");
    } finally {
      setBusyRequestId(null);
    }
  }

  async function setTemporaryPassword(userId: string, email: string) {
    const password = window.prompt(`Contraseña temporal para ${email} (mínimo 6 caracteres):`);
    if (!password) return;
    setTemporaryPasswordUserId(userId);
    setError("");
    try {
      await apiFetch(`/usuarios/${userId}/temporary-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      await navigator.clipboard.writeText(password).catch(() => undefined);
      setToast("Contraseña temporal establecida y copiada al portapapeles.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo establecer la contraseña temporal.");
    } finally {
      setTemporaryPasswordUserId(null);
    }
  }

  async function contactRequest(requestId: number) {
    setBusyRequestId(requestId);
    setError("");
    try {
      await apiFetch(`/usuarios/solicitudes/${requestId}/contactar`, { method: "POST" });
      setToast("Solicitud de soporte marcada como contactada.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el contacto.");
    } finally {
      setBusyRequestId(null);
    }
  }

  async function copyLink(invitation: AccountInvitation) {
    try {
      await navigator.clipboard.writeText(invitation.invite_url);
      setCopiedId(invitation.id);
      setToast("Link copiado.");
      window.setTimeout(() => setCopiedId(current => (current === invitation.id ? null : current)), 1800);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

  async function regenerateLink(invitation: AccountInvitation) {
    setRegeneratingId(invitation.id);
    setError("");
    try {
      const data = await apiFetch<{ ok: boolean; invite_url: string }>(`/usuarios/invitaciones/${invitation.id}/regenerar`, {
        method: "POST",
      });
      setToast("Link regenerado. Se notificó al usuario por email.");
      copyToClipboard(data.invite_url);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo regenerar el enlace.");
    } finally {
      setRegeneratingId(null);
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>SuperAdmin</h1>
          <p className="muted">Solicitudes, invitaciones y usuarios del sistema en un solo panel.</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {toast && <div className="alert alert-success">{toast}</div>}

      <div className="card section-card">
        <input
          className="input"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, correo, plan o estado…"
        />
      </div>

      <div className="card section-card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Solicitudes pendientes</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              {requests.length} solicitud{requests.length === 1 ? "" : "es"} nuevas
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Plan</th>
                <th>Mensaje</th>
                <th>Fecha</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => {
                const isSupport = (request.plan || "").trim().toLowerCase() === "soporte";
                return (
                <tr key={request.id}>
                  <td>{request.nombre}</td>
                  <td>{request.correo}</td>
                  <td>{request.telefono || "—"}</td>
                  <td>{request.plan || "—"}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 300 }}>{request.mensaje}</td>
                  <td>{new Date(request.creado_en).toLocaleString("es-AR")}</td>
                  <td>
                    <div className="actions">
                      <button
                        className={isSupport ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                        disabled={busyRequestId === request.id}
                        onClick={() => isSupport ? contactRequest(request.id) : inviteRequest(request.id)}
                      >
                        {busyRequestId === request.id ? "Procesando…" : isSupport ? "Contactar" : "Generar link"}
                      </button>
                      <button className="btn btn-danger btn-sm" disabled={busyRequestId === request.id} onClick={() => deleteRequest(request.id)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {!requests.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">No hay solicitudes pendientes.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section-card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Cuentas creadas</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              {invitations.length} invitación{invitations.length === 1 ? "" : "es"} registradas
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table style={{ minWidth: 1120 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map(invitation => {
                const done = invitation.estado === "completada";
                return (
                  <tr key={invitation.id}>
                    <td>{invitation.nombre}</td>
                    <td>{invitation.correo}</td>
                    <td>{invitation.plan || "—"}</td>
                    <td>
                      <span className={`status ${done ? "status-ok" : "status-zero"}`}>
                        {done ? "Activa" : "Sin contraseña"}
                      </span>
                      {!done && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Esperando que configure su contraseña</div>}
                    </td>
                    <td>{new Date(invitation.created_at).toLocaleString("es-AR")}</td>
                    <td>
                      <div className="actions">
                        {!done && (
                          <>
                            <button className="btn btn-primary btn-sm" disabled={regeneratingId === invitation.id} onClick={() => regenerateLink(invitation)}>
                              {regeneratingId === invitation.id ? "Regenerando…" : "Regenerar link"}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => copyLink(invitation)}>
                              {copiedId === invitation.id ? "Copiado" : "Copiar link"}
                            </button>
                          </>
                        )}
                        {done && <span className="muted" style={{ fontSize: 12 }}>El enlace ya fue consumido</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!invitations.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">No hay invitaciones generadas.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section-card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Lista global de usuarios</h3>
            <div className="muted" style={{ fontSize: 13 }}>{users.length} cuentas visibles</div>
          </div>
        </div>
        <div className="table-wrap">
          <table style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isMe = me?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      {u.nombre} {u.apellido}
                      {isMe && <div className="muted" style={{ fontSize: 12 }}>Tu cuenta</div>}
                    </td>
                    <td>{u.correo}</td>
                    <td>{u.rol}</td>
                    <td>
                      <select className="select plan-select" value={u.plan_nombre || ""} onChange={e => changePlan(u.id, e.target.value)} disabled={planSavingUserId === u.id}>
                        <option value="" disabled>Sin plan</option>
                        {PLANS.map(plan => <option key={plan.key} value={plan.name}>{plan.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`status ${u.activo ? "status-ok" : "status-zero"}`}>
                        {u.activo ? "Normal" : "Bloqueado"}
                      </span>
                      {!isMe && u.invite_pendiente && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Sin contraseña aún</div>}
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString("es-AR")}</td>
                    <td>
                      <div className="actions">
                        {!isMe && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setTemporaryPassword(u.id, u.correo)} disabled={temporaryPasswordUserId === u.id}>
                            {temporaryPasswordUserId === u.id ? "Guardando…" : "Contraseña temporal"}
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggle(u.id)}
                          disabled={isMe}
                          title={isMe ? "No podés bloquear tu propia cuenta." : "Cambiar estado"}
                        >
                          {u.activo ? "Bloquear" : "Desbloquear"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!users.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">No hay usuarios.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

