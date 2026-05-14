import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

export function getParametros(): Record<string, string> {
  const db = getDb()
  const rows = rowsToObjects(db.exec('SELECT clave, valor FROM parametros_globales'))
  return Object.fromEntries(rows.map(r => [r.clave, r.valor]))
}

export function saveParametro(clave: string, valor: string): void {
  const db = getDb()
  db.run(
    `INSERT INTO parametros_globales (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    [clave, valor]
  )
  guardarDb()
}