// ── CATÁLOGOS ──────────────────────────────────────────
export interface Entidad {
  id: number
  nombre: string
  tipo?: string
  activo: number
}

export interface TipoInversion {
  id: number
  nombre: string
  descripcion?: string
  activo: number
}

export interface PerfilRiesgo {
  id: number
  nombre: string
  color: string
  descripcion?: string
  activo: number
}

export interface Categoria {
  id: number
  nombre: string
  tipo: 'ingreso' | 'gasto'
  color: string
  emoji: string
  activo: number
}

export interface Moneda {
  id: number
  codigo: string
  nombre: string
  simbolo: string
  tasa_a_cop: number
  activo: number
}

// ── PRESUPUESTO ────────────────────────────────────────
export interface PresupuestoFijo {
  id: number
  nombre: string
  categoria_id: number
  monto: number
  activo: number
  categoria_nombre?: string
  categoria_color?: string
}

export interface PresupuestoVariable {
  id: number
  nombre: string
  categoria_id: number
  tope_mensual: number
  activo: number
  categoria_nombre?: string
  categoria_color?: string
}

// ── MESES ──────────────────────────────────────────────
export interface Mes {
  id: number
  anio: number
  mes: number
  cerrado: number
}

// ── MOVIMIENTOS ────────────────────────────────────────
export interface IngresoMes {
  id: number
  mes_id: number
  categoria_id: number
  monto: number
  moneda_id: number
  nota?: string
  categoria_nombre?: string
  moneda_simbolo?: string
  moneda_codigo?: string
}

export interface GastoMes {
  id: number
  mes_id: number
  categoria_id: number
  monto: number
  moneda_id: number
  nota?: string
  categoria_nombre?: string
  moneda_simbolo?: string
  moneda_codigo?: string
}

export interface DeudaTC {
  id: number
  mes_id: number
  nombre_tc: string
  saldo: number
}

// ── INVERSIONES ────────────────────────────────────────
export interface Inversion {
  id: number
  nombre: string
  entidad_id?: number
  tipo_id?: number
  riesgo_id?: number
  moneda_id?: number
  estado: string
  fecha_inicio?: string
  notas?: string
  activo: number
  entidad_nombre?: string
  tipo_nombre?: string
  riesgo_nombre?: string
  riesgo_color?: string
  moneda_codigo?: string
  moneda_simbolo?: string
  tasa_a_cop?: number
}

export interface InversionMensual {
  id: number
  inversion_id: number
  mes_id: number
  saldo_cierre: number
  aportes: number
  retiros: number
  rendimiento: number
  rentabilidad_pct: number
  anio?: number
  mes?: number
  inversion_nombre?: string
  riesgo_color?: string
  riesgo_nombre?: string
  tipo_nombre?: string
  tasa_a_cop?: number
}

export interface Inmueble {
  id: number
  inversion_id: number
  precio_compra: number
  valor_estimado_actual?: number
  cuota_mensual?: number
  cuotas_totales?: number
  cuotas_pagadas: number
  fecha_entrega_estimada?: string
  estado: string
}

// ── FICHAS TÉCNICAS ────────────────────────────────────
export interface FichaInversion {
  id: number
  inversion_id: number
  // CDT
  tasa_ea?: number
  plazo_dias?: number
  retencion_pct?: number   // nuevo — default 4%
  // monto_inicial eliminado — se toma del saldo inicial
  // fecha_vencimiento eliminado — se calcula: fecha_inicio + plazo_dias
  // Acciones
  num_acciones?: number
  precio_promedio?: number
  mercado?: string
  ticker?: string
  // Crypto
  cantidad_tokens?: number
  token_symbol?: string
  precio_promedio_crypto?: number
}

export interface LoteInversion {
  id: number
  inversion_id: number
  fecha_compra: string
  cantidad: number
  precio_unitario: number
  comision: number
  nota?: string
}

export interface ResumenLotes {
  total_unidades: number
  costo_sin_comision: number
  total_comisiones: number
  costo_total: number
  precio_promedio: number
}

export interface AlertaCDT {
  nombre: string
  inversion_id: number
  entidad_nombre?: string
  fecha_vencimiento: string
  tasa_ea?: number
  monto_inicial?: number
  dias_restantes: number
}

// ── TRM ─────────────────────────────────────────────────
export interface TRMResult {
  ok: boolean
  mensaje: string
  fecha?: string
}

// ── DASHBOARD ──────────────────────────────────────────
export interface DashboardData {
  ingresos: number
  gastos: number
  rendimientos: number
  patrimonioNeto: number
  deudasTC: number
  ultimos6Meses: { anio: number; mes: number; ingresos: number; gastos: number }[]
  ultimos12Meses: { anio: number; mes: number; patrimonio: number }[]
  distribucionInversiones: { nombre: string; valor: number }[]
  distribucionTipos: { tipo: string; valor: number }[]
  distribucionRiesgo: { riesgo: string; color: string; valor: number }[]
}

// ── WINDOW ELECTRON API ────────────────────────────────
declare global {
  interface Window {
    electronAPI: {
      getCatalogo: (tabla: string) => Promise<any[]>
      saveCatalogo: (tabla: string, data: any) => Promise<any>
      deleteCatalogo: (tabla: string, id: number) => Promise<void>
      getMeses: () => Promise<Mes[]>
      getOrCreateMes: (anio: number, mes: number) => Promise<Mes>
      cerrarMes: (mes_id: number) => Promise<void>
      getIngresosMes: (mes_id: number) => Promise<IngresoMes[]>
      saveIngresoMes: (data: any) => Promise<void>
      deleteIngresoMes: (id: number) => Promise<void>
      getGastosMes: (mes_id: number) => Promise<GastoMes[]>
      saveGastoMes: (data: any) => Promise<void>
      deleteGastoMes: (id: number) => Promise<void>
      getDeudasTC: (mes_id: number) => Promise<DeudaTC[]>
      saveDeudaTC: (data: any) => Promise<void>
      deleteDeudaTC: (id: number) => Promise<void>
      getInversiones: () => Promise<Inversion[]>
      saveInversion: (data: any) => Promise<any>
      deleteInversion: (id: number) => Promise<void>
      getInversionMensual: (inversion_id: number) => Promise<InversionMensual[]>
      getInversionMensualMes: (mes_id: number) => Promise<InversionMensual[]>
      saveInversionMensual: (data: any) => Promise<void>
      getInmueble: (inversion_id: number) => Promise<Inmueble>
      saveInmueble: (data: any) => Promise<void>
      getFichaInversion: (inversion_id: number) => Promise<FichaInversion | null>
      saveFichaInversion: (data: any) => Promise<void>
      getAlertasCDT: () => Promise<AlertaCDT[]>
      getLotesInversion: (inversion_id: number) => Promise<LoteInversion[]>
      saveLoteInversion: (data: any) => Promise<void>
      deleteLoteInversion: (id: number) => Promise<void>
      getResumenLotes: (inversion_id: number) => Promise<ResumenLotes>
      getPresupuestoFijos: () => Promise<PresupuestoFijo[]>
      savePresupuestoFijo: (data: any) => Promise<void>
      deletePresupuestoFijo: (id: number) => Promise<void>
      getPresupuestoVariables: () => Promise<PresupuestoVariable[]>
      savePresupuestoVariable: (data: any) => Promise<void>
      deletePresupuestoVariable: (id: number) => Promise<void>
      actualizarTRM: () => Promise<TRMResult>
      getDashboardData: (anio: number, mes: number) => Promise<DashboardData>
    }
  }
}