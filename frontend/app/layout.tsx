import "./globals.css";

export const metadata = {
  title: "Gestor Stock — MartoTech",
  description: "Gestión de inventario, ventas y métricas para pequeños negocios.",
  icons: {
    icon: "/martotech.jpg",
    shortcut: "/martotech.jpg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
