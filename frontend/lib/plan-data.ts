export type PlanKey = "gratis" | "premium" | "pro";

export type PlanInfo = {
  key: PlanKey;
  name: string;
  price: string;
  subtitle: string;
  products: string;
  accent: string;
  features: string[];
  highlights: string[];
};

export const PLANS: PlanInfo[] = [
  {
    key: "gratis",
    name: "Gratis",
    price: "$0/mes",
    subtitle: "Para empezar sin costo y ordenar el inventario básico.",
    products: "Hasta 10 productos",
    accent: "var(--success)",
    features: ["Control de stock esencial", "Alta y edición de productos", "Vista simple de métricas"],
    highlights: ["Hasta 10 productos", "Métricas básicas", "Ideal para arrancar"],
  },
  {
    key: "premium",
    name: "Premium",
    price: "$5099,99",
    subtitle: "Más capacidad para crecer con datos más claros.",
    products: "Hasta 100 productos",
    accent: "var(--accent)",
    features: ["Más métricas y gráficos", "Seguimiento de stock bajo", "Panel con análisis visual"],
    highlights: ["Hasta 100 productos", "Más métricas y gráficos", "Ideal para negocios en expansión"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$9999,99",
    subtitle: "Para operación completa, análisis y soporte más cercano.",
    products: "Productos ilimitados",
    accent: "var(--warning)",
    features: ["Reportes de ventas", "Gráficos de análisis", "Soporte personalizado"],
    highlights: ["Productos ilimitados", "Reportes de ventas", "Soporte personalizado"],
  },
];

export const PLAN_BY_KEY = Object.fromEntries(PLANS.map(plan => [plan.key, plan])) as Record<PlanKey, PlanInfo>;

export function isPlanKey(value: string | null | undefined): value is PlanKey {
  return value === "gratis" || value === "premium" || value === "pro";
}
