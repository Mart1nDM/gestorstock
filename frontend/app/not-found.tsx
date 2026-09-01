import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: "30px 0" }}>
      <div className="card page-pad" style={{ width: "min(440px, 100%)", padding: "44px 28px" }}>
        <img src="/logo.png" alt="MartoTech" style={{ width: 90, height: 90, objectFit: "contain", borderRadius: 12, marginBottom: 18 }} />
        <h1 style={{ fontSize: 72, margin: 0, lineHeight: 1, letterSpacing: "-.05em" }}>404</h1>
        <h2 style={{ margin: "6px 0 8px" }}>Página no encontrada</h2>
        <p className="muted" style={{ lineHeight: 1.7, margin: "0 0 22px" }}>La página que buscaste no existe o fue movida. Podés volver a la página principal para seguir navegando.</p>
        <Link href="/" className="btn btn-primary" style={{ width: "100%" }}>Volver al inicio</Link>
      </div>
    </main>
  );
}
