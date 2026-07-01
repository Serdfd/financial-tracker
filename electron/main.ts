
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabase } from './database/db'
import { getCatalogo, saveCatalogo, deleteCatalogo } from './database/queries/catalogos'
import { getMeses, getOrCreateMes, cerrarMes, getIngresosMes, saveIngresoMes, deleteIngresoMes, getGastosMes, saveGastoMes, deleteGastoMes, getDeudasTC, saveDeudaTC, deleteDeudaTC } from './database/queries/movimientos'
import { getInversiones, saveInversion, deleteInversion, getInversionMensual, getInversionMensualMes, saveInversionMensual, getInmueble, saveInmueble, getFichaInversion, saveFichaInversion, getAlertasCDT, getLotesInversion, saveLoteInversion, deleteLoteInversion, getResumenLotes } from './database/queries/inversiones'
import { getPresupuestoFijos, savePresupuestoFijo, deletePresupuestoFijo, getPresupuestoVariables, savePresupuestoVariable, deletePresupuestoVariable } from './database/queries/presupuesto'
import { actualizarTRM } from './services/trm'
import { getDb } from './database/db'
import { getParametros, saveParametro } from './database/queries/parametros'
import { getPagosInmueble, savePagoInmueble, deletePagoInmueble, getResumenPortafolio } from './database/queries/inversiones'
import { getPresupuestoCategorias, savePresupuestoCategoria, deletePresupuestoCategoria } from './database/queries/presupuesto'
import { saveTransaccionDetalle, getTransaccionesMes, deleteTransaccionesMes, updateTransaccionCategoria, buscarTransacciones } from './database/queries/transacciones'
import { getReglasCategorizacion, saveReglaCategorizacion, deleteReglaCategorizacion, aplicarReglasAMes } from './database/queries/reglas'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f172a',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  await initDatabase()
  registerIpcHandlers()
  createWindow()

  // Auto-actualizar TRM al iniciar
  actualizarTRM().then(r => {
    if (r.ok) console.log(`TRM actualizada: ${r.mensaje}`)
    else console.warn(`TRM no actualizada: ${r.mensaje}`)
  }).catch(() => {})

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── REGISTRO DE HANDLERS IPC ───────────────────────────
function registerIpcHandlers() {

  // Catálogos
  ipcMain.handle('getCatalogo', (_, tabla) => getCatalogo(tabla))
  ipcMain.handle('saveCatalogo', (_, tabla, data) => saveCatalogo(tabla, data))
  ipcMain.handle('deleteCatalogo', (_, tabla, id) => deleteCatalogo(tabla, id))

  // Meses
  ipcMain.handle('getMeses', () => getMeses())
  ipcMain.handle('getOrCreateMes', (_, anio, mes) => getOrCreateMes(anio, mes))
  ipcMain.handle('cerrarMes', (_, mes_id) => cerrarMes(mes_id))

  // Ingresos
  ipcMain.handle('getIngresosMes', (_, mes_id) => getIngresosMes(mes_id))
  ipcMain.handle('saveIngresoMes', (_, data) => saveIngresoMes(data))
  ipcMain.handle('deleteIngresoMes', (_, id) => deleteIngresoMes(id))

  // Gastos
  ipcMain.handle('getGastosMes', (_, mes_id) => getGastosMes(mes_id))
  ipcMain.handle('saveGastoMes', (_, data) => saveGastoMes(data))
  ipcMain.handle('deleteGastoMes', (_, id) => deleteGastoMes(id))

  ipcMain.handle('saveTransaccionDetalle', (_e, data: any) => saveTransaccionDetalle(data))
  ipcMain.handle('getTransaccionesMes', (_e, mes_id: number) => getTransaccionesMes(mes_id))
  ipcMain.handle('deleteTransaccionesMes', (_e, mes_id: number) => deleteTransaccionesMes(mes_id))
  ipcMain.handle('updateTransaccionCategoria', (_e, id: number, categoria_id: number | null) => updateTransaccionCategoria(id, categoria_id))
  ipcMain.handle('buscarTransacciones', (_e, filtros: any) => buscarTransacciones(filtros))

  // Reglas de categorización
  ipcMain.handle('getReglasCategorizacion', () => getReglasCategorizacion())
  ipcMain.handle('saveReglaCategorizacion', (_e, data: any) => saveReglaCategorizacion(data))
  ipcMain.handle('deleteReglaCategorizacion', (_e, id: number) => deleteReglaCategorizacion(id))
  ipcMain.handle('aplicarReglasAMes', (_e, mes_id: number) => aplicarReglasAMes(mes_id))

  // Deudas TC
  ipcMain.handle('getDeudasTC', (_, mes_id) => getDeudasTC(mes_id))
  ipcMain.handle('saveDeudaTC', (_, data) => saveDeudaTC(data))
  ipcMain.handle('deleteDeudaTC', (_, id) => deleteDeudaTC(id))

  // Inversiones
  ipcMain.handle('getInversiones', () => getInversiones())
  ipcMain.handle('saveInversion', (_, data) => saveInversion(data))
  ipcMain.handle('deleteInversion', (_, id) => deleteInversion(id))
  ipcMain.handle('getInversionMensual', (_, inversion_id) => getInversionMensual(inversion_id))
  ipcMain.handle('getInversionMensualMes', (_, mes_id) => getInversionMensualMes(mes_id))
  ipcMain.handle('saveInversionMensual', (_, data) => saveInversionMensual(data))

  // Inmuebles
  ipcMain.handle('getInmueble', (_, inversion_id) => getInmueble(inversion_id))
  ipcMain.handle('saveInmueble', (_, data) => saveInmueble(data))

  ipcMain.handle('getPagosInmueble', (_e, inmueble_id: number) => getPagosInmueble(inmueble_id))
  ipcMain.handle('savePagoInmueble', (_e, data: any) => savePagoInmueble(data))
  ipcMain.handle('deletePagoInmueble', (_e, id: number) => deletePagoInmueble(id))

  // Fichas técnicas
  ipcMain.handle('getFichaInversion', (_, inversion_id) => getFichaInversion(inversion_id))
  ipcMain.handle('saveFichaInversion', (_, data) => saveFichaInversion(data))

  // Alertas CDT
  ipcMain.handle('getAlertasCDT', () => getAlertasCDT())

  // Presupuesto
  ipcMain.handle('getPresupuestoFijos', () => getPresupuestoFijos())
  ipcMain.handle('savePresupuestoFijo', (_, data) => savePresupuestoFijo(data))
  ipcMain.handle('deletePresupuestoFijo', (_, id) => deletePresupuestoFijo(id))
  ipcMain.handle('getPresupuestoVariables', () => getPresupuestoVariables())
  ipcMain.handle('savePresupuestoVariable', (_, data) => savePresupuestoVariable(data))
  ipcMain.handle('deletePresupuestoVariable', (_, id) => deletePresupuestoVariable(id))
  ipcMain.handle('getPresupuestoCategorias', () => getPresupuestoCategorias())
  ipcMain.handle('savePresupuestoCategoria', (_e, data: any) => savePresupuestoCategoria(data))
  ipcMain.handle('deletePresupuestoCategoria', (_e, id: number) => deletePresupuestoCategoria(id))

  // TRM
  ipcMain.handle('actualizarTRM', () => actualizarTRM())

  ipcMain.handle('getParametros', () => getParametros())
  ipcMain.handle('saveParametro', (_e, clave: string, valor: string) => saveParametro(clave, valor))

  // Lotes de compra
  ipcMain.handle('getLotesInversion', (_, inversion_id) => getLotesInversion(inversion_id))
  ipcMain.handle('saveLoteInversion', (_, data) => saveLoteInversion(data))
  ipcMain.handle('deleteLoteInversion', (_, id) => deleteLoteInversion(id))
  ipcMain.handle('getResumenLotes', (_, inversion_id) => getResumenLotes(inversion_id))

  ipcMain.handle('getResumenPortafolio', () => getResumenPortafolio())

  // Dashboard
  ipcMain.handle('getDashboardData', (_, anio, mes) => {
    const db = getDb()

    function rowsToObjects(result: any[]): any[] {
      if (!result.length) return []
      const [{ columns, values }] = result
      return values.map((row: any[]) =>
        Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
      )
    }

    const mesActual = rowsToObjects(db.exec(
      'SELECT * FROM meses WHERE anio = ? AND mes = ?', [anio, mes]
    ))[0]

    if (!mesActual) return {
      ingresos: 0, gastos: 0, rendimientos: 0,
      patrimonioNeto: 0, deudasTC: 0,
      ultimos6Meses: [], ultimos12Meses: [],
      distribucionInversiones: [], distribucionTipos: [], distribucionRiesgo: []
    }

    const ingresosResult = rowsToObjects(db.exec(
      `SELECT COALESCE(SUM(i.monto * m.tasa_a_cop), 0) as total
       FROM ingresos_mes i LEFT JOIN monedas m ON i.moneda_id = m.id WHERE i.mes_id = ?`, [mesActual.id]
    ))
    const ingresos = ingresosResult[0]?.total || 0

    const gastosResult = rowsToObjects(db.exec(
      `SELECT COALESCE(SUM(g.monto * m.tasa_a_cop), 0) as total
       FROM gastos_mes g LEFT JOIN monedas m ON g.moneda_id = m.id WHERE g.mes_id = ?`, [mesActual.id]
    ))
    const gastos = gastosResult[0]?.total || 0

    const rendimientosResult = rowsToObjects(db.exec(
      `SELECT COALESCE(SUM(im.rendimiento * mo.tasa_a_cop), 0) as total
       FROM inversion_mensual im JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ? AND (inv.es_cuenta = 0 OR inv.es_cuenta IS NULL)`, [mesActual.id]
    ))
    const rendimientos = rendimientosResult[0]?.total || 0

    const deudasResult = rowsToObjects(db.exec(
      'SELECT COALESCE(SUM(saldo), 0) as total FROM deudas_tc WHERE mes_id = ?', [mesActual.id]
    ))
    const deudasTC = deudasResult[0]?.total || 0

    // Inversiones financieras (excluyendo inmuebles)
    const patrimonioInvResult = rowsToObjects(db.exec(
      `SELECT COALESCE(SUM(im.saldo_cierre * mo.tasa_a_cop), 0) as total
       FROM inversion_mensual im
       JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ? AND LOWER(t.nombre) != 'inmueble'`, [mesActual.id]
    ))
    const patrimonioInversiones = patrimonioInvResult[0]?.total || 0

    // Inmuebles — suma valor_estimado_actual de todos los inmuebles activos
    const patrimonioInmResult = rowsToObjects(db.exec(
      `SELECT COALESCE(SUM(inm.valor_estimado_actual), 0) as total
       FROM inmuebles inm
       JOIN inversiones inv ON inm.inversion_id = inv.id
       WHERE inv.activo = 1
         AND inm.valor_estimado_actual IS NOT NULL
         AND inm.valor_estimado_actual > 0`
    ))
    const patrimonioInmuebles = patrimonioInmResult[0]?.total || 0

    const patrimonioNeto = patrimonioInversiones + patrimonioInmuebles - deudasTC

    const ultimos6Meses = rowsToObjects(db.exec(
      `SELECT m.anio, m.mes,
         COALESCE((SELECT SUM(i.monto * mo.tasa_a_cop) FROM ingresos_mes i
                   LEFT JOIN monedas mo ON i.moneda_id = mo.id WHERE i.mes_id = m.id), 0) as ingresos,
         COALESCE((SELECT SUM(g.monto * mo.tasa_a_cop) FROM gastos_mes g
                   LEFT JOIN monedas mo ON g.moneda_id = mo.id WHERE g.mes_id = m.id), 0) as gastos
       FROM meses m WHERE (m.anio * 12 + m.mes) <= (? * 12 + ?)
       ORDER BY m.anio DESC, m.mes DESC LIMIT 6`, [anio, mes]
    )).reverse()

    // ultimos12Meses — incluye inmuebles en el patrimonio histórico
    const ultimos12Meses = rowsToObjects(db.exec(
      `SELECT m.anio, m.mes,
         COALESCE((SELECT SUM(im.saldo_cierre * mo.tasa_a_cop)
                   FROM inversion_mensual im JOIN inversiones inv ON im.inversion_id = inv.id
                   LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
                   LEFT JOIN monedas mo ON inv.moneda_id = mo.id
                   WHERE im.mes_id = m.id AND LOWER(t.nombre) != 'inmueble'), 0) +
         COALESCE((SELECT SUM(inm.valor_estimado_actual)
                   FROM inmuebles inm JOIN inversiones inv ON inm.inversion_id = inv.id
                   WHERE inv.activo = 1
                     AND inm.valor_estimado_actual IS NOT NULL
                     AND inm.valor_estimado_actual > 0), 0) -
         COALESCE((SELECT SUM(saldo) FROM deudas_tc WHERE mes_id = m.id), 0) as patrimonio
       FROM meses m WHERE (m.anio * 12 + m.mes) <= (? * 12 + ?)
       ORDER BY m.anio DESC, m.mes DESC LIMIT 12`, [anio, mes]
    )).reverse()

    const distribucionInversiones = rowsToObjects(db.exec(
      `SELECT inv.nombre, im.saldo_cierre * mo.tasa_a_cop as valor
       FROM inversion_mensual im JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ? AND im.saldo_cierre > 0
         AND (inv.es_cuenta = 0 OR inv.es_cuenta IS NULL)`, [mesActual.id]
    ))

    const distribucionTipos = rowsToObjects(db.exec(
      `SELECT t.nombre as tipo, SUM(im.saldo_cierre * mo.tasa_a_cop) as valor
       FROM inversion_mensual im JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ? AND im.saldo_cierre > 0
         AND (inv.es_cuenta = 0 OR inv.es_cuenta IS NULL)
       GROUP BY t.nombre`, [mesActual.id]
    ))

    const distribucionRiesgo = rowsToObjects(db.exec(
      `SELECT r.nombre as riesgo, r.color, SUM(im.saldo_cierre * mo.tasa_a_cop) as valor
       FROM inversion_mensual im JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN perfiles_riesgo r ON inv.riesgo_id = r.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ? AND im.saldo_cierre > 0
         AND (inv.es_cuenta = 0 OR inv.es_cuenta IS NULL)
       GROUP BY r.nombre, r.color`, [mesActual.id]
    ))

    return {
      ingresos, gastos, rendimientos, patrimonioNeto,
      patrimonioInversiones, patrimonioInmuebles,
      deudasTC,
      ultimos6Meses, ultimos12Meses,
      distribucionInversiones, distribucionTipos, distribucionRiesgo
    }
  })

  // Exportar CSV
  ipcMain.handle('exportarCSV', async (_e, { filas, nombreSugerido }: { filas: string[][], nombreSugerido: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar CSV',
      defaultPath: nombreSugerido,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return { ok: false }
    const contenido = filas.map(fila =>
      fila.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n')
    fs.writeFileSync(filePath, '\uFEFF' + contenido, 'utf8') // BOM para Excel
    return { ok: true, filePath }
  })

  // ── CUADRE MENSUAL ────────────────────────────────────
  ipcMain.handle('getCuadreMensual', (_, anio: number, mes: number) => {
    const db = getDb()

    function r2o(result: any[]): any[] {
      if (!result.length) return []
      const [{ columns, values }] = result
      return values.map((row: any[]) =>
        Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
      )
    }

    const mesActual = r2o(db.exec('SELECT * FROM meses WHERE anio = ? AND mes = ?', [anio, mes]))[0]
    if (!mesActual) return null

    const ingresos = r2o(db.exec(
      `SELECT COALESCE(SUM(i.monto * COALESCE(m.tasa_a_cop, 1)), 0) as total
       FROM ingresos_mes i LEFT JOIN monedas m ON i.moneda_id = m.id WHERE i.mes_id = ?`,
      [mesActual.id]
    ))[0]?.total || 0

    const gastos = r2o(db.exec(
      `SELECT COALESCE(SUM(g.monto * COALESCE(m.tasa_a_cop, 1)), 0) as total
       FROM gastos_mes g LEFT JOIN monedas m ON g.moneda_id = m.id WHERE g.mes_id = ?`,
      [mesActual.id]
    ))[0]?.total || 0

    // Rendimientos excluye cuentas e inmuebles (no generan rendimiento real)
    const rendimientos = r2o(db.exec(
      `SELECT COALESCE(SUM(im.rendimiento * COALESCE(mo.tasa_a_cop, 1)), 0) as total
       FROM inversion_mensual im
       JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ?
         AND (inv.es_cuenta = 0 OR inv.es_cuenta IS NULL)
         AND LOWER(COALESCE(t.nombre,'')) != 'inmueble'`,
      [mesActual.id]
    ))[0]?.total || 0

    const crecimientoTeorico = ingresos - gastos + rendimientos

    // Saldos actuales de todas las inversiones activas (excl. inmuebles)
    const saldosActuales = r2o(db.exec(
      `SELECT inv.id as inversion_id, inv.nombre, inv.es_cuenta,
         COALESCE(im.saldo_cierre, 0) * COALESCE(mo.tasa_a_cop, 1) as saldo_cop,
         t.nombre as tipo_nombre
       FROM inversiones inv
       LEFT JOIN inversion_mensual im ON im.inversion_id = inv.id AND im.mes_id = ?
       LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE inv.activo = 1
         AND LOWER(COALESCE(t.nombre,'')) != 'inmueble'`,
      [mesActual.id]
    ))

    // Saldo más reciente anterior al mes actual, por inversión (excl. inmuebles)
    const saldosAnteriores = r2o(db.exec(
      `SELECT im.inversion_id,
         im.saldo_cierre * COALESCE(mo.tasa_a_cop, 1) as saldo_cop
       FROM inversion_mensual im
       JOIN meses m ON im.mes_id = m.id
       JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE LOWER(COALESCE(t.nombre,'')) != 'inmueble'
         AND (m.anio * 12 + m.mes) < (? * 12 + ?)
         AND (m.anio * 12 + m.mes) = (
           SELECT MAX(m2.anio * 12 + m2.mes)
           FROM inversion_mensual im2
           JOIN meses m2 ON im2.mes_id = m2.id
           WHERE im2.inversion_id = im.inversion_id
             AND (m2.anio * 12 + m2.mes) < (? * 12 + ?)
         )`,
      [anio, mes, anio, mes]
    ))

    const mapAnteriores: Record<number, number> = {}
    saldosAnteriores.forEach((s: any) => { mapAnteriores[s.inversion_id] = s.saldo_cop })

    const detalle = saldosActuales
      .filter((s: any) => (s.saldo_cop || 0) > 0 || (mapAnteriores[s.inversion_id] || 0) > 0)
      .map((s: any) => ({
        inversion_id: s.inversion_id,
        nombre: s.nombre,
        es_cuenta: s.es_cuenta,
        tipo_nombre: s.tipo_nombre,
        saldo_anterior: mapAnteriores[s.inversion_id] || 0,
        saldo_actual: s.saldo_cop || 0,
        delta: (s.saldo_cop || 0) - (mapAnteriores[s.inversion_id] || 0)
      }))

    const totalSaldosActuales = detalle.reduce((s: number, d: any) => s + d.saldo_actual, 0)
    const totalSaldosAnteriores = detalle.reduce((s: number, d: any) => s + d.saldo_anterior, 0)
    const deltaSaldos = totalSaldosActuales - totalSaldosAnteriores

    const deudasActuales = r2o(db.exec(
      `SELECT COALESCE(SUM(saldo), 0) as total FROM deudas_tc WHERE mes_id = ?`,
      [mesActual.id]
    ))[0]?.total || 0

    const mesAntNum = mes === 1 ? 12 : mes - 1
    const anioAntNum = mes === 1 ? anio - 1 : anio
    const mesAnteriorRow = r2o(db.exec('SELECT id FROM meses WHERE anio = ? AND mes = ?', [anioAntNum, mesAntNum]))[0]
    const deudasAnteriores = mesAnteriorRow ? (r2o(db.exec(
      `SELECT COALESCE(SUM(saldo), 0) as total FROM deudas_tc WHERE mes_id = ?`,
      [mesAnteriorRow.id]
    ))[0]?.total || 0) : 0

    const deltaDeudas = deudasActuales - deudasAnteriores
    const crecimientoReal = deltaSaldos - deltaDeudas
    const diferencia = crecimientoTeorico - crecimientoReal

    return {
      ingresos, gastos, rendimientos, crecimientoTeorico,
      deltaSaldos, totalSaldosActuales, totalSaldosAnteriores,
      deltaDeudas, deudasActuales, deudasAnteriores,
      crecimientoReal, diferencia,
      detalle
    }
  })
}