# Gestor Stock — MartoTech

Migración web del Gestor de Stock de escritorio a una arquitectura multiusuario con **Next.js 16 + FastAPI + Supabase PostgreSQL/Auth + Vercel**.

## Qué conserva de la aplicación original

La app de escritorio enviada como referencia ya tenía:

- Alta, edición y baja de productos.
- Búsqueda por nombre y campos relacionados.
- Ordenamiento por columnas.
- Alertas de stock bajo y sin stock.
- Registro de ventas con descuento automático de stock.
- Historial de ventas del día.
- Dashboard con total de productos, stock bajo, sin stock, valor del inventario, ventas del día, total histórico y producto más vendido.
- Campos detallados del producto: nombre, código de barras, marca, categoría, sabor, unidad, stock, stock mínimo, precios, proveedor, ubicación, fechas y descripción.

En esta versión esos datos pasan a PostgreSQL y cada cuenta tiene su propio `owner_id`.

## Arquitectura

```text
gestor-stock/
├── frontend/                 # Next.js App Router
│   ├── app/
│   │   ├── page.tsx          # Landing + formulario de contacto
│   │   ├── login/page.tsx
│   │   ├── set-password/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── productos/page.tsx
│   │   ├── ventas/page.tsx
│   │   └── superadmin/page.tsx
│   ├── components/
│   ├── lib/
│   └── package.json
├── api/                      # FastAPI para Vercel Functions
│   ├── index.py
│   ├── deps.py
│   ├── db.py
│   ├── auth.py
│   ├── productos.py
│   ├── ventas.py
│   └── usuarios.py
├── supabase/schema.sql
├── vercel.json
├── requirements.txt
└── .env.example
```

Vercel soporta Next.js y FastAPI en un mismo proyecto; el runtime Python detecta funciones en `api/` y la aplicación puede compartir un único dominio. citeturn696022search4turn775796search3

## 1. Supabase

1. Creá un proyecto en Supabase.
2. Abrí SQL Editor.
3. Ejecutá `supabase/schema.sql`.
4. En Authentication > URL Configuration agregá como Redirect URL tu URL de Vercel y, para desarrollo, `http://localhost:3000/set-password`.
5. Configurá el proveedor de correo de Supabase para que las invitaciones lleguen a los clientes.

La invitación administrativa de Supabase crea el usuario y le envía un enlace para completar el alta y definir una contraseña. Es una operación que debe hacerse desde un entorno de servidor con una secret key, nunca desde el navegador. citeturn809001search0turn809001search4

## 2. Variables de entorno

Copiá `.env.example` a tu entorno local y completá:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SITE_URL`

La `SUPABASE_SECRET_KEY` queda exclusivamente en Vercel/backend. Supabase indica que las APIs administrativas requieren una clave secreta y que no debe exponerse al cliente. citeturn809001search2

## 3. Primer SuperAdmin

Creá tu usuario en Supabase Authentication.

Luego creá su fila en `profiles` o usá el trigger que prefieras y asignale:

```sql
update public.profiles
set rol = 'superadmin', activo = true
where correo = 'TU_CORREO';
```

El backend usa el rol guardado en `profiles` para autorizar SuperAdmin; no se basa en `user_metadata`.

## 4. Desarrollo local

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend, opcionalmente para probar FastAPI solo:

```bash
pip install -r requirements.txt
cd api
uvicorn index:app --reload
```

Para probar la experiencia completa con Vercel local, también podés usar `vercel dev`. La documentación actual de Vercel muestra este flujo para proyectos con Next.js + FastAPI bajo un mismo dominio. citeturn696022search9

## 5. Deploy a Vercel

Importá el repositorio de GitHub en Vercel y configurá las variables de entorno.

La estructura se basa en el patrón actual de Vercel para Next.js + FastAPI en un único proyecto. citeturn696022search4turn696022search3

## Seguridad y modelo de cuentas

El flujo esperado es:

1. Una persona entra a la landing.
2. Envía el formulario de contacto.
3. El pedido aparece en SuperAdmin.
4. Vos definís el plan y creás la cuenta.
5. FastAPI crea/invita al usuario mediante Supabase Auth.
6. El usuario recibe una invitación y establece su propia contraseña.
7. Al iniciar sesión, solo consulta productos y ventas cuyo `owner_id` coincide con su cuenta.

La contraseña no se almacena en `profiles`; la administra Supabase Auth. Supabase Auth utiliza JWT para autenticación y está diseñado para trabajar junto con RLS y autorización por filas. citeturn775796search9

## Nota sobre planes

No definí precios ni límites comerciales porque no estaban especificados en el proyecto enviado. El esquema sí incluye la tabla `plans`, y SuperAdmin puede guardar el nombre del plan elegido al crear una cuenta.

## Base usada como referencia

La versión de escritorio de referencia define los colores principales del sistema como `#0F1117`, `#161B27`, `#1E2336`, `#252B3B`, con azul `#4F8EF7`, violeta `#7C3AED`, verde `#22C55E`, amarillo `#F59E0B` y rojo `#EF4444`; la UI web mantiene esa misma paleta. fileciteturn0file0L7-L13

También se reutilizó la idea del panel SuperAdmin proporcionado: búsqueda de usuarios, estado, acciones administrativas, diseño oscuro y uso de naranja/contrastes fuertes. fileciteturn0file0L7-L12
