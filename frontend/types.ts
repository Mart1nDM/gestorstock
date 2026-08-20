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
};
