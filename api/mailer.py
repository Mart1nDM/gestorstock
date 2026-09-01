import os
from typing import Optional

try:
    from .deps import load_env_file
except ImportError:
    from deps import load_env_file

load_env_file()

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
_EMAIL_FROM = os.environ.get("EMAIL_FROM", "Gestor Online <onboarding@resend.dev>").strip()
_ADMIN_EMAIL = os.environ.get("SUPERADMIN_EMAIL", "").strip().lower()


def _is_enabled() -> bool:
    return bool(RESEND_API_KEY)


def _render_base(content_html: str, title: str = "Gestor Online") -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#0f172a;padding:20px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">📦 Gestor Online</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;line-height:1.6;color:#1e293b;">
            {content_html}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 28px;font-size:12px;color:#64748b;">
            Este mensaje fue enviado automáticamente por Gestor Online (MartoTech).
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _button(href: str, label: str) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">'
        f'<tr><td style="background:#2563eb;border-radius:8px;">'
        f'<a href="{href}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">{label}</a>'
        f'</td></tr></table>'
    )


def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None) -> bool:
    if not _is_enabled():
        return False
    try:
        import resend

        resend.api_key = RESEND_API_KEY
        payload: dict = {
            "from": _EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if reply_to:
            payload["reply_to"] = [reply_to]
        resend.Emails.send(payload)
        return True
    except Exception:
        return False


def notify_admin_new_request(*, nombre: str, correo: str, telefono: Optional[str], plan: Optional[str], mensaje: str) -> bool:
    if not _is_enabled() or not _ADMIN_EMAIL:
        return False
    plan_txt = plan or "Sin especificar"
    html = _render_base(
        f"""
        <h2 style="margin:0 0 16px;color:#0f172a;">📥 Nueva solicitud recibida</h2>
        <p>Alguien solicitó una cuenta en <strong>Gestor Online</strong>.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;">
          <tr><td style="padding:6px 0;"><strong>Nombre:</strong> {nombre}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Correo:</strong> {correo}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Teléfono:</strong> {telefono or "—"}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Plan:</strong> {plan_txt}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Mensaje:</strong><br/>{mensaje.replace(chr(10), "<br/>")}</td></tr>
        </table>
        <p>Entrá al panel de administración para procesar esta solicitud.</p>
        """,
        "Nueva solicitud de cuenta",
    )
    return send_email(to=_ADMIN_EMAIL, subject=f"Nueva solicitud de cuenta: {nombre}", html=html, reply_to=correo)


def send_invitation_email(*, correo: str, nombre: str, invite_url: str) -> bool:
    if not _is_enabled():
        return False
    html = _render_base(
        f"""
        <h2 style="margin:0 0 16px;color:#0f172a;">👋 ¡Tu cuenta de Gestor Online está lista!</h2>
        <p>¡Hola {nombre}! Ya creamos tu cuenta en <strong>Gestor Online</strong>.</p>
        <p>Para terminar, configurá tu contraseña usando el siguiente enlace:</p>
        {_button(invite_url, "Configurar mi contraseña")}
        <p>Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
        <p style="background:#f8fafc;border-radius:8px;padding:12px;word-break:break-all;font-size:13px;color:#2563eb;">{invite_url}</p>
        <p>El enlace es de uso único. Si tenés dudas, respondé este correo.</p>
        """,
        "Tu cuenta está lista",
    )
    return send_email(to=correo, subject="Configurá tu contraseña en Gestor Online", html=html)


def notify_admin_invitation_sent(*, correo: str, nombre: str) -> bool:
    if not _is_enabled() or not _ADMIN_EMAIL:
        return False
    html = _render_base(
        f"""
        <h2 style="margin:0 0 16px;color:#0f172a;">✅ Invitación enviada</h2>
        <p>Se envió la invitación para configurar la contraseña a:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;">
          <tr><td style="padding:6px 0;"><strong>Nombre:</strong> {nombre}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Correo:</strong> {correo}</td></tr>
        </table>
        <p>El usuario ya recibió el enlace por correo, no hace falta enviárselo manualmente.</p>
        """,
        "Invitación enviada",
    )
    return send_email(to=_ADMIN_EMAIL, subject=f"Invitación enviada a {correo}", html=html)
