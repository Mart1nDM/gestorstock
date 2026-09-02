import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.deps import load_env_file

load_env_file()

token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "").strip()

print("=== Verificacion de MercadoPago ===")
if not token:
    print("ERROR: MERCADOPAGO_ACCESS_TOKEN no esta definido en el .env de la raiz.")
    sys.exit(1)

prefix = token.split("-")[0] if "-" in token else token
print(f"Token presente. Prefijo: {prefix!r}")
print("(TEST => sandbox / prueba. APP_USR => produccion)")

try:
    import mercadopago
except ImportError:
    print("ERROR: no esta instalado el paquete 'mercadopago'. Corre: pip install mercadopago==3.5.0")
    sys.exit(1)

sdk = mercadopago.SDK(token)

preference = {
    "items": [
        {
            "title": "Verificacion tecnica - plan Premium",
            "quantity": 1,
            "unit_price": 5.99,
            "currency_id": "ARS",
        }
    ],
    "external_reference": "verif-tecnica-0001",
    "back_urls": {
        "success": "https://gestorstock-web.vercel.app/pago-confirmado",
        "failure": "https://gestorstock-web.vercel.app/pago-confirmado",
        "pending": "https://gestorstock-web.vercel.app/pago-confirmado",
    },
}

try:
    response = sdk.preference().create(preference)
except Exception as exc:
    print(f"ERROR al crear la preferencia: {exc}")
    sys.exit(1)

result = response.get("response") or {}
accept = response.get("status")

if accept in (200, 201):
    pid = result.get("id")
    init = result.get("init_point") or result.get("sandbox_init_point")
    print("OK: la preferencia se creo correctamente.")
    if pid:
        print(f"  Preferencia ID: {pid}")
    if init:
        print(f"  Init point (podes abrirla para probar): {init}")
    print("\nEl ACCESS TOKEN es VALIDO y MercadoPago acepta crear pagos.")
else:
    print(f"\nERROR: MercadoPago respondio status={accept}")
    print("Detalle / error:")
    print(result)
    print("\nCausas comunes:")
    print(" - El token es de produccion pero no esta activado, o el app no tiene permisos.")
    print(" - Pusiste la Public Key en vez del Access Token.")
    print(" - Faltan datos del negocio / credenciales sin activar.")
    sys.exit(1)
