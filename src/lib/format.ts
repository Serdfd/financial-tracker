// Formatea números como moneda COP
export function formatCOP(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)
}

// Formatea número con separadores sin símbolo
export function formatNum(valor: number): string {
  return new Intl.NumberFormat('es-CO').format(valor)
}

// Formatea porcentaje
export function formatPct(valor: number): string {
  return `${valor >= 0 ? '+' : ''}${valor.toFixed(2)}%`
}

// Nombre del mes
export const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function nombreMes(mes: number, anio: number): string {
  return `${MESES_NOMBRES[mes]} ${anio}`
}