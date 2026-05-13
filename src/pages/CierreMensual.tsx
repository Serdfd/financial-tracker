import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Save, Lock, Upload, CheckCircle, AlertCircle, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { Mes, IngresoMes, GastoMes, DeudaTC, InversionMensual, Inversion } from '@/types'
import { formatCOP, formatPct, MESES_NOMBRES } from '@/lib/format'

type Tab = 'ingresos' | 'gastos' | 'inversiones' | 'deudas'

export function CierreMensual() {
  const { mesActivo, anioActivo, setMesActivo, categorias, monedas } = useAppStore()
  const [tab, setTab] = useState<Tab>('ingresos')
  const [mes, setMes] = useState<Mes | null>(null)
  const [ingresos, setIngresos] = useState<IngresoMes[]>([])
  const [gastos, setGastos] = useState<GastoMes[]>([])
  const [deudas, setDeudas] = useState<DeudaTC[]>([])
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [invMensual, setInvMensual] = useState<Record<number, InversionMensual>>({})
  const [guardando, setGuardando] = useState(false)

  // ── IMPORTACIÓN CSV ──────────────────────────────────
  const inputCsvRef = useRef<HTMLInputElement>(null)
  const [modalCsv, setModalCsv] = useState(false)
  const [csvRows, setCsvRows] = useState<{
    nombre: string
    monto: number
    categoria_id: number | null  // null = no encontrada
    omitir: boolean
  }[]>([])
  const [importando, setImportando] = useState(false)

  function fixEncoding(str: string): string {
    // Corrige Latin-1 interpretado como UTF-8 (ej: CategorÃ­a → Categoría)
    try {
      return decodeURIComponent(escape(str))
    } catch {
      return str
    }
  }

  function parsearMonto(str: string): number {
    // "79,800.00" → 79800
    return parseFloat(str.replace(/,/g, '')) || 0
  }

function procesarCsv(contenido: string) {
  const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l)

  // Encontrar la línea del header ("", "Categoría", "Cantidad")
  const headerIdx = lineas.findIndex(l =>
    l.toLowerCase().includes('categor') && l.toLowerCase().includes('cantidad')
  )
  if (headerIdx === -1) {
    alert('No se encontró el encabezado esperado (Categoría, Cantidad) en el CSV.')
    return
  }

  // Parsear líneas de datos después del header
  const datos = lineas.slice(headerIdx + 1)

  const filas = datos.map(linea => {
    // Extraer campos entre comillas: "idx", "Nombre", "Monto"
    const matches = [...linea.matchAll(/"([^"]*)"/g)].map(m => m[1])
    if (matches.length < 3) return null

    const nombre = matches[1].trim()
    const monto = parsearMonto(matches[2])

    if (!nombre || monto <= 0) return null

    const cat = categoriasGasto.find(
      c => c.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()
    )

    return { nombre, monto, categoria_id: cat?.id || null, omitir: false }
  }).filter(Boolean) as typeof csvRows

  if (filas.length === 0) {
    alert('No se encontraron filas válidas en el CSV.')
    return
  }

  setCsvRows(filas)
  setModalCsv(true)
}

  function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    const reader = new FileReader()
    reader.onload = ev => {
      const contenido = ev.target?.result as string
      procesarCsv(contenido)
    }
    reader.readAsText(archivo, 'UTF-8')
    // Reset input para poder subir el mismo archivo otra vez
    e.target.value = ''
  }

  async function confirmarImportacion() {
    if (!mes) return
    setImportando(true)
    const copId = monedas.find(m => m.codigo === 'COP')?.id || 1

    const filasValidas = csvRows.filter(r => !r.omitir && r.categoria_id && r.monto > 0)
    for (const fila of filasValidas) {
      await window.electronAPI.saveGastoMes({
        id: 0,
        mes_id: mes.id,
        categoria_id: fila.categoria_id!,
        monto: fila.monto,
        moneda_id: copId,
        nota: `Importado: ${fila.nombre}`
      })
    }

    await cargarDatos()
    setModalCsv(false)
    setCsvRows([])
    setImportando(false)
  }

  const filasNoEncontradas = csvRows.filter(r => !r.categoria_id && !r.omitir).length
  const filasListas = csvRows.filter(r => !r.omitir && r.categoria_id && r.monto > 0).length

  useEffect(() => { cargarDatos() }, [mesActivo, anioActivo])

  async function cargarDatos() {
    const m = await window.electronAPI.getOrCreateMes(anioActivo, mesActivo)
    setMes(m)
    const [ing, gas, deu, invs] = await Promise.all([
      window.electronAPI.getIngresosMes(m.id),
      window.electronAPI.getGastosMes(m.id),
      window.electronAPI.getDeudasTC(m.id),
      window.electronAPI.getInversiones(),
    ])
    setIngresos(ing)
    setGastos(gas)
    setDeudas(deu)
    setInversiones(invs)

    // Cargar saldos de inversiones para este mes
    const im = await window.electronAPI.getInversionMensualMes(m.id)
    const imMap: Record<number, InversionMensual> = {}
    im.forEach(i => { imMap[i.inversion_id] = i })
    setInvMensual(imMap)
  }

  // ── INGRESOS ────────────────────────────────────────
  function agregarIngreso() {
    const copId = monedas.find(m => m.codigo === 'COP')?.id || 1
    setIngresos(prev => [...prev, {
      id: 0, mes_id: mes!.id, categoria_id: 0,
      monto: 0, moneda_id: copId, nota: ''
    }])
  }

  async function guardarIngreso(idx: number) {
    const ing = ingresos[idx]
    await window.electronAPI.saveIngresoMes({ ...ing, mes_id: mes!.id })
    await cargarDatos()
  }

  async function eliminarIngreso(id: number, idx: number) {
    if (id) await window.electronAPI.deleteIngresoMes(id)
    setIngresos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── GASTOS ──────────────────────────────────────────
  function agregarGasto() {
    const copId = monedas.find(m => m.codigo === 'COP')?.id || 1
    setGastos(prev => [...prev, {
      id: 0, mes_id: mes!.id, categoria_id: 0,
      monto: 0, moneda_id: copId, nota: ''
    }])
  }

  async function guardarGasto(idx: number) {
    const g = gastos[idx]
    await window.electronAPI.saveGastoMes({ ...g, mes_id: mes!.id })
    await cargarDatos()
  }

  async function eliminarGasto(id: number, idx: number) {
    if (id) await window.electronAPI.deleteGastoMes(id)
    setGastos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── DEUDAS TC ────────────────────────────────────────
  function agregarDeuda() {
    setDeudas(prev => [...prev, { id: 0, mes_id: mes!.id, nombre_tc: '', saldo: 0 }])
  }

  async function guardarDeuda(idx: number) {
    await window.electronAPI.saveDeudaTC({ ...deudas[idx], mes_id: mes!.id })
    await cargarDatos()
  }

  async function eliminarDeuda(id: number, idx: number) {
    if (id) await window.electronAPI.deleteDeudaTC(id)
    setDeudas(prev => prev.filter((_, i) => i !== idx))
  }

  // ── INVERSIONES ──────────────────────────────────────
  function updateInvMensual(invId: number, campo: string, valor: number) {
    setInvMensual(prev => ({
      ...prev,
      [invId]: {
        ...(prev[invId] || { inversion_id: invId, mes_id: mes!.id, saldo_cierre: 0, aportes: 0, retiros: 0, rendimiento: 0, rentabilidad_pct: 0 }),
        [campo]: valor
      }
    }))
  }

  async function guardarInversiones() {
    setGuardando(true)
    for (const invId of Object.keys(invMensual)) {
      const im = invMensual[Number(invId)]
      await window.electronAPI.saveInversionMensual({ ...im, mes_id: mes!.id })
    }
    await cargarDatos()
    setGuardando(false)
  }

  async function cerrarMes() {
    if (!mes) return
    if (!confirm(`¿Cerrar ${MESES_NOMBRES[mesActivo]} ${anioActivo}? No podrás editar los datos.`)) return
    await window.electronAPI.cerrarMes(mes.id)
    await cargarDatos()
  }

  // Mejora 3: Validación por fila
  function ingresoValido(ing: IngresoMes): boolean {
    return !!(ing.categoria_id && ing.monto && ing.monto > 0)
  }
  function gastoValido(g: GastoMes): boolean {
    return !!(g.categoria_id && g.monto && g.monto > 0)
  }
  function deudaValida(d: DeudaTC): boolean {
    return !!(d.nombre_tc && d.nombre_tc.trim() && d.saldo && d.saldo > 0)
  }

  const totalIngresos = ingresos.reduce((s, i) => s + (i.monto || 0), 0)
  const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0)
  const totalDeudas = deudas.reduce((s, d) => s + (d.saldo || 0), 0)
  const categoriasIngreso = categorias.filter(c => c.tipo === 'ingreso')
  const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')
  const cerrado = mes?.cerrado === 1

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ingresos', label: `Ingresos (${formatCOP(totalIngresos)})` },
    { key: 'gastos', label: `Gastos (${formatCOP(totalGastos)})` },
    { key: 'inversiones', label: `Inversiones (${inversiones.length})` },
    { key: 'deudas', label: `Deudas TC (${formatCOP(totalDeudas)})` },
  ]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cierre Mensual</h1>
          <p className="text-slate-400 text-sm mt-0.5">Registra los movimientos del mes</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={mesActivo} onChange={e => setMesActivo(Number(e.target.value), anioActivo)} className="w-36">
            {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select value={anioActivo} onChange={e => setMesActivo(mesActivo, Number(e.target.value))} className="w-24">
            {[2023, 2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {!cerrado && (
            <button
              onClick={cerrarMes}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              <Lock size={14} /> Cerrar Mes
            </button>
          )}
          {cerrado && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm border border-amber-500/30">
              <Lock size={14} /> Mes cerrado
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: INGRESOS ── */}
      {tab === 'ingresos' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Ingresos del mes</h3>
            {!cerrado && (
              <button onClick={agregarIngreso} className="btn-primary flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                <Plus size={14} /> Agregar
              </button>
            )}
          </div>
          <div className="space-y-2">
            {ingresos.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No hay ingresos registrados</p>}
            {ingresos.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-lg">
                <select className="col-span-3" value={ing.categoria_id || ''} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, categoria_id: Number(e.target.value) } : x))}>
                  <option value="">Categoría *</option>
                  {categoriasIngreso.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                </select>
                <input type="number" className="col-span-2" placeholder="Monto *" value={ing.monto || ''} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, monto: Number(e.target.value) } : x))} />
                <select className="col-span-2" value={ing.moneda_id} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, moneda_id: Number(e.target.value) } : x))}>
                  {monedas.map(m => <option key={m.id} value={m.id}>{m.codigo}</option>)}
                </select>
                <input className="col-span-3" placeholder="Nota (opcional)" value={ing.nota || ''} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, nota: e.target.value } : x))} />
                {!cerrado && (
                  <>
                    <button onClick={() => guardarIngreso(idx)} disabled={!ingresoValido(ing)}
                      className="col-span-1 p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                      <Save size={14} />
                    </button>
                    <button onClick={() => eliminarIngreso(ing.id, idx)} className="col-span-1 p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {ingresos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700 flex justify-end">
              <span className="text-slate-400 text-sm">Total: <span className="text-green-400 font-mono font-bold">{formatCOP(totalIngresos)}</span></span>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: GASTOS ── */}
      {tab === 'gastos' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Gastos del mes</h3>
            {!cerrado && (
              <div className="flex items-center gap-2">
                <input
                  ref={inputCsvRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onArchivoSeleccionado}
                />
                <button
                  onClick={() => inputCsvRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  <Upload size={14} /> Importar CSV
                </button>
                <button onClick={agregarGasto} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                  <Plus size={14} /> Agregar
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {gastos.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No hay gastos registrados</p>}
            {gastos.map((g, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-lg">
                <select className="col-span-3" value={g.categoria_id || ''} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, categoria_id: Number(e.target.value) } : x))}>
                  <option value="">Categoría *</option>
                  {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                </select>
                <input type="number" className="col-span-2" placeholder="Monto *" value={g.monto || ''} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, monto: Number(e.target.value) } : x))} />
                <select className="col-span-2" value={g.moneda_id} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, moneda_id: Number(e.target.value) } : x))}>
                  {monedas.map(m => <option key={m.id} value={m.id}>{m.codigo}</option>)}
                </select>
                <input className="col-span-3" placeholder="Nota (opcional)" value={g.nota || ''} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, nota: e.target.value } : x))} />
                {!cerrado && (
                  <>
                    <button onClick={() => guardarGasto(idx)} disabled={!gastoValido(g)}
                      className="col-span-1 p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                      <Save size={14} />
                    </button>
                    <button onClick={() => eliminarGasto(g.id, idx)} className="col-span-1 p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {gastos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700 flex justify-end">
              <span className="text-slate-400 text-sm">Total: <span className="text-red-400 font-mono font-bold">{formatCOP(totalGastos)}</span></span>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: INVERSIONES ── */}
      {tab === 'inversiones' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Saldos de inversiones</h3>
            {!cerrado && (
              <button onClick={guardarInversiones} disabled={guardando}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar todo'}
              </button>
            )}
          </div>
          {inversiones.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No hay inversiones. Agrégalas en la sección Inversiones.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2 pr-2">Inversión</th>
                    <th className="text-right py-2 px-2">Saldo Cierre</th>
                    <th className="text-right py-2 px-2">Aportes</th>
                    <th className="text-right py-2 px-2">Retiros</th>
                    <th className="text-right py-2 px-2">Rendimiento</th>
                    <th className="text-right py-2 pl-2">Rentab. %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {inversiones.map(inv => {
                    const im = invMensual[inv.id] || { saldo_cierre: 0, aportes: 0, retiros: 0, rendimiento: 0, rentabilidad_pct: 0 }
                    return (
                      <tr key={inv.id} className="hover:bg-slate-700/30">
                        <td className="py-2 pr-2">
                          <div>
                            <p className="text-white font-medium truncate">{inv.nombre}</p>
                            <p className="text-slate-500 text-xs truncate">{inv.entidad_nombre} · {inv.moneda_codigo}</p>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" disabled={cerrado} value={im.saldo_cierre || ''}
                            onChange={e => updateInvMensual(inv.id, 'saldo_cierre', Number(e.target.value))}
                            className="w-full text-right" placeholder="0" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" disabled={cerrado} value={im.aportes || ''}
                            onChange={e => updateInvMensual(inv.id, 'aportes', Number(e.target.value))}
                            className="w-full text-right" placeholder="0" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" disabled={cerrado} value={im.retiros || ''}
                            onChange={e => updateInvMensual(inv.id, 'retiros', Number(e.target.value))}
                            className="w-full text-right" placeholder="0" />
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-medium ${im.rendimiento >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCOP(im.rendimiento || 0)}
                        </td>
                        <td className={`py-2 pl-2 text-right font-mono ${im.rentabilidad_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPct(im.rentabilidad_pct || 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: DEUDAS TC ── */}
      {tab === 'deudas' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Deudas de Tarjetas de Crédito</h3>
            {!cerrado && (
              <button onClick={agregarDeuda} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                <Plus size={14} /> Agregar TC
              </button>
            )}
          </div>
          <p className="text-slate-500 text-xs mb-4">💡 Registra solo el saldo pendiente al final del mes, no los pagos (los pagos son traslados, no gastos)</p>
          <div className="space-y-2">
            {deudas.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No hay deudas de TC registradas</p>}
            {deudas.map((d, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-lg">
                <input className="col-span-5" placeholder="Nombre de la tarjeta *" value={d.nombre_tc} disabled={cerrado}
                  onChange={e => setDeudas(prev => prev.map((x, i) => i === idx ? { ...x, nombre_tc: e.target.value } : x))} />
                <input type="number" className="col-span-4" placeholder="Saldo pendiente *" value={d.saldo || ''} disabled={cerrado}
                  onChange={e => setDeudas(prev => prev.map((x, i) => i === idx ? { ...x, saldo: Number(e.target.value) } : x))} />
                {!cerrado && (
                  <>
                    <button onClick={() => guardarDeuda(idx)} disabled={!deudaValida(d)}
                      className="col-span-1 p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                      <Save size={14} />
                    </button>
                    <button onClick={() => eliminarDeuda(d.id, idx)} className="col-span-2 p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {deudas.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700 flex justify-end">
              <span className="text-slate-400 text-sm">Total deuda: <span className="text-red-400 font-mono font-bold">{formatCOP(totalDeudas)}</span></span>
            </div>
         )}
      </Card>
      )}

      {/* ── MODAL IMPORTAR CSV ── */}
      <Modal open={modalCsv} onClose={() => { setModalCsv(false); setCsvRows([]) }}
        titulo="Importar gastos desde CSV" ancho="max-w-2xl">
        <div className="space-y-4">

          {/* Resumen */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-400">
              <CheckCircle size={14} />
              {filasListas} listas para importar
            </span>
            {filasNoEncontradas > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertCircle size={14} />
                {filasNoEncontradas} categorías no encontradas
              </span>
            )}
          </div>

          {/* Tabla de preview */}
          <div className="max-h-96 overflow-y-auto space-y-1">
            {csvRows.map((fila, idx) => {
              const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')
              const encontrada = !!fila.categoria_id
              return (
                <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg text-sm ${
                  fila.omitir ? 'opacity-40' : encontrada ? 'bg-slate-900' : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                  <div className="col-span-1 flex justify-center">
                    {fila.omitir
                      ? <X size={14} className="text-slate-500" />
                      : encontrada
                        ? <CheckCircle size={14} className="text-green-400" />
                        : <AlertCircle size={14} className="text-amber-400" />
                    }
                  </div>
                  <div className="col-span-3 text-slate-400 truncate" title={fila.nombre}>
                    {fila.nombre}
                  </div>
                  <div className="col-span-2 text-white font-mono text-right">
                    {formatCOP(fila.monto)}
                  </div>
                  <div className="col-span-4">
                    {encontrada
                      ? <span className="text-green-400 text-xs">
                          {categoriasGasto.find(c => c.id === fila.categoria_id)?.emoji || ''} {categoriasGasto.find(c => c.id === fila.categoria_id)?.nombre}
                        </span>
                      : (
                        <select
                          value={fila.categoria_id || ''}
                          className="w-full text-xs"
                          onChange={e => setCsvRows(prev => prev.map((r, i) =>
                            i === idx ? { ...r, categoria_id: Number(e.target.value) || null } : r
                          ))}>
                          <option value="">Seleccionar...</option>
                          {categoriasGasto.map(c => (
                            <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>
                          ))}
                        </select>
                      )
                    }
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => setCsvRows(prev => prev.map((r, i) =>
                        i === idx ? { ...r, omitir: !r.omitir } : r
                      ))}
                      className={`text-xs px-2 py-0.5 rounded transition-colors ${
                        fila.omitir
                          ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                    >
                      {fila.omitir ? 'Incluir' : 'Omitir'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Acciones */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-700">
            <button
              onClick={() => { setModalCsv(false); setCsvRows([]) }}
              className="px-4 py-2 text-slate-400 hover:text-white text-sm">
              Cancelar
            </button>
            <button
              onClick={confirmarImportacion}
              disabled={importando || filasListas === 0 || filasNoEncontradas > 0}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {importando ? 'Importando...' : `Importar ${filasListas} gastos`}
            </button>
          </div>

          {filasNoEncontradas > 0 && (
            <p className="text-amber-400 text-xs text-center">
              Asigna una categoría a todas las filas marcadas en amarillo para poder importar.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}