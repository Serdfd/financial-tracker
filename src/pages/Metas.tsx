import { useEffect, useState } from 'react'
import { Plus, ArrowLeft, Edit2, Trash2, X, PiggyBank, Link2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { formatCOP, MESES_NOMBRES } from '@/lib/format'
import { MetaAhorro, AporteMeta, Inversion } from '@/types'

// ── Helpers ───────────────────────────────────────────

function generarPeriodos(meta: MetaAhorro): string[] {
  const inicio = new Date(meta.fecha_inicio + 'T00:00:00')
  const hoy = new Date()
  const finFecha = meta.fecha_fin ? new Date(meta.fecha_fin + 'T00:00:00') : hoy
  const fin = finFecha < hoy ? finFecha : hoy
  const periodos: string[] = []

  if (meta.periodicidad === 'mensual') {
    let year = inicio.getFullYear()
    let month = inicio.getMonth()
    while (true) {
      const fecha = new Date(year, month, 1)
      if (fecha > fin) break
      periodos.push(`${year}-${String(month + 1).padStart(2, '0')}-01`)
      month++
      if (month > 11) { month = 0; year++ }
    }
  } else {
    let year = inicio.getFullYear()
    let month = inicio.getMonth()
    const days = [1, 15]
    let dayIdx = inicio.getDate() >= 15 ? 1 : 0
    while (true) {
      const day = days[dayIdx]
      const fecha = new Date(year, month, day)
      if (fecha > fin) break
      if (fecha >= inicio) {
        periodos.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      }
      dayIdx = (dayIdx + 1) % 2
      if (dayIdx === 0) {
        month++
        if (month > 11) { month = 0; year++ }
      }
    }
  }
  return periodos
}

function contarPeriodosTotales(meta: MetaAhorro): number {
  if (!meta.fecha_fin) return generarPeriodos(meta).length
  const inicio = new Date(meta.fecha_inicio + 'T00:00:00')
  const fin = new Date(meta.fecha_fin + 'T00:00:00')
  let count = 0
  if (meta.periodicidad === 'mensual') {
    let year = inicio.getFullYear()
    let month = inicio.getMonth()
    while (true) {
      if (new Date(year, month, 1) > fin) break
      count++
      month++
      if (month > 11) { month = 0; year++ }
    }
  } else {
    let year = inicio.getFullYear()
    let month = inicio.getMonth()
    const days = [1, 15]
    let dayIdx = inicio.getDate() >= 15 ? 1 : 0
    while (true) {
      const day = days[dayIdx]
      const fecha = new Date(year, month, day)
      if (fecha > fin) break
      if (fecha >= inicio) count++
      dayIdx = (dayIdx + 1) % 2
      if (dayIdx === 0) {
        month++
        if (month > 11) { month = 0; year++ }
      }
    }
  }
  return count
}

function labelPeriodo(fecha: string, periodicidad: 'mensual' | 'quincenal'): string {
  const mesNum = Number(fecha.slice(5, 7))
  const dia = fecha.slice(8, 10)
  const mes = MESES_NOMBRES[mesNum].slice(0, 3)
  return periodicidad === 'mensual' ? mes : `${dia === '01' ? '1' : '15'} ${mes}`
}

// ── Component ─────────────────────────────────────────

export function Metas() {
  const [metas, setMetas] = useState<MetaAhorro[]>([])
  const [metaSeleccionada, setMetaSeleccionada] = useState<MetaAhorro | null>(null)
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [metaInvIds, setMetaInvIds] = useState<number[]>([])
  const [aportes, setAportes] = useState<AporteMeta[]>([])
  const [rendimientos, setRendimientos] = useState(0)
  const [periodoActivo, setPeriodoActivo] = useState<string | null>(null)
  const [montoInput, setMontoInput] = useState('')
  const [notasInput, setNotasInput] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoMeta, setEditandoMeta] = useState<Partial<MetaAhorro>>({})

  useEffect(() => { cargarMetas() }, [])
  useEffect(() => { window.electronAPI.getInversiones().then(setInversiones) }, [])

  async function cargarMetas() {
    setMetas(await window.electronAPI.getMetas())
  }

  async function cargarDetalle(meta: MetaAhorro) {
    const [aps, vinculadas, rend] = await Promise.all([
      window.electronAPI.getAportesMeta(meta.id),
      window.electronAPI.getMetaInversiones(meta.id),
      window.electronAPI.getRendimientosMetaInversiones(meta.id),
    ])
    setAportes(aps)
    setMetaInvIds(vinculadas.map(v => v.inversion_id))
    setRendimientos(rend)
  }

  async function seleccionarMeta(meta: MetaAhorro) {
    setMetaSeleccionada(meta)
    setPeriodoActivo(null)
    await cargarDetalle(meta)
  }

  async function guardarAporte() {
    if (!metaSeleccionada || !periodoActivo) return
    const monto = parseFloat(montoInput)
    if (!monto || monto <= 0) return
    const existente = aportes.find(a => a.fecha === periodoActivo)
    await window.electronAPI.saveAporteMeta({
      id: existente?.id,
      meta_id: metaSeleccionada.id,
      fecha: periodoActivo,
      monto,
      notas: notasInput || null,
    })
    setPeriodoActivo(null)
    await cargarDetalle(metaSeleccionada)
  }

  async function eliminarAporte(id: number) {
    await window.electronAPI.deleteAporteMeta(id)
    if (metaSeleccionada) await cargarDetalle(metaSeleccionada)
  }

  async function toggleInversion(inv_id: number) {
    if (!metaSeleccionada) return
    const nuevos = metaInvIds.includes(inv_id)
      ? metaInvIds.filter(id => id !== inv_id)
      : [...metaInvIds, inv_id]
    setMetaInvIds(nuevos)
    await window.electronAPI.setMetaInversiones(metaSeleccionada.id, nuevos)
    setRendimientos(await window.electronAPI.getRendimientosMetaInversiones(metaSeleccionada.id))
  }

  async function guardarMeta() {
    if (!editandoMeta.nombre || !editandoMeta.fecha_inicio || !editandoMeta.monto_periodo) return
    await window.electronAPI.saveMeta(editandoMeta)
    setMostrarForm(false)
    setEditandoMeta({})
    await cargarMetas()
  }

  async function eliminarMeta(id: number) {
    if (!window.confirm('¿Eliminar esta meta?')) return
    await window.electronAPI.deleteMeta(id)
    setMetaSeleccionada(null)
    await cargarMetas()
  }

  function abrirFormNuevo() {
    setEditandoMeta({
      nombre: '',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      periodicidad: 'mensual',
      monto_periodo: 800000,
    })
    setMostrarForm(true)
  }

  function clickPeriodo(fecha: string) {
    if (periodoActivo === fecha) {
      setPeriodoActivo(null)
      return
    }
    const existente = aportes.find(a => a.fecha === fecha)
    setPeriodoActivo(fecha)
    setMontoInput(existente ? String(existente.monto) : String(metaSeleccionada?.monto_periodo ?? ''))
    setNotasInput(existente?.notas ?? '')
  }

  // ── Derived state ──────────────────────────────────
  const periodos = metaSeleccionada ? generarPeriodos(metaSeleccionada) : []
  const aportesMap = Object.fromEntries(aportes.map(a => [a.fecha, a]))
  const totalAportado = aportes.reduce((s, a) => s + a.monto, 0)
  const periodosCumplidos = aportes.length
  const periodosEsperados = periodos.length
  const pctCumplimiento = periodosEsperados > 0 ? Math.min(100, Math.round((periodosCumplidos / periodosEsperados) * 100)) : 0
  const periodosTotales = metaSeleccionada ? contarPeriodosTotales(metaSeleccionada) : 0
  const totalMeta = metaSeleccionada ? periodosTotales * metaSeleccionada.monto_periodo : 0
  const pctVsMeta = totalMeta > 0 ? Math.min(100, (totalAportado / totalMeta) * 100) : 0
  const periodosRestantes = metaSeleccionada?.fecha_fin ? Math.max(0, periodosTotales - periodosCumplidos) : null

  const periodosPorAnio: Record<string, string[]> = {}
  periodos.forEach(p => {
    const year = p.slice(0, 4)
    if (!periodosPorAnio[year]) periodosPorAnio[year] = []
    periodosPorAnio[year].push(p)
  })

  // ── Render ─────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {metaSeleccionada && (
            <button onClick={() => setMetaSeleccionada(null)} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {metaSeleccionada ? metaSeleccionada.nombre : 'Metas de Ahorro'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {metaSeleccionada
                ? `${metaSeleccionada.periodicidad === 'mensual' ? 'Mensual' : 'Quincenal'} · ${formatCOP(metaSeleccionada.monto_periodo)} por período`
                : 'Control de aportes periódicos'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {metaSeleccionada ? (
            <>
              <button onClick={() => { setEditandoMeta({ ...metaSeleccionada }); setMostrarForm(true) }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                <Edit2 size={14} /> Editar
              </button>
              <button onClick={() => eliminarMeta(metaSeleccionada.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors">
                <Trash2 size={14} /> Eliminar
              </button>
            </>
          ) : (
            <button onClick={abrirFormNuevo}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} /> Nueva Meta
            </button>
          )}
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {!metaSeleccionada && (
        metas.length === 0 ? (
          <Card className="text-center py-16">
            <PiggyBank size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No hay metas de ahorro</p>
            <p className="text-slate-500 text-sm mt-1">Crea una para llevar el control de tus aportes periódicos</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {metas.map(meta => (
              <button key={meta.id} onClick={() => seleccionarMeta(meta)}
                className="text-left bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-xl p-5 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{meta.nombre}</h3>
                    {meta.descripcion && <p className="text-slate-400 text-xs mt-0.5">{meta.descripcion}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    meta.periodicidad === 'mensual' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {meta.periodicidad === 'mensual' ? 'Mensual' : 'Quincenal'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <div>
                    <p className="text-slate-400 text-xs">Aporte por período</p>
                    <p className="text-white font-mono font-medium">{formatCOP(meta.monto_periodo)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Períodos transcurridos</p>
                    <p className="text-white font-medium">{generarPeriodos(meta).length}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-700 flex justify-between items-center">
                  <p className="text-slate-500 text-xs">Desde {meta.fecha_inicio}{meta.fecha_fin ? ` hasta ${meta.fecha_fin}` : ''}</p>
                  <span className="text-indigo-400 text-xs">Ver detalle →</span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── DETAIL VIEW ── */}
      {metaSeleccionada && (
        <div className="space-y-6">

          {/* Proyección de la meta (solo si tiene fecha fin) */}
          {metaSeleccionada.fecha_fin && (
            <div className="bg-slate-800 border border-indigo-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-slate-400 text-xs">Meta de capital total</p>
                  <p className="text-indigo-300 font-bold text-2xl font-mono mt-0.5">{formatCOP(totalMeta)}</p>
                  <p className="text-slate-500 text-xs mt-1">{periodosTotales} períodos × {formatCOP(metaSeleccionada.monto_periodo)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs">Aportado</p>
                  <p className="text-white font-bold text-xl font-mono mt-0.5">{formatCOP(totalAportado)}</p>
                  <p className="text-slate-500 text-xs mt-1">{pctVsMeta.toFixed(1)}% de la meta</p>
                </div>
              </div>
              <div className="bg-slate-700 rounded-full h-2 mb-2">
                <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pctVsMeta}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>$0</span>
                {periodosRestantes !== null && periodosRestantes > 0 && (
                  <span className="text-slate-400">{periodosRestantes} períodos restantes para completar</span>
                )}
                {periodosRestantes === 0 && <span className="text-green-400 font-medium">¡Meta completada!</span>}
                <span>{formatCOP(totalMeta)}</span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Capital aportado</p>
              <p className="text-white font-bold text-lg font-mono">{formatCOP(totalAportado)}</p>
              <div className="mt-2 bg-slate-700 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pctCumplimiento}%` }} />
              </div>
              <p className="text-slate-500 text-xs mt-1">{pctCumplimiento}% de cumplimiento</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Períodos cumplidos</p>
              <p className="text-white font-bold text-lg">{periodosCumplidos} <span className="text-slate-400 font-normal text-sm">/ {periodosEsperados}</span></p>
              {metaSeleccionada.fecha_fin && (
                <p className="text-slate-500 text-xs mt-1">Meta total: {periodosTotales} períodos</p>
              )}
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Rendimientos inv. vinculadas</p>
              <p className={`font-bold text-lg font-mono ${rendimientos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {rendimientos >= 0 ? '+' : ''}{formatCOP(rendimientos)}
              </p>
              {metaInvIds.length === 0 && <p className="text-slate-600 text-xs mt-1">Sin inversiones vinculadas</p>}
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Total (capital + rend.)</p>
              <p className="text-indigo-400 font-bold text-lg font-mono">{formatCOP(totalAportado + rendimientos)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Calendar */}
            <div className="xl:col-span-2 space-y-4">
              {periodos.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-slate-500">No hay períodos registrables aún</p>
                </Card>
              ) : (
                Object.entries(periodosPorAnio).sort(([a], [b]) => Number(b) - Number(a)).map(([anio, fps]) => (
                  <Card key={anio}>
                    <h3 className="text-white font-semibold mb-3">{anio}
                      <span className="text-slate-500 text-xs font-normal ml-2">
                        {fps.filter(f => aportesMap[f]).length} / {fps.length} aportados
                      </span>
                    </h3>
                    <div className={`grid gap-2 ${metaSeleccionada.periodicidad === 'mensual' ? 'grid-cols-6' : 'grid-cols-6'}`}>
                      {fps.map(fecha => {
                        const aporte = aportesMap[fecha]
                        const isActive = periodoActivo === fecha
                        return (
                          <button key={fecha} onClick={() => clickPeriodo(fecha)}
                            className={`p-2 rounded-lg text-xs font-medium transition-all text-center border ${
                              isActive
                                ? 'bg-indigo-500 border-indigo-400 text-white'
                                : aporte
                                  ? 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30'
                                  : 'bg-slate-700/50 border-slate-600 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                            }`}>
                            <div>{labelPeriodo(fecha, metaSeleccionada.periodicidad)}</div>
                            {aporte && (
                              <div className="text-green-300 text-xs mt-0.5 truncate">
                                {(aporte.monto / 1_000_000).toFixed(1)}M
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Inline period editor */}
                    {periodoActivo && fps.includes(periodoActivo) && (
                      <div className="mt-3 p-3 bg-slate-700/40 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-slate-300 text-sm font-medium">
                            {labelPeriodo(periodoActivo, metaSeleccionada.periodicidad)} {periodoActivo.slice(0, 4)}
                            {aportesMap[periodoActivo] && <span className="text-green-400 ml-2">· registrado</span>}
                          </p>
                          <button onClick={() => setPeriodoActivo(null)} className="text-slate-400 hover:text-white">
                            <X size={15} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="number" value={montoInput} onChange={e => setMontoInput(e.target.value)}
                            placeholder="Monto" className="w-36 text-sm" />
                          <input value={notasInput} onChange={e => setNotasInput(e.target.value)}
                            placeholder="Nota (opcional)" className="flex-1 min-w-[120px] text-sm" />
                          <button onClick={guardarAporte}
                            className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors shrink-0">
                            {aportesMap[periodoActivo] ? 'Actualizar' : 'Registrar'}
                          </button>
                          {aportesMap[periodoActivo] && (
                            <button onClick={() => { eliminarAporte(aportesMap[periodoActivo].id); setPeriodoActivo(null) }}
                              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors shrink-0">
                              Borrar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>

            {/* Inversiones vinculadas */}
            <div className="space-y-4">
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Link2 size={15} className="text-slate-400" />
                  <h3 className="text-white font-semibold text-sm">Inversiones vinculadas</h3>
                </div>
                <p className="text-slate-500 text-xs mb-3">Marca dónde guardas el dinero de esta meta. Solo informativo — no crea registros duplicados.</p>
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {inversiones.map(inv => (
                    <label key={inv.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        metaInvIds.includes(inv.id)
                          ? 'bg-indigo-500/10 border border-indigo-500/30'
                          : 'hover:bg-slate-700/50 border border-transparent'
                      }`}>
                      <input type="checkbox" checked={metaInvIds.includes(inv.id)} onChange={() => toggleInversion(inv.id)}
                        className="w-4 h-4 accent-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{inv.nombre}</p>
                        {inv.entidad_nombre && <p className="text-slate-500 text-xs">{inv.entidad_nombre}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </Card>

              {metaInvIds.length > 0 && (
                <Card>
                  <p className="text-slate-400 text-xs mb-1">Rendimientos desde inicio de meta</p>
                  <p className={`font-mono font-bold text-2xl ${rendimientos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {rendimientos >= 0 ? '+' : ''}{formatCOP(rendimientos)}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    De {metaInvIds.length} inversión{metaInvIds.length !== 1 ? 'es' : ''} vinculada{metaInvIds.length !== 1 ? 's' : ''}
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva/editar meta */}
      <Modal open={mostrarForm} onClose={() => { setMostrarForm(false); setEditandoMeta({}) }}
        titulo={editandoMeta.id ? 'Editar Meta' : 'Nueva Meta de Ahorro'}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs block mb-1">Nombre *</label>
            <input value={editandoMeta.nombre || ''} onChange={e => setEditandoMeta({ ...editandoMeta, nombre: e.target.value })}
              placeholder="Ej: Jubilación, Fondo emergencia, Viaje..." className="w-full" />
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">Descripción (opcional)</label>
            <input value={editandoMeta.descripcion || ''} onChange={e => setEditandoMeta({ ...editandoMeta, descripcion: e.target.value })}
              placeholder="Para qué es este ahorro..." className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Fecha inicio *</label>
              <input type="date" value={editandoMeta.fecha_inicio || ''} onChange={e => setEditandoMeta({ ...editandoMeta, fecha_inicio: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Fecha fin (opcional)</label>
              <input type="date" value={editandoMeta.fecha_fin || ''} onChange={e => setEditandoMeta({ ...editandoMeta, fecha_fin: e.target.value || undefined })} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Periodicidad *</label>
              <select value={editandoMeta.periodicidad || 'mensual'} onChange={e => setEditandoMeta({ ...editandoMeta, periodicidad: e.target.value as 'mensual' | 'quincenal' })} className="w-full">
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal (1 y 15)</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Monto por período *</label>
              <input type="number" value={editandoMeta.monto_periodo || ''} onChange={e => setEditandoMeta({ ...editandoMeta, monto_periodo: Number(e.target.value) })}
                placeholder="800000" className="w-full" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={guardarMeta}
              disabled={!editandoMeta.nombre || !editandoMeta.fecha_inicio || !editandoMeta.monto_periodo}
              className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {editandoMeta.id ? 'Guardar cambios' : 'Crear meta'}
            </button>
            <button onClick={() => { setMostrarForm(false); setEditandoMeta({}) }}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
