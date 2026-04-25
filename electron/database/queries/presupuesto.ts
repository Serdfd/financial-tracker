import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

export function getPresupuestoFijos(): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT p.*, c.nombre as categoria_nombre, c.color as categoria_color
     FROM presupuesto_fijos p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     WHERE p.activo = 1 ORDER BY p.nombre`
  ))
}

export function savePresupuestoFijo(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      'UPDATE presupuesto_fijos SET nombre=?, categoria_id=?, monto=? WHERE id=?',
      [data.nombre, data.categoria_id, data.monto, data.id]
    )
  } else {
    db.run(
      'INSERT INTO presupuesto_fijos (nombre, categoria_id, monto) VALUES (?,?,?)',
      [data.nombre, data.categoria_id, data.monto]
    )
  }
  guardarDb()
}

export function deletePresupuestoFijo(id: number): void {
  const db = getDb()
  db.run('UPDATE presupuesto_fijos SET activo = 0 WHERE id = ?', [id])
  guardarDb()
}

export function getPresupuestoVariables(): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT p.*, c.nombre as categoria_nombre, c.color as categoria_color
     FROM presupuesto_variables p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     WHERE p.activo = 1 ORDER BY p.nombre`
  ))
}

export function savePresupuestoVariable(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      'UPDATE presupuesto_variables SET nombre=?, categoria_id=?, tope_mensual=? WHERE id=?',
      [data.nombre, data.categoria_id, data.tope_mensual, data.id]
    )
  } else {
    db.run(
      'INSERT INTO presupuesto_variables (nombre, categoria_id, tope_mensual) VALUES (?,?,?)',
      [data.nombre, data.categoria_id, data.tope_mensual]
    )
  }
  guardarDb()
}

export function deletePresupuestoVariable(id: number): void {
  const db = getDb()
  db.run('UPDATE presupuesto_variables SET activo = 0 WHERE id = ?', [id])
  guardarDb()
}