import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

// ── MESES ──────────────────────────────────────────────
export function getMeses(): any[] {
  const db = getDb()
  return rowsToObjects(db.exec('SELECT * FROM meses ORDER BY anio DESC, mes DESC'))
}

export function getOrCreateMes(anio: number, mes: number): any {
  const db = getDb()
  db.run(
    'INSERT OR IGNORE INTO meses (anio, mes) VALUES (?, ?)',
    [anio, mes]
  )
  guardarDb()
  const result = db.exec(
    'SELECT * FROM meses WHERE anio = ? AND mes = ?',
    [anio, mes]
  )
  return rowsToObjects(result)[0]
}

export function cerrarMes(mes_id: number): void {
  const db = getDb()
  db.run('UPDATE meses SET cerrado = 1 WHERE id = ?', [mes_id])
  guardarDb()
}

// ── INGRESOS ───────────────────────────────────────────
export function getIngresosMes(mes_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT i.*, c.nombre as categoria_nombre, m.simbolo as moneda_simbolo, m.codigo as moneda_codigo
     FROM ingresos_mes i
     LEFT JOIN categorias c ON i.categoria_id = c.id
     LEFT JOIN monedas m ON i.moneda_id = m.id
     WHERE i.mes_id = ?`,
    [mes_id]
  ))
}

export function saveIngresoMes(data: any): any {
  const db = getDb()
  if (data.id) {
    db.run(
      'UPDATE ingresos_mes SET categoria_id=?, monto=?, moneda_id=?, nota=? WHERE id=?',
      [data.categoria_id, data.monto, data.moneda_id, data.nota, data.id]
    )
  } else {
    db.run(
      'INSERT INTO ingresos_mes (mes_id, categoria_id, monto, moneda_id, nota) VALUES (?,?,?,?,?)',
      [data.mes_id, data.categoria_id, data.monto, data.moneda_id, data.nota]
    )
  }
  guardarDb()
}

export function deleteIngresoMes(id: number): void {
  const db = getDb()
  db.run('DELETE FROM ingresos_mes WHERE id = ?', [id])
  guardarDb()
}

// ── GASTOS ─────────────────────────────────────────────
export function getGastosMes(mes_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT g.*, c.nombre as categoria_nombre, m.simbolo as moneda_simbolo, m.codigo as moneda_codigo
     FROM gastos_mes g
     LEFT JOIN categorias c ON g.categoria_id = c.id
     LEFT JOIN monedas m ON g.moneda_id = m.id
     WHERE g.mes_id = ?`,
    [mes_id]
  ))
}

export function saveGastoMes(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      'UPDATE gastos_mes SET categoria_id=?, monto=?, moneda_id=?, nota=? WHERE id=?',
      [data.categoria_id, data.monto, data.moneda_id, data.nota, data.id]
    )
  } else {
    db.run(
      'INSERT INTO gastos_mes (mes_id, categoria_id, monto, moneda_id, nota) VALUES (?,?,?,?,?)',
      [data.mes_id, data.categoria_id, data.monto, data.moneda_id, data.nota]
    )
  }
  guardarDb()
}

export function deleteGastoMes(id: number): void {
  const db = getDb()
  db.run('DELETE FROM gastos_mes WHERE id = ?', [id])
  guardarDb()
}

// ── DEUDAS TC ──────────────────────────────────────────
export function getDeudasTC(mes_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    'SELECT * FROM deudas_tc WHERE mes_id = ?',
    [mes_id]
  ))
}

export function saveDeudaTC(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      'UPDATE deudas_tc SET nombre_tc=?, saldo=? WHERE id=?',
      [data.nombre_tc, data.saldo, data.id]
    )
  } else {
    db.run(
      'INSERT INTO deudas_tc (mes_id, nombre_tc, saldo) VALUES (?,?,?)',
      [data.mes_id, data.nombre_tc, data.saldo]
    )
  }
  guardarDb()
}

export function deleteDeudaTC(id: number): void {
  const db = getDb()
  db.run('DELETE FROM deudas_tc WHERE id = ?', [id])
  guardarDb()
}