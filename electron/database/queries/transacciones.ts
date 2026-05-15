import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

export function saveTransaccionDetalle(data: any): void {
  const db = getDb()
  db.run(
    `INSERT INTO transacciones_detalle
      (mes_id, fecha, hora, cuenta, categoria_id, categoria_nombre_original, tipo, monto, descripcion)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [data.mes_id, data.fecha, data.hora, data.cuenta,
     data.categoria_id || null, data.categoria_nombre_original,
     data.tipo, data.monto, data.descripcion || null]
  )
  guardarDb()
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

export function deleteTransaccionesMes(mes_id: number): void {
  const db = getDb()
  db.run('DELETE FROM transacciones_detalle WHERE mes_id = ?', [mes_id])
  guardarDb()
}