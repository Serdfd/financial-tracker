import { getDb, guardarDb } from '../db'

function rowsToObjects(result: any[]): any[] {
  if (!result.length) return []
  const [{ columns, values }] = result
  return values.map((row: any[]) =>
    Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
  )
}

export function getInversiones(): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT inv.*,
       e.nombre as entidad_nombre,
       t.nombre as tipo_nombre,
       r.nombre as riesgo_nombre,
       r.color as riesgo_color,
       m.codigo as moneda_codigo,
       m.simbolo as moneda_simbolo,
       m.tasa_a_cop as tasa_a_cop
     FROM inversiones inv
     LEFT JOIN entidades e ON inv.entidad_id = e.id
     LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
     LEFT JOIN perfiles_riesgo r ON inv.riesgo_id = r.id
     LEFT JOIN monedas m ON inv.moneda_id = m.id
     WHERE inv.activo = 1
     ORDER BY inv.nombre`
  ))
}

export function saveInversion(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      `UPDATE inversiones SET nombre=?, entidad_id=?, tipo_id=?, riesgo_id=?,
       moneda_id=?, estado=?, fecha_inicio=?, notas=? WHERE id=?`,
      [data.nombre, data.entidad_id, data.tipo_id, data.riesgo_id,
       data.moneda_id, data.estado, data.fecha_inicio, data.notas, data.id]
    )
  } else {
    db.run(
      `INSERT INTO inversiones (nombre, entidad_id, tipo_id, riesgo_id, moneda_id, estado, fecha_inicio, notas)
       VALUES (?,?,?,?,?,?,?,?)`,
      [data.nombre, data.entidad_id, data.tipo_id, data.riesgo_id,
       data.moneda_id, data.estado || 'activo', data.fecha_inicio, data.notas]
    )
  }
  guardarDb()
}

export function deleteInversion(id: number): void {
  const db = getDb()
  db.run('UPDATE inversiones SET activo = 0 WHERE id = ?', [id])
  guardarDb()
}

export function getInversionMensual(inversion_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT im.*, m.anio, m.mes
     FROM inversion_mensual im
     JOIN meses m ON im.mes_id = m.id
     WHERE im.inversion_id = ?
     ORDER BY m.anio, m.mes`,
    [inversion_id]
  ))
}

export function getInversionMensualMes(mes_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    `SELECT im.*, inv.nombre as inversion_nombre, inv.id as inversion_id,
       r.color as riesgo_color, r.nombre as riesgo_nombre,
       t.nombre as tipo_nombre, mo.tasa_a_cop
     FROM inversion_mensual im
     JOIN inversiones inv ON im.inversion_id = inv.id
     LEFT JOIN perfiles_riesgo r ON inv.riesgo_id = r.id
     LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
     LEFT JOIN monedas mo ON inv.moneda_id = mo.id
     WHERE im.mes_id = ?`,
    [mes_id]
  ))
}

export function saveInversionMensual(data: any): void {
  const db = getDb()

  // Obtener saldo del mes anterior para calcular rendimiento
  const mesActual = rowsToObjects(db.exec(
    'SELECT anio, mes FROM meses WHERE id = ?', [data.mes_id]
  ))[0]

  let saldoAnterior = 0
  if (mesActual) {
    const mesAnteriorResult = rowsToObjects(db.exec(
      `SELECT im.saldo_cierre FROM inversion_mensual im
       JOIN meses m ON im.mes_id = m.id
       WHERE im.inversion_id = ?
         AND (m.anio * 12 + m.mes) < (? * 12 + ?)
       ORDER BY m.anio DESC, m.mes DESC LIMIT 1`,
      [data.inversion_id, mesActual.anio, mesActual.mes]
    ))
    saldoAnterior = mesAnteriorResult[0]?.saldo_cierre || 0
  }

  const rendimiento = data.saldo_cierre - saldoAnterior - (data.aportes || 0) + (data.retiros || 0)
  const rentabilidad_pct = saldoAnterior > 0 ? (rendimiento / saldoAnterior) * 100 : 0

  db.run(
    `INSERT INTO inversion_mensual (inversion_id, mes_id, saldo_cierre, aportes, retiros, rendimiento, rentabilidad_pct)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(inversion_id, mes_id) DO UPDATE SET
       saldo_cierre=excluded.saldo_cierre,
       aportes=excluded.aportes,
       retiros=excluded.retiros,
       rendimiento=excluded.rendimiento,
       rentabilidad_pct=excluded.rentabilidad_pct`,
    [data.inversion_id, data.mes_id, data.saldo_cierre,
     data.aportes || 0, data.retiros || 0, rendimiento, rentabilidad_pct]
  )
  guardarDb()
}

export function getInmueble(inversion_id: number): any {
  const db = getDb()
  const result = rowsToObjects(db.exec(
    'SELECT * FROM inmuebles WHERE inversion_id = ?', [inversion_id]
  ))
  return result[0] || null
}

export function saveInmueble(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      `UPDATE inmuebles SET precio_compra=?, valor_estimado_actual=?, cuota_mensual=?,
       cuotas_totales=?, cuotas_pagadas=?, fecha_entrega_estimada=?, estado=? WHERE id=?`,
      [data.precio_compra, data.valor_estimado_actual, data.cuota_mensual,
       data.cuotas_totales, data.cuotas_pagadas, data.fecha_entrega_estimada, data.estado, data.id]
    )
  } else {
    db.run(
      `INSERT INTO inmuebles (inversion_id, precio_compra, valor_estimado_actual, cuota_mensual,
       cuotas_totales, cuotas_pagadas, fecha_entrega_estimada, estado)
       VALUES (?,?,?,?,?,?,?,?)`,
      [data.inversion_id, data.precio_compra, data.valor_estimado_actual, data.cuota_mensual,
       data.cuotas_totales, data.cuotas_pagadas || 0, data.fecha_entrega_estimada, data.estado || 'en_construccion']
    )
  }
  guardarDb()
}