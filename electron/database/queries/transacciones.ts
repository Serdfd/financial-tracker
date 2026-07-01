import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

export function saveTransaccionDetalle(data: any): boolean {
  const db = getDb()
  // Deduplicación: no insertar si ya existe el mismo movimiento en el mismo mes
  const existe = db.exec(
    `SELECT COUNT(*) as cnt FROM transacciones_detalle
     WHERE mes_id = ? AND fecha = ? AND hora = ? AND monto = ? AND tipo = ?
       AND COALESCE(descripcion,'') = COALESCE(?,'')`,
    [data.mes_id, data.fecha, data.hora, data.monto, data.tipo, data.descripcion || null]
  )
  const cnt = existe[0]?.values[0][0] as number
  if (cnt > 0) return false

  db.run(
    `INSERT INTO transacciones_detalle
      (mes_id, fecha, hora, cuenta, categoria_id, categoria_nombre_original, tipo, monto, descripcion)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [data.mes_id, data.fecha, data.hora, data.cuenta,
     data.categoria_id || null, data.categoria_nombre_original,
     data.tipo, data.monto, data.descripcion || null]
  )
  guardarDb()
  return true
}

export function getTransaccionesMes(mes_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT t.*, c.nombre as categoria_nombre, c.color as categoria_color, c.emoji as categoria_emoji
     FROM transacciones_detalle t
     LEFT JOIN categorias c ON t.categoria_id = c.id
     WHERE t.mes_id = ?
     ORDER BY t.fecha, t.hora`,
    [mes_id]
  ))
}

export function updateTransaccionCategoria(id: number, categoria_id: number | null): void {
  const db = getDb()
  db.run('UPDATE transacciones_detalle SET categoria_id = ? WHERE id = ?', [categoria_id || null, id])
  guardarDb()
}

export function buscarTransacciones(filtros: {
  texto?: string
  tipo?: string
  categoria_id?: number
  anio_desde?: number
  mes_desde?: number
  anio_hasta?: number
  mes_hasta?: number
}): any[] {
  const db = getDb()
  const condiciones: string[] = []
  const params: any[] = []

  if (filtros.texto) {
    condiciones.push(`(LOWER(COALESCE(t.descripcion,'')) LIKE ? OR LOWER(COALESCE(t.categoria_nombre_original,'')) LIKE ? OR LOWER(COALESCE(t.cuenta,'')) LIKE ?)`)
    const like = `%${filtros.texto.toLowerCase()}%`
    params.push(like, like, like)
  }
  if (filtros.tipo && filtros.tipo !== 'todos') {
    condiciones.push('t.tipo = ?')
    params.push(filtros.tipo)
  }
  if (filtros.categoria_id) {
    condiciones.push('t.categoria_id = ?')
    params.push(filtros.categoria_id)
  }
  if (filtros.anio_desde !== undefined && filtros.mes_desde !== undefined) {
    condiciones.push('(m.anio * 12 + m.mes) >= ?')
    params.push(filtros.anio_desde * 12 + filtros.mes_desde)
  }
  if (filtros.anio_hasta !== undefined && filtros.mes_hasta !== undefined) {
    condiciones.push('(m.anio * 12 + m.mes) <= ?')
    params.push(filtros.anio_hasta * 12 + filtros.mes_hasta)
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : ''
  return rowsToObjects(db.exec(
    `SELECT t.*, m.anio, m.mes,
            c.nombre as categoria_nombre, c.color as categoria_color, c.emoji as categoria_emoji
     FROM transacciones_detalle t
     JOIN meses m ON t.mes_id = m.id
     LEFT JOIN categorias c ON t.categoria_id = c.id
     ${where}
     ORDER BY m.anio DESC, m.mes DESC, t.fecha DESC, t.hora DESC
     LIMIT 500`,
    params
  ))
}

export function deleteTransaccionesMes(mes_id: number): void {
  const db = getDb()
  db.run('DELETE FROM transacciones_detalle WHERE mes_id = ?', [mes_id])
  guardarDb()
}