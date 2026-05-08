import { getDb, guardarDb } from '../db'

// Obtener todos los registros de un catálogo
export function getCatalogo(tabla: string): any[] {
  const db = getDb()
  const result = db.exec(`SELECT * FROM ${tabla} WHERE activo = 1 ORDER BY nombre`)
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  )
}

// Sanitizar strings: trim a todos los campos de texto
function sanitizar(data: any): any {
  const limpio: any = {}
  for (const [key, value] of Object.entries(data)) {
    limpio[key] = typeof value === 'string' ? value.trim() : value
  }
  return limpio
}

// Insertar o actualizar un registro
export function saveCatalogo(tabla: string, data: any): any {
  const db = getDb()
  const clean = sanitizar(data)

  if (clean.id) {
    // UPDATE
    const campos = Object.keys(clean).filter(k => k !== 'id')
    const sets = campos.map(c => `${c} = ?`).join(', ')
    const valores = campos.map(c => clean[c])
    db.run(`UPDATE ${tabla} SET ${sets} WHERE id = ?`, [...valores, clean.id])
  } else {
    // INSERT
    const campos = Object.keys(clean)
    const placeholders = campos.map(() => '?').join(', ')
    const valores = campos.map(c => clean[c])
    db.run(`INSERT INTO ${tabla} (${campos.join(', ')}) VALUES (${placeholders})`, valores)
  }
  guardarDb()
  return getCatalogo(tabla)
}

// Eliminar (soft delete)
export function deleteCatalogo(tabla: string, id: number): void {
  const db = getDb()
  db.run(`UPDATE ${tabla} SET activo = 0 WHERE id = ?`, [id])
  guardarDb()
}

// Obtener todos incluyendo inactivos (para joins)
export function getCatalogoTodos(tabla: string): any[] {
  const db = getDb()
  const result = db.exec(`SELECT * FROM ${tabla}`)
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  )
}