import { getDb, guardarDb } from '../database/db'

interface FrankfurterResponse {
  base: string
  date: string
  rates: Record<string, number>
}

/**
 * Actualiza las tasas de cambio a COP usando Frankfurter.app
 * Frankfurter usa datos del Banco Central Europeo (ECB)
 * Soporta: USD, EUR, GBP, JPY, etc.
 * NO soporta: COP directamente como base, así que calculamos via EUR
 */
export async function actualizarTRM(): Promise<{ ok: boolean; mensaje: string; fecha?: string }> {
  try {
    const db = getDb()

    // Obtener monedas activas distintas de COP
    const result = db.exec("SELECT id, codigo FROM monedas WHERE activo = 1 AND codigo != 'COP'")
    if (!result.length) return { ok: true, mensaje: 'No hay monedas extranjeras configuradas' }

    const [{ columns, values }] = result
    const monedas = values.map((row: any[]) =>
      Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
    ) as { id: number; codigo: string }[]

    // Frankfurter no tiene COP, usamos una estrategia:
    // 1. Obtener tasas de EUR a todas las monedas + COP no está disponible
    // Alternativa: usar exchangerate-api.com que sí tiene COP
    // Usaremos: https://open.er-api.com/v6/latest/USD (gratis, tiene COP)

    const response = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!response.ok) throw new Error(`API respondió ${response.status}`)

    const data = await response.json() as { result: string; rates: Record<string, number>; time_last_update_utc: string }
    if (data.result !== 'success') throw new Error('API devolvió error')

    const copRate = data.rates['COP']
    if (!copRate) throw new Error('No se encontró tasa COP en la respuesta')

    let actualizadas = 0
    for (const moneda of monedas) {
      const rate = data.rates[moneda.codigo]
      if (rate) {
        // tasa_a_cop = cuántos COP vale 1 unidad de esta moneda
        const tasaCop = copRate / rate
        db.run('UPDATE monedas SET tasa_a_cop = ? WHERE id = ?', [Math.round(tasaCop * 100) / 100, moneda.id])
        actualizadas++
      }
    }

    guardarDb()

    const fecha = new Date().toISOString().split('T')[0]
    return {
      ok: true,
      mensaje: `${actualizadas} moneda(s) actualizada(s)`,
      fecha
    }
  } catch (error: any) {
    console.error('Error actualizando TRM:', error)
    return {
      ok: false,
      mensaje: error.message || 'Error desconocido al consultar tasas'
    }
  }
}