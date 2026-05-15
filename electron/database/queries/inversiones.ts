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

export function saveInversion(data: any): any {
  const db = getDb()
  let inversionId = data.id

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
    const lastId = rowsToObjects(db.exec('SELECT last_insert_rowid() as id'))
    inversionId = lastId[0]?.id

    // Saldo inicial OPCIONAL: se guarda en el mes ANTERIOR como punto de partida
    if (data.saldo_inicial && data.saldo_inicial > 0 && inversionId) {
      const fechaInicio = data.fecha_inicio ? new Date(data.fecha_inicio) : new Date()

      let anioAnterior = fechaInicio.getFullYear()
      let mesAnterior = fechaInicio.getMonth() // 0-based = mes anterior al de inicio

      if (mesAnterior === 0) {
        mesAnterior = 12
        anioAnterior -= 1
      }

      db.run('INSERT OR IGNORE INTO meses (anio, mes) VALUES (?, ?)', [anioAnterior, mesAnterior])
      const mesResult = rowsToObjects(db.exec(
        'SELECT id FROM meses WHERE anio = ? AND mes = ?', [anioAnterior, mesAnterior]
      ))
      const mesId = mesResult[0]?.id

      if (mesId) {
        db.run(
          `INSERT INTO inversion_mensual (inversion_id, mes_id, saldo_cierre, aportes, retiros, rendimiento, rentabilidad_pct)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(inversion_id, mes_id) DO UPDATE SET
             saldo_cierre=excluded.saldo_cierre`,
          [inversionId, mesId, data.saldo_inicial, 0, 0, 0, 0]
        )
      }
    }
  }

  guardarDb()
  return { id: inversionId }
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

  const mesActual = rowsToObjects(db.exec(
    'SELECT anio, mes FROM meses WHERE id = ?', [data.mes_id]
  ))[0]

  console.log('mesActual:', mesActual)

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

// ── INMUEBLES ──────────────────────────────────────────

export function getInmueble(inversion_id: number): any {
  const db = getDb()
  const result = rowsToObjects(db.exec(
    `SELECT inm.*, e.nombre as financiacion_entidad_nombre
     FROM inmuebles inm
     LEFT JOIN entidades e ON inm.financiacion_entidad_id = e.id
     WHERE inm.inversion_id = ?`, [inversion_id]
  ))
  return result[0] || null
}

export function saveInmueble(data: any): void {
  const db = getDb()
  const v = (val: any) => val === undefined || val === '' ? null : val

  if (data.id) {
    db.run(
      `UPDATE inmuebles SET
        precio_compra_total=?, valor_estimado_actual=?, estado=?, fecha_entrega_estimada=?,
        tipo_precio=?, smlv_pactados=?,
        monto_separacion=?,
        cuota_inicial_total=?, cuota_inicial_num_cuotas=?,
        financiacion_entidad_id=?, financiacion_monto=?, financiacion_plazo_meses=?
       WHERE id=?`,
      [
        data.precio_compra_total, v(data.valor_estimado_actual),
        data.estado || 'en_construccion', v(data.fecha_entrega_estimada),
        data.tipo_precio || 'fijo', data.smlv_pactados || 0,
        data.monto_separacion || 0,
        data.cuota_inicial_total || 0, data.cuota_inicial_num_cuotas || 0,
        v(data.financiacion_entidad_id), data.financiacion_monto || 0,
        data.financiacion_plazo_meses || 0,
        data.id
      ]
    )
  } else {
    db.run(
      `INSERT INTO inmuebles (
        inversion_id, precio_compra_total, valor_estimado_actual, estado, fecha_entrega_estimada,
        tipo_precio, smlv_pactados,
        monto_separacion,
        cuota_inicial_total, cuota_inicial_num_cuotas,
        financiacion_entidad_id, financiacion_monto, financiacion_plazo_meses)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.inversion_id, data.precio_compra_total, v(data.valor_estimado_actual),
        data.estado || 'en_construccion', v(data.fecha_entrega_estimada),
        data.tipo_precio || 'fijo', data.smlv_pactados || 0,
        data.monto_separacion || 0,
        data.cuota_inicial_total || 0, data.cuota_inicial_num_cuotas || 0,
        v(data.financiacion_entidad_id), data.financiacion_monto || 0,
        data.financiacion_plazo_meses || 0
      ]
    )
  }
  guardarDb()
}

// ── FICHAS TÉCNICAS ────────────────────────────────────

export function getFichaInversion(inversion_id: number): any {
  const db = getDb()
  const result = rowsToObjects(db.exec(
    'SELECT * FROM fichas_inversion WHERE inversion_id = ?', [inversion_id]
  ))
  return result[0] || null
}

export function saveFichaInversion(data: any): void {
  const db = getDb()
  const v = (val: any) => val === undefined || val === '' ? null : val

  const existing = rowsToObjects(db.exec(
    'SELECT id FROM fichas_inversion WHERE inversion_id = ?', [data.inversion_id]
  ))

  if (existing.length > 0) {
    db.run(
      `UPDATE fichas_inversion SET
        tasa_ea=?, plazo_dias=?, retencion_pct=?,
        mercado=?, ticker=?, token_symbol=?
       WHERE inversion_id=?`,
      [v(data.tasa_ea), v(data.plazo_dias), v(data.retencion_pct) ?? 4,
       v(data.mercado), v(data.ticker), v(data.token_symbol),
       data.inversion_id]
    )
  } else {
    db.run(
      `INSERT INTO fichas_inversion (
        inversion_id, tasa_ea, plazo_dias, retencion_pct,
        mercado, ticker, token_symbol)
       VALUES (?,?,?,?,?,?,?)`,
      [data.inversion_id, v(data.tasa_ea), v(data.plazo_dias), v(data.retencion_pct) ?? 4,
       v(data.mercado), v(data.ticker), v(data.token_symbol)]
    )
  }
  guardarDb()
}

// ── LOTES DE COMPRA ────────────────────────────────────

export function getLotesInversion(inversion_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    'SELECT * FROM lotes_inversion WHERE inversion_id = ? ORDER BY fecha_compra DESC',
    [inversion_id]
  ))
}

export function saveLoteInversion(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      `UPDATE lotes_inversion SET fecha_compra=?, cantidad=?, precio_unitario=?, comision=?, nota=? WHERE id=?`,
      [data.fecha_compra, data.cantidad, data.precio_unitario, data.comision || 0, data.nota || null, data.id]
    )
  } else {
    db.run(
      `INSERT INTO lotes_inversion (inversion_id, fecha_compra, cantidad, precio_unitario, comision, nota)
       VALUES (?,?,?,?,?,?)`,
      [data.inversion_id, data.fecha_compra, data.cantidad, data.precio_unitario, data.comision || 0, data.nota || null]
    )
  }
  guardarDb()
}

export function deleteLoteInversion(id: number): void {
  const db = getDb()
  db.run('DELETE FROM lotes_inversion WHERE id = ?', [id])
  guardarDb()
}

export function getResumenLotes(inversion_id: number): any {
  const db = getDb()
  const result = rowsToObjects(db.exec(
    `SELECT
       COALESCE(SUM(cantidad), 0) as total_unidades,
       COALESCE(SUM(cantidad * precio_unitario), 0) as costo_sin_comision,
       COALESCE(SUM(comision), 0) as total_comisiones,
       COALESCE(SUM(cantidad * precio_unitario) + SUM(comision), 0) as costo_total,
       CASE WHEN SUM(cantidad) > 0
         THEN SUM(cantidad * precio_unitario) / SUM(cantidad)
         ELSE 0 END as precio_promedio
     FROM lotes_inversion WHERE inversion_id = ?`,
    [inversion_id]
  ))
  return result[0] || { total_unidades: 0, costo_sin_comision: 0, total_comisiones: 0, costo_total: 0, precio_promedio: 0 }
}

// ── ALERTAS CDT ────────────────────────────────────────

export function getAlertasCDT(): any[] {
  const db = getDb()
  const hoy = new Date().toISOString().split('T')[0]
  // La fecha de vencimiento se calcula en el frontend: fecha_inicio + plazo_dias
  // Aquí calculamos con SQL para la alerta
  return rowsToObjects(db.exec(
    `SELECT inv.nombre, inv.id as inversion_id, inv.fecha_inicio,
       e.nombre as entidad_nombre,
       f.tasa_ea, f.plazo_dias, f.retencion_pct,
       date(inv.fecha_inicio, '+' || f.plazo_dias || ' days') as fecha_vencimiento,
       julianday(date(inv.fecha_inicio, '+' || f.plazo_dias || ' days')) - julianday(?) as dias_restantes
     FROM fichas_inversion f
     JOIN inversiones inv ON f.inversion_id = inv.id
     LEFT JOIN entidades e ON inv.entidad_id = e.id
     LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
     WHERE inv.activo = 1
       AND t.nombre = 'CDT'
       AND inv.fecha_inicio IS NOT NULL
       AND f.plazo_dias IS NOT NULL
       AND julianday(date(inv.fecha_inicio, '+' || f.plazo_dias || ' days')) - julianday(?) BETWEEN -7 AND 30
     ORDER BY fecha_vencimiento`,
    [hoy, hoy]
  ))
}

// ── PAGOS INMUEBLE ──────────────────────────────────────
export function getPagosInmueble(inmueble_id: number): any[] {
  const db = getDb()
  return rowsToObjects(db.exec(
    'SELECT * FROM pagos_inmueble WHERE inmueble_id = ? ORDER BY fecha DESC',
    [inmueble_id]
  ))
}

export function savePagoInmueble(data: any): void {
  const db = getDb()
  if (data.id) {
    db.run(
      'UPDATE pagos_inmueble SET fecha=?, monto=?, etapa=?, nota=? WHERE id=?',
      [data.fecha, data.monto, data.etapa, data.nota || null, data.id]
    )
  } else {
    db.run(
      'INSERT INTO pagos_inmueble (inmueble_id, fecha, monto, etapa, nota) VALUES (?,?,?,?,?)',
      [data.inmueble_id, data.fecha, data.monto, data.etapa, data.nota || null]
    )
  }
  guardarDb()
}

export function deletePagoInmueble(id: number): void {
  const db = getDb()
  db.run('DELETE FROM pagos_inmueble WHERE id=?', [id])
  guardarDb()
}