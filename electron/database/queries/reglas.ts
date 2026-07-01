import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

export function getReglasCategorizacion(): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT r.*, c.nombre as categoria_nombre, c.color as categoria_color, c.emoji as categoria_emoji, c.tipo as categoria_tipo
     FROM reglas_categorizacion r
     LEFT JOIN categorias c ON r.categoria_id = c.id
     ORDER BY r.prioridad DESC, r.id ASC`
  ))
}

export function saveReglaCategorizacion(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      `UPDATE reglas_categorizacion SET patron=?, tipo_patron=?, tipo=?, categoria_id=?, prioridad=?, activo=? WHERE id=?`,
      [data.patron, data.tipo_patron || 'contiene', data.tipo || 'ambos',
       data.categoria_id || null, data.prioridad || 0, data.activo ?? 1, data.id]
    )
  } else {
    db.run(
      `INSERT INTO reglas_categorizacion (patron, tipo_patron, tipo, categoria_id, prioridad, activo)
       VALUES (?,?,?,?,?,?)`,
      [data.patron, data.tipo_patron || 'contiene', data.tipo || 'ambos',
       data.categoria_id || null, data.prioridad || 0, data.activo ?? 1]
    )
  }
  guardarDb()
}

export function deleteReglaCategorizacion(id: number): void {
  const db = getDb()
  db.run('DELETE FROM reglas_categorizacion WHERE id = ?', [id])
  guardarDb()
}

/**
 * Aplica las reglas de categorización a todas las transacciones sin categoría de un mes.
 * Retorna cuántas transacciones fueron actualizadas.
 */
export function aplicarReglasAMes(mes_id: number): number {
  const db = getDb()
  const reglas = getReglasCategorizacion().filter(r => r.activo && r.categoria_id)
  const transacciones = rowsToObjects(db.exec(
    `SELECT id, categoria_nombre_original, tipo FROM transacciones_detalle
     WHERE mes_id = ? AND categoria_id IS NULL`,
    [mes_id]
  ))

  let actualizadas = 0
  for (const tx of transacciones) {
    const nombre = (tx.categoria_nombre_original || '').toLowerCase()
    for (const regla of reglas) {
      // Filtrar por tipo de transacción
      if (regla.tipo !== 'ambos' && regla.tipo !== tx.tipo) continue

      const patron = (regla.patron || '').toLowerCase()
      let coincide = false
      if (regla.tipo_patron === 'igual') {
        coincide = nombre === patron
      } else {
        coincide = nombre.includes(patron)
      }

      if (coincide) {
        db.run('UPDATE transacciones_detalle SET categoria_id = ? WHERE id = ?',
          [regla.categoria_id, tx.id])
        actualizadas++
        break // primera regla que coincide gana
      }
    }
  }

  if (actualizadas > 0) guardarDb()
  return actualizadas
}
