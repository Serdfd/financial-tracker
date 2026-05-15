
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { initDatabase } from './database/db'
import { getCatalogo, saveCatalogo, deleteCatalogo } from './database/queries/catalogos'
import { getMeses, getOrCreateMes, cerrarMes, getIngresosMes, saveIngresoMes, deleteIngresoMes, getGastosMes, saveGastoMes, deleteGastoMes, getDeudasTC, saveDeudaTC, deleteDeudaTC } from './database/queries/movimientos'
import { getInversiones, saveInversion, deleteInversion, getInversionMensual, getInversionMensualMes, saveInversionMensual, getInmueble, saveInmueble, getFichaInversion, saveFichaInversion, getAlertasCDT, getLotesInversion, saveLoteInversion, deleteLoteInversion, getResumenLotes } from './database/queries/inversiones'
import { getPresupuestoFijos, savePresupuestoFijo, deletePresupuestoFijo, getPresupuestoVariables, savePresupuestoVariable, deletePresupuestoVariable } from './database/queries/presupuesto'
import { actualizarTRM } from './services/trm'
import { getDb } from './database/db'
import { getParametros, saveParametro } from './database/queries/parametros'
import { getPagosInmueble, savePagoInmueble, deletePagoInmueble } from './database/queries/inversiones'
import { getPresupuestoCategorias, savePresupuestoCategoria, deletePresupuestoCategoria } from './database/queries/presupuesto'

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
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id WHERE im.mes_id = ?`, [mesActual.id]
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
       WHERE im.mes_id = ? AND im.saldo_cierre > 0`, [mesActual.id]
    ))

    const distribucionTipos = rowsToObjects(db.exec(
      `SELECT t.nombre as tipo, SUM(im.saldo_cierre * mo.tasa_a_cop) as valor
       FROM inversion_mensual im JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN tipos_inversion t ON inv.tipo_id = t.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ? AND im.saldo_cierre > 0 GROUP BY t.nombre`, [mesActual.id]
    ))

    const distribucionRiesgo = rowsToObjects(db.exec(
      `SELECT r.nombre as riesgo, r.color, SUM(im.saldo_cierre * mo.tasa_a_cop) as valor
       FROM inversion_mensual im JOIN inversiones inv ON im.inversion_id = inv.id
       LEFT JOIN perfiles_riesgo r ON inv.riesgo_id = r.id
       LEFT JOIN monedas mo ON inv.moneda_id = mo.id
       WHERE im.mes_id = ? AND im.saldo_cierre > 0 GROUP BY r.nombre, r.color`, [mesActual.id]
    ))

    return {
      ingresos, gastos, rendimientos, patrimonioNeto,
      patrimonioInversiones, patrimonioInmuebles,
      deudasTC,
      ultimos6Meses, ultimos12Meses,
      distribucionInversiones, distribucionTipos, distribucionRiesgo
    }
  })
}