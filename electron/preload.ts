import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {

  // Catálogos
  getCatalogo: (tabla: string) => ipcRenderer.invoke('getCatalogo', tabla),
  saveCatalogo: (tabla: string, data: any) => ipcRenderer.invoke('saveCatalogo', tabla, data),
  deleteCatalogo: (tabla: string, id: number) => ipcRenderer.invoke('deleteCatalogo', tabla, id),

  // Meses
  getMeses: () => ipcRenderer.invoke('getMeses'),
  getOrCreateMes: (anio: number, mes: number) => ipcRenderer.invoke('getOrCreateMes', anio, mes),
  cerrarMes: (mes_id: number) => ipcRenderer.invoke('cerrarMes', mes_id),

  // Ingresos
  getIngresosMes: (mes_id: number) => ipcRenderer.invoke('getIngresosMes', mes_id),
  saveIngresoMes: (data: any) => ipcRenderer.invoke('saveIngresoMes', data),
  deleteIngresoMes: (id: number) => ipcRenderer.invoke('deleteIngresoMes', id),

  // Gastos
  getGastosMes: (mes_id: number) => ipcRenderer.invoke('getGastosMes', mes_id),
  saveGastoMes: (data: any) => ipcRenderer.invoke('saveGastoMes', data),
  deleteGastoMes: (id: number) => ipcRenderer.invoke('deleteGastoMes', id),

  // Deudas TC
  getDeudasTC: (mes_id: number) => ipcRenderer.invoke('getDeudasTC', mes_id),
  saveDeudaTC: (data: any) => ipcRenderer.invoke('saveDeudaTC', data),
  deleteDeudaTC: (id: number) => ipcRenderer.invoke('deleteDeudaTC', id),

  // Inversiones
  getInversiones: () => ipcRenderer.invoke('getInversiones'),
  saveInversion: (data: any) => ipcRenderer.invoke('saveInversion', data),
  deleteInversion: (id: number) => ipcRenderer.invoke('deleteInversion', id),
  getInversionMensual: (inversion_id: number) => ipcRenderer.invoke('getInversionMensual', inversion_id),
  getInversionMensualMes: (mes_id: number) => ipcRenderer.invoke('getInversionMensualMes', mes_id),
  saveInversionMensual: (data: any) => ipcRenderer.invoke('saveInversionMensual', data),

  // Inmuebles
  getInmueble: (inversion_id: number) => ipcRenderer.invoke('getInmueble', inversion_id),
  saveInmueble: (data: any) => ipcRenderer.invoke('saveInmueble', data),

  // Fichas técnicas
  getFichaInversion: (inversion_id: number) => ipcRenderer.invoke('getFichaInversion', inversion_id),
  saveFichaInversion: (data: any) => ipcRenderer.invoke('saveFichaInversion', data),

  // Alertas CDT
  getAlertasCDT: () => ipcRenderer.invoke('getAlertasCDT'),

  // Lotes de compra
  getLotesInversion: (inversion_id: number) => ipcRenderer.invoke('getLotesInversion', inversion_id),
  saveLoteInversion: (data: any) => ipcRenderer.invoke('saveLoteInversion', data),
  deleteLoteInversion: (id: number) => ipcRenderer.invoke('deleteLoteInversion', id),
  getResumenLotes: (inversion_id: number) => ipcRenderer.invoke('getResumenLotes', inversion_id),

  // Presupuesto
  getPresupuestoFijos: () => ipcRenderer.invoke('getPresupuestoFijos'),
  savePresupuestoFijo: (data: any) => ipcRenderer.invoke('savePresupuestoFijo', data),
  deletePresupuestoFijo: (id: number) => ipcRenderer.invoke('deletePresupuestoFijo', id),
  getPresupuestoVariables: () => ipcRenderer.invoke('getPresupuestoVariables'),
  savePresupuestoVariable: (data: any) => ipcRenderer.invoke('savePresupuestoVariable', data),
  deletePresupuestoVariable: (id: number) => ipcRenderer.invoke('deletePresupuestoVariable', id),

  // TRM
  actualizarTRM: () => ipcRenderer.invoke('actualizarTRM'),

  // Dashboard
  getDashboardData: (anio: number, mes: number) => ipcRenderer.invoke('getDashboardData', anio, mes),
})