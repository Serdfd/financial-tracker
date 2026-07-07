import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

export function getMetas(): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT * FROM metas_ahorro WHERE activo = 1 ORDER BY fecha_inicio DESC`
  ))
}

export function saveMeta(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      `UPDATE metas_ahorro SET nombre=?, descripcion=?, fecha_inicio=?, fecha_fin=?, periodicidad=?, monto_periodo=? WHERE id=?`,
      [data.nombre, data.descripcion || null, data.fecha_inicio, data.fecha_fin || null, data.periodicidad, data.monto_periodo, data.id]
    )
  } else {
    db.run(
      `INSERT INTO metas_ahorro (nombre, descripcion, fecha_inicio, fecha_fin, periodicidad, monto_periodo) VALUES (?,?,?,?,?,?)`,
      [data.nombre, data.descripcion || null, data.fecha_inicio, data.fecha_fin || null, data.periodicidad, data.monto_periodo]
    )
  }
  guardarDb()
}

export function deleteMeta(id: number): void {
  const db = getDb()
  db.run(`UPDATE metas_ahorro SET activo = 0 WHERE id = ?`, [id])
  guardarDb()
}

export function getMetaInversiones(meta_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT mi.inversion_id, i.nombre, e.nombre as entidad_nombre
     FROM meta_inversiones mi
     JOIN inversiones i ON i.id = mi.inversion_id
     LEFT JOIN entidades e ON e.id = i.entidad_id
     WHERE mi.meta_id = ?`,
    [meta_id]
  ))
}

export function setMetaInversiones(meta_id: number, inversion_ids: number[]): void {
  const db = getDb()
  db.run(`DELETE FROM meta_inversiones WHERE meta_id = ?`, [meta_id])
  for (const inv_id of inversion_ids) {
    db.run(`INSERT OR IGNORE INTO meta_inversiones (meta_id, inversion_id) VALUES (?,?)`, [meta_id, inv_id])
  }
  guardarDb()
}

export function getAportesMeta(meta_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT * FROM aportes_meta WHERE meta_id = ? ORDER BY fecha ASC`,
    [meta_id]
  ))
}

export function saveAporteMeta(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      `UPDATE aportes_meta SET monto=?, notas=? WHERE id=?`,
      [data.monto, data.notas || null, data.id]
    )
  } else {
    db.run(
      `INSERT OR REPLACE INTO aportes_meta (meta_id, fecha, monto, notas) VALUES (?,?,?,?)`,
      [data.meta_id, data.fecha, data.monto, data.notas || null]
    )
  }
  guardarDb()
}

export function deleteAporteMeta(id: number): void {
  const db = getDb()
  db.run(`DELETE FROM aportes_meta WHERE id = ?`, [id])
  guardarDb()
}

export function getRendimientosMetaInversiones(meta_id: number): number {
  const db = getDb()

  // Query 1: suma del último saldo cerrado de cada inversión vinculada (en COP)
  const saldoResult = rowsToObjects(db.exec(
    `SELECT COALESCE(SUM(
       (SELECT im.saldo_cierre
        FROM inversion_mensual im
        JOIN meses m ON m.id = im.mes_id
        WHERE im.inversion_id = mi.inversion_id AND im.saldo_cierre > 0
        ORDER BY m.anio DESC, m.mes DESC LIMIT 1
       ) * COALESCE(mo.tasa_a_cop, 1)
     ), 0) as total
     FROM meta_inversiones mi
     JOIN inversiones inv ON inv.id = mi.inversion_id
     LEFT JOIN monedas mo ON mo.id = inv.moneda_id
     WHERE mi.meta_id = ?`,
    [meta_id]
  ))
  const saldoTotal: number = saldoResult[0]?.total || 0

  // Query 2: último mes cerrado (anio*12+mes) entre las inversiones vinculadas
  const latestMonthResult = rowsToObjects(db.exec(
    `SELECT MAX(m.anio * 12 + m.mes) as latest_month
     FROM meta_inversiones mi
     JOIN inversion_mensual im ON im.inversion_id = mi.inversion_id
     JOIN meses m ON m.id = im.mes_id
     WHERE mi.meta_id = ? AND im.saldo_cierre > 0`,
    [meta_id]
  ))
  const latestMonth: number = latestMonthResult[0]?.latest_month || 0

  // Query 3: aportes registrados en la meta hasta ese último mes cerrado
  // (excluye aportes de meses que aún no tienen saldo de cierre en las inversiones)
  const aportesResult = rowsToObjects(db.exec(
    `SELECT COALESCE(SUM(monto), 0) as total
     FROM aportes_meta
     WHERE meta_id = ?
       AND CAST(SUBSTR(fecha, 1, 4) AS INTEGER) * 12 + CAST(SUBSTR(fecha, 6, 2) AS INTEGER) <= ?`,
    [meta_id, latestMonth]
  ))
  const aportesTotal: number = aportesResult[0]?.total || 0

  return saldoTotal - aportesTotal
}
