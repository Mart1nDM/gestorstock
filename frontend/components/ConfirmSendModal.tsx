"use client";

import { useState } from "react";
import TurnstileWidget from "./TurnstileWidget";

type Props = {
  onConfirm: (token: string) => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmSendModal({ onConfirm, onCancel }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleConfirm() {
    if (!token) return;
    setSending(true);
    try {
      await onConfirm(token);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal confirm-send-modal" onClick={e => e.stopPropagation()}>
        <div className="page-header" style={{ alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Confirmar envío</h2>
            <p className="muted" style={{ marginBottom: 0 }}>Completá la verificación de seguridad para enviar.</p>
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancelar</button>
        </div>

        <div className="confirm-send-body">
          <TurnstileWidget onToken={setToken} />

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 14 }}
            disabled={!token || sending}
            onClick={handleConfirm}
          >
            {sending ? "Enviando…" : token ? "Enviar solicitud" : "Esperando verificación…"}
          </button>
        </div>
      </div>
    </div>
  );
}
