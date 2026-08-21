import "./globals.css";

export const metadata = {
  title: "Gestor Stock — MartoTech",
  description: "Gestión de inventario, ventas y métricas para pequeños negocios.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
