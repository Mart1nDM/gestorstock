export type Profile = {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  rol: "cliente" | "superadmin";
  plan_id: string | null;
  plan_nombre: string | null;
  activo: boolean;
};

export type Product = {
  id: number;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  sabor: string | null;
  codigo_barras: string | null;
  cantidad: number;
  cantidad_minima: number;
  precio_costo: number;
  precio_venta: number;
  proveedor: string | null;
  unidad_medida: string | null;
  ubicacion: string | null;
  descripcion: string | null;
  fecha_ingreso: string | null;
  fecha_vencimiento: string | null;
  activo: boolean;
};

export type Sale = {
  id: number;
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_venta: number;
  total: number;
  fecha: string;
};

export type Dashboard = {
  stock: {
    total_productos: number;
    sin_stock: number;
    stock_bajo: number;
    unidades: number;
    valor_inventario: number;
  };
  ventas: {
    ventas_hoy: number;
    total_hoy: number;
    historico_vendido: number;
    unidades_vendidas: number;
  };
  categorias: number;
  producto_mas_vendido: string | null;
  graficas?: {
    ventas_por_dia: { dia: string; total: number }[];
    ventas_por_categoria: { name: string; value: number }[];
    unidades_por_categoria: { name: string; value: number }[];
    stock_por_categoria: { name: string; value: number }[];
    valor_por_categoria: { name: string; value: number }[];
    composicion_stock: { name: string; value: number }[];
  };
};

export type PlanInfo = {
  key: string;
  nombre: string;
  precio: string;
  subtitle: string;
  products: string;
  limite_productos: number | null;
  precio_mensual: number;
  accent: string;
  destacado: boolean;
  soporte: {
    nivel: string;
    tiempo: string;
    canal: string[];
    personalizado: boolean;
    prioridad: string;
  };
  metas_ventas: boolean;
  reportes: string[];
  graficas: string[];
  features: string[];
  limites: {
    productos: number | null;
    usuarios: number | string;
    historial_ventas: string;
  };
};

export type MetaData = {
  periodo: string;
  meta_actual: number;
  total_periodo: number;
  progreso: number | null;
  historial: { periodo: string; meta: number }[];
};
