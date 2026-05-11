import { useEffect, useState } from 'react'
import { Plus, ChevronRight, TrendingUp, Building2, X, Trash2, Pencil, FileText, Package } from 'lucide-react'
import ReactApexChart from 'react-apexcharts'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { Inversion, InversionMensual, Inmueble, FichaInversion, LoteInversion, ResumenLotes } from '@/types'
import { formatCOP, formatPct, MESES_NOMBRES, nombreMes } from '@/lib/format'

export function Inversiones() {
  const { entidades, tiposInversion, perfilesRiesgo, monedas, cargarCatalogos } = useAppStore()
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [seleccionada, setSeleccionada] = useState<Inversion | null>(null)
  const [historial, setHistorial] = useState<InversionMensual[]>([])
  const [inmueble, setInmueble] = useState<Inmueble | null>(null)
  const [ficha, setFicha] = useState<FichaInversion | null>(null)
  const [lotes, setLotes] = useState<LoteInversion[]>([])
  const [resumenLotes, setResumenLotes] = useState<ResumenLotes | null>(null)
  const [modalInversion, setModalInversion] = useState(false)
  const [modalInmueble, setModalInmueble] = useState(false)
  const [modalFicha, setModalFicha] = useState(false)
  const [modalLote, setModalLote] = useState(false)
  const [tab, setTab] = useState<'lista' | 'inmuebles'>('lista')
  const [refreshKey, setRefreshKey] = useState(0)

  const [form, setForm] = useState<any>({ estado: 'activo' })
  const [formInmueble, setFormInmueble] = useState<Partial<Inmueble>>({ estado: 'en_construccion', cuotas_pagadas: 0 })
  const [formFicha, setFormFicha] = useState<Partial<FichaInversion>>({})
  const [formLote, setFormLote] = useState<any>({ fecha_compra: new Date().toISOString().split('T')[0] })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const inv = await window.electronAPI.getInversiones()
    setInversiones(inv)
  }

  async function verDetalle(inv: Inversion) {
    setSeleccionada(inv)
    const [h, inm, f, l, r] = await Promise.all([
      window.electronAPI.getInversionMensual(inv.id),
      window.electronAPI.getInmueble(inv.id),
      window.electronAPI.getFichaInversion(inv.id),
      window.electronAPI.getLotesInversion(inv.id),
      window.electronAPI.getResumenLotes(inv.id),
    ])
    setHistorial(h)
    setInmueble(inm)
    setFicha(f)
    setLotes(l)
    setResumenLotes(r)
  }

  async function abrirModalInmueble(inv: Inversion) {
    await verDetalle(inv)
    const inm = await window.electronAPI.getInmueble(inv.id)
    if (inm) setFormInmueble({ ...inm })
    else setFormInmueble({ estado: 'en_construccion', cuotas_pagadas: 0 })
    setModalInmueble(true)
  }

  function editarInversion(inv: Inversion) {
    setForm({
      id: inv.id, nombre: inv.nombre, entidad_id: inv.entidad_id,
      tipo_id: inv.tipo_id, riesgo_id: inv.riesgo_id, moneda_id: inv.moneda_id,
      estado: inv.estado, fecha_inicio: inv.fecha_inicio, notas: inv.notas,
    })
    setModalInversion(true)
  }

  async function abrirModalFicha() {
    if (!seleccionada) return
    const f = await window.electronAPI.getFichaInversion(seleccionada.id)
    setFormFicha(f || { inversion_id: seleccionada.id })
    setModalFicha(true)
  }

  async function guardarInversion() {
    await window.electronAPI.saveInversion(form)
    await cargarCatalogos()
    await cargar()
    setModalInversion(false)
    if (form.id && seleccionada?.id === form.id) {
      const invs = await window.electronAPI.getInversiones()
      const updated = invs.find((i: Inversion) => i.id === form.id)
      if (updated) await verDetalle(updated)
    }
    setForm({ estado: 'activo' })
  }

  async function guardarInmueble() {
    if (!seleccionada) return
    await window.electronAPI.saveInmueble({ ...formInmueble, inversion_id: seleccionada.id })
    const inm = await window.electronAPI.getInmueble(seleccionada.id)
    setInmueble(inm)
    setModalInmueble(false)
    setRefreshKey(prev => prev + 1)
  }

  async function guardarFicha() {
    if (!seleccionada) return
    await window.electronAPI.saveFichaInversion({ ...formFicha, inversion_id: seleccionada.id })
    const f = await window.electronAPI.getFichaInversion(seleccionada.id)
    setFicha(f)
    setModalFicha(false)
  }

  async function guardarLote() {
    if (!seleccionada) return
    await window.electronAPI.saveLoteInversion({ ...formLote, inversion_id: seleccionada.id })
    const [l, r] = await Promise.all([
      window.electronAPI.getLotesInversion(seleccionada.id),
      window.electronAPI.getResumenLotes(seleccionada.id),
    ])
    setLotes(l)
    setResumenLotes(r)
    setModalLote(false)
    setFormLote({ fecha_compra: new Date().toISOString().split('T')[0] })
  }

  async function eliminarLote(id: number) {
    if (!confirm('¿Eliminar este lote de compra?')) return
    await window.electronAPI.deleteLoteInversion(id)
    if (seleccionada) {
      const [l, r] = await Promise.all([
        window.electronAPI.getLotesInversion(seleccionada.id),
        window.electronAPI.getResumenLotes(seleccionada.id),
      ])
      setLotes(l)
      setResumenLotes(r)
    }
  }

  async function eliminarInversion(id: number) {
    if (!confirm('¿Eliminar esta inversión?')) return
    await window.electronAPI.deleteInversion(id)
    await cargar()
    if (seleccionada?.id === id) setSeleccionada(null)
  }

  // Saldo inicial ahora es OPCIONAL
  const formValido = !!(form.nombre && form.nombre.trim())

  // Determinar si esta inversión soporta lotes
  function tieneModeloLotes(inv: Inversion | null): boolean {
    if (!inv?.tipo_nombre) return false
    const t = inv.tipo_nombre.toLowerCase()
    return t === 'acciones' || t === 'crypto'
  }

function getTipoNombre(tipo_id: number | undefined): string {
  if (!tipo_id) return ''
  return tiposInversion.find(t => t.id === tipo_id)?.nombre?.toLowerCase() || ''
}

function getTipoFicha(inv: Inversion | null): 'cdt' | 'acciones' | 'crypto' | 'sinficha' | 'otro' {
  if (!inv?.tipo_nombre) return 'otro'
  const t = inv.tipo_nombre.toLowerCase()
  if (t === 'cdt') return 'cdt'
  if (t === 'acciones') return 'acciones'
  if (t === 'crypto') return 'crypto'
  if (t === 'fic' || t === 'cuenta ahorro alto rendimiento' || t === 'inmueble') return 'sinficha'
  return 'otro'
}

  // Calcular rendimiento basado en lotes
  const ultimoSaldo = historial.length > 0 ? historial[historial.length - 1].saldo_cierre : 0
  const rendimientoLotes = resumenLotes ? ultimoSaldo - resumenLotes.costo_total : 0
  const rendimientoPctLotes = resumenLotes && resumenLotes.costo_total > 0
    ? (rendimientoLotes / resumenLotes.costo_total) * 100 : 0

  const lineOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
    colors: ['#6366f1'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: historial.map(h => `${MESES_NOMBRES[h.mes!].slice(0, 3)} ${h.anio}`),
      labels: { style: { colors: '#94a3b8' } },
    },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const inmuebles = inversiones.filter(i => i.tipo_nombre === 'Inmueble')

  return (
    <div className="p-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Inversiones</h1>
          <p className="text-slate-400 text-sm mt-0.5">Portafolio y seguimiento</p>
        </div>
        <button onClick={() => { setForm({ estado: 'activo' }); setModalInversion(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
          <Plus size={16} /> Nueva Inversión
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 mb-6 w-fit">
        {[{ key: 'lista', label: 'Portafolio' }, { key: 'inmuebles', label: 'Inmuebles' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Lista */}
        <div className="flex-1 space-y-3">
          {tab === 'lista' && (
            <>
              {inversiones.length === 0 && (
                <Card className="text-center py-12">
                  <TrendingUp size={40} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No tienes inversiones registradas</p>
                  <button onClick={() => { setForm({ estado: 'activo' }); setModalInversion(true) }}
                    className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                    Agregar primera inversión
                  </button>
                </Card>
              )}
              {inversiones.map(inv => (
                <Card key={inv.id} onClick={() => verDetalle(inv)}
                  className={`cursor-pointer transition-all ${seleccionada?.id === inv.id ? 'border-indigo-500' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-white font-semibold">{inv.nombre}</p>
                        {inv.riesgo_nombre && <Badge label={inv.riesgo_nombre} color={inv.riesgo_color} />}
                        {inv.tipo_nombre && <Badge label={inv.tipo_nombre} color="#6366f1" />}
                      </div>
                      <p className="text-slate-500 text-xs">{inv.entidad_nombre || 'Sin entidad'} · {inv.moneda_codigo}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-slate-400 text-xs">Desde</p>
                        <p className="text-slate-300 text-sm">{inv.fecha_inicio || '—'}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-500" />
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          {tab === 'inmuebles' && (
            <>
              {inmuebles.length === 0 && (
                <Card className="text-center py-12">
                  <Building2 size={40} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No tienes inmuebles registrados</p>
                  <p className="text-slate-500 text-sm mt-1">Crea una inversión de tipo "Inmueble" primero</p>
                </Card>
              )}
              {inmuebles.map(inv => (
                <InmuebleCard key={`${inv.id}-${refreshKey}`} inversion={inv}
                  onClick={() => abrirModalInmueble(inv)} />
              ))}
            </>
          )}
        </div>

        {/* Panel detalle */}
        {seleccionada && tab === 'lista' && (
          <div className="w-[480px] space-y-4">
            <Card>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{seleccionada.nombre}</h3>
                  <p className="text-slate-400 text-sm">{seleccionada.entidad_nombre}</p>
                </div>
                <button onClick={() => setSeleccionada(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-900 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs">Tipo</p>
                  <p className="text-white font-medium mt-0.5">{seleccionada.tipo_nombre || '—'}</p>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs">Riesgo</p>
                  <p className="font-medium mt-0.5" style={{ color: seleccionada.riesgo_color || '#6366f1' }}>
                    {seleccionada.riesgo_nombre || '—'}
                  </p>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs">Moneda</p>
                  <p className="text-white font-medium mt-0.5">{seleccionada.moneda_codigo}</p>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs">Estado</p>
                  <p className="text-white font-medium mt-0.5 capitalize">{seleccionada.estado}</p>
                </div>
              </div>
              {seleccionada.notas && (
                <p className="text-slate-400 text-sm mt-3 bg-slate-900 p-3 rounded-lg">{seleccionada.notas}</p>
              )}

              {/* Resumen de lotes (solo acciones/crypto) */}
              {tieneModeloLotes(seleccionada) && resumenLotes && resumenLotes.total_unidades > 0 && (
                <div className="mt-3 bg-slate-900 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs mb-2 flex items-center gap-1"><Package size={12} /> Resumen de posición</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-500">Total unidades:</span> <span className="text-white font-mono">{resumenLotes.total_unidades.toLocaleString('es-CO', { maximumFractionDigits: 8 })}</span></div>
                    <div><span className="text-slate-500">Precio promedio:</span> <span className="text-white font-mono">{formatCOP(resumenLotes.precio_promedio)}</span></div>
                    <div><span className="text-slate-500">Costo total:</span> <span className="text-white font-mono">{formatCOP(resumenLotes.costo_total)}</span></div>
                    <div><span className="text-slate-500">Comisiones:</span> <span className="text-amber-400 font-mono">{formatCOP(resumenLotes.total_comisiones)}</span></div>
                    {ultimoSaldo > 0 && (
                      <>
                        <div><span className="text-slate-500">Valor actual:</span> <span className="text-white font-mono">{formatCOP(ultimoSaldo)}</span></div>
                        <div><span className="text-slate-500">Rendimiento:</span> <span className={`font-mono ${rendimientoLotes >= 0 ? 'text-green-400' : 'text-red-400'}`}>{rendimientoLotes >= 0 ? '+' : ''}{formatCOP(rendimientoLotes)} ({formatPct(rendimientoPctLotes)})</span></div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Ficha técnica resumen (CDT u otros) */}
             {ficha && !tieneModeloLotes(seleccionada) && getTipoFicha(seleccionada) === 'cdt' && (() => {
                const fechaVenc = (() => {
                  if (!seleccionada?.fecha_inicio || !ficha.plazo_dias) return null
                  const d = new Date(seleccionada.fecha_inicio)
                  d.setDate(d.getDate() + Number(ficha.plazo_dias))
                  return d.toISOString().split('T')[0]
                })()
                return (
                  <div className="mt-3 bg-slate-900 p-3 rounded-lg">
                    <p className="text-slate-400 text-xs mb-2 flex items-center gap-1"><FileText size={12} /> Ficha técnica CDT</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {ficha.tasa_ea && <div><span className="text-slate-500">Tasa EA:</span> <span className="text-green-400 font-mono">{ficha.tasa_ea}%</span></div>}
                      {ficha.plazo_dias && <div><span className="text-slate-500">Plazo:</span> <span className="text-white">{ficha.plazo_dias} días</span></div>}
                      {ficha.retencion_pct !== undefined && <div><span className="text-slate-500">Retención:</span> <span className="text-white">{ficha.retencion_pct}%</span></div>}
                      {fechaVenc && <div><span className="text-slate-500">Vence:</span> <span className="text-amber-400">{fechaVenc}</span></div>}
                    </div>
                  </div>
                )
              })()}

              {ficha && !tieneModeloLotes(seleccionada) && getTipoFicha(seleccionada) !== 'cdt' && (
                <div className="mt-3 bg-slate-900 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs mb-2 flex items-center gap-1"><FileText size={12} /> Ficha técnica</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ficha.tasa_ea && <div><span className="text-slate-500">Tasa EA:</span> <span className="text-green-400 font-mono">{ficha.tasa_ea}%</span></div>}
                  </div>
                </div>
              )}

              {/* Ficha referencia para acciones/crypto */}
              {ficha && tieneModeloLotes(seleccionada) && (ficha.ticker || ficha.mercado || ficha.token_symbol) && (
                <div className="mt-3 bg-slate-900 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs mb-2 flex items-center gap-1"><FileText size={12} /> Referencia</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ficha.ticker && <div><span className="text-slate-500">Ticker:</span> <span className="text-white">{ficha.ticker}</span></div>}
                    {ficha.mercado && <div><span className="text-slate-500">Mercado:</span> <span className="text-white">{ficha.mercado}</span></div>}
                    {ficha.token_symbol && <div><span className="text-slate-500">Symbol:</span> <span className="text-white">{ficha.token_symbol}</span></div>}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => editarInversion(seleccionada)}
                    className="flex items-center gap-1.5 px-3 py-2 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors text-sm">
                    <Pencil size={14} /> Editar
                  </button>
                  {!tieneModeloLotes(seleccionada) && getTipoFicha(seleccionada) !== 'sinficha' &&(
                    <button onClick={abrirModalFicha}
                      className="flex items-center gap-1.5 px-3 py-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors text-sm">
                      <FileText size={14} /> Ficha
                    </button>
                  )}
                  {tieneModeloLotes(seleccionada) && (
                    <>
                      <button onClick={() => setModalLote(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors text-sm">
                        <Plus size={14} /> Compra
                      </button>
                      <button onClick={abrirModalFicha}
                        className="flex items-center gap-1.5 px-3 py-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors text-sm">
                        <FileText size={14} /> Ref.
                      </button>
                    </>
                  )}
                </div>
                <button onClick={() => eliminarInversion(seleccionada.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm">
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>

            {/* Historial de lotes (solo acciones/crypto) */}
            {tieneModeloLotes(seleccionada) && lotes.length > 0 && (
              <Card>
                <h4 className="text-white font-semibold mb-3 text-sm">Historial de compras</h4>
                <div className="space-y-2">
                  {lotes.map(l => (
                    <div key={l.id} className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400">{l.fecha_compra}</span>
                          <span className="text-white font-mono">{l.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 8 })} uds</span>
                          <span className="text-slate-400">×</span>
                          <span className="text-white font-mono">{formatCOP(l.precio_unitario)}</span>
                          {l.comision > 0 && <span className="text-amber-400 font-mono text-[10px]">+{formatCOP(l.comision)} com.</span>}
                        </div>
                        {l.nota && <p className="text-slate-500 text-[10px] mt-0.5">{l.nota}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-mono text-xs">{formatCOP(l.cantidad * l.precio_unitario + l.comision)}</span>
                        <button onClick={(e) => { e.stopPropagation(); eliminarLote(l.id) }}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Gráfica */}
            {historial.length > 0 && (
              <Card>
                <h4 className="text-white font-semibold mb-3 text-sm">Evolución del saldo</h4>
                <ReactApexChart options={lineOptions}
                  series={[{ name: 'Saldo', data: historial.map(h => h.saldo_cierre) }]}
                  type="area" height={200} />
              </Card>
            )}

            {/* Historial mensual */}
            {historial.length > 0 && (
              <Card>
                <h4 className="text-white font-semibold mb-3 text-sm">Historial mensual</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2">Mes</th>
                        <th className="text-right py-2">Saldo</th>
                        <th className="text-right py-2">Aportes</th>
                        <th className="text-right py-2">Rendim.</th>
                        <th className="text-right py-2">Rentab.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {[...historial].reverse().map(h => (
                        <tr key={h.id} className="hover:bg-slate-700/20">
                          <td className="py-1.5 text-slate-300">{MESES_NOMBRES[h.mes!].slice(0, 3)} {h.anio}</td>
                          <td className="py-1.5 text-right font-mono text-white">{formatCOP(h.saldo_cierre)}</td>
                          <td className="py-1.5 text-right font-mono text-slate-400">{formatCOP(h.aportes)}</td>
                          <td className={`py-1.5 text-right font-mono ${h.rendimiento >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCOP(h.rendimiento)}
                          </td>
                          <td className={`py-1.5 text-right font-mono ${h.rentabilidad_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPct(h.rentabilidad_pct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Modal nueva/editar inversión */}
      <Modal open={modalInversion} onClose={() => { setModalInversion(false); setForm({ estado: 'activo' }) }}
        titulo={form.id ? 'Editar Inversión' : 'Nueva Inversión'}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Nombre <span className="text-red-400">*</span></label>
            <input value={form.nombre || ''} onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: PF CIBEST, BTC, CDT Bancolombia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1">Entidad</label>
              <select value={form.entidad_id || ''} onChange={e => setForm((p: any) => ({ ...p, entidad_id: Number(e.target.value) }))}>
                <option value="">Sin entidad</option>
                {entidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Tipo de inversión</label>
              <select value={form.tipo_id || ''} onChange={e => setForm((p: any) => ({ ...p, tipo_id: Number(e.target.value) }))}>
                <option value="">Sin tipo</option>
                {tiposInversion.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Perfil de riesgo</label>
              <select value={form.riesgo_id || ''} onChange={e => setForm((p: any) => ({ ...p, riesgo_id: Number(e.target.value) }))}>
                <option value="">Sin perfil</option>
                {perfilesRiesgo.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Moneda</label>
              <select value={form.moneda_id || ''} onChange={e => setForm((p: any) => ({ ...p, moneda_id: Number(e.target.value) }))}>
                <option value="">Seleccionar</option>
                {monedas.map(m => <option key={m.id} value={m.id}>{m.codigo} — {m.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio || ''} onChange={e => setForm((p: any) => ({ ...p, fecha_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Estado</label>
              <select value={form.estado || 'activo'} onChange={e => setForm((p: any) => ({ ...p, estado: e.target.value }))}>
                <option value="activo">Activo</option>
                <option value="pausado">Pausado</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
          </div>

          {/* Saldo inicial OPCIONAL — no aplica para inmuebles */}
          {!form.id && getTipoNombre(form.tipo_id) !== 'inmueble' && (
            <div>
              <label className="text-slate-400 text-sm block mb-1">Saldo inicial <span className="text-slate-600">(opcional)</span></label>
              <input type="number" value={form.saldo_inicial || ''} placeholder="¿Cuánto vale hoy tu posición? (0 si es nueva)"
                onChange={e => setForm((p: any) => ({ ...p, saldo_inicial: Number(e.target.value) }))} />
              <p className="text-slate-500 text-xs mt-1">Usa esto si ya tienes una posición y quieres empezar a trackear. Déjalo vacío si empiezas de cero.</p>
            </div>
          )}

          <div>
            <label className="text-slate-400 text-sm block mb-1">Notas</label>
            <textarea value={form.notas || ''} onChange={e => setForm((p: any) => ({ ...p, notas: e.target.value }))}
              placeholder="Información adicional..." rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setModalInversion(false); setForm({ estado: 'activo' }) }}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">Cancelar</button>
            <button onClick={guardarInversion} disabled={!formValido}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {form.id ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal registrar lote de compra */}
      <Modal open={modalLote} onClose={() => setModalLote(false)}
        titulo={`Registrar compra — ${seleccionada?.nombre}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1">Fecha de compra <span className="text-red-400">*</span></label>
              <input type="date" value={formLote.fecha_compra || ''}
                onChange={e => setFormLote((p: any) => ({ ...p, fecha_compra: e.target.value }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">
                {getTipoFicha(seleccionada) === 'crypto' ? 'Cantidad de tokens' : 'Número de acciones'} <span className="text-red-400">*</span>
              </label>
              <input type="number" step="0.00000001" value={formLote.cantidad || ''} placeholder="0"
                onChange={e => setFormLote((p: any) => ({ ...p, cantidad: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Precio unitario <span className="text-red-400">*</span></label>
              <input type="number" step="0.01" value={formLote.precio_unitario || ''} placeholder="Precio por unidad"
                onChange={e => setFormLote((p: any) => ({ ...p, precio_unitario: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Comisión</label>
              <input type="number" step="0.01" value={formLote.comision || ''} placeholder="0"
                onChange={e => setFormLote((p: any) => ({ ...p, comision: Number(e.target.value) }))} />
            </div>
          </div>
          {/* Subtotal */}
          {formLote.cantidad > 0 && formLote.precio_unitario > 0 && (
            <div className="bg-slate-900 p-3 rounded-lg text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="text-white font-mono">{formatCOP(formLote.cantidad * formLote.precio_unitario)}</span>
              </div>
              {formLote.comision > 0 && (
                <div className="flex justify-between text-slate-400 mt-1">
                  <span>+ Comisión:</span>
                  <span className="text-amber-400 font-mono">{formatCOP(formLote.comision)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-semibold mt-2 pt-2 border-t border-slate-700">
                <span>Total:</span>
                <span className="font-mono">{formatCOP(formLote.cantidad * formLote.precio_unitario + (formLote.comision || 0))}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-slate-400 text-sm block mb-1">Nota</label>
            <input value={formLote.nota || ''} placeholder="Ej: Compra programada mensual"
              onChange={e => setFormLote((p: any) => ({ ...p, nota: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalLote(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarLote}
              disabled={!formLote.fecha_compra || !formLote.cantidad || !formLote.precio_unitario}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Registrar compra
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal ficha técnica */}
      <Modal open={modalFicha} onClose={() => setModalFicha(false)}
        titulo={`${tieneModeloLotes(seleccionada) ? 'Datos de referencia' : 'Ficha Técnica'} — ${seleccionada?.nombre}`} ancho="max-w-lg">
        <div className="space-y-4">
          {getTipoFicha(seleccionada) === 'cdt' && (() => {
            // Calcular fecha de vencimiento al vuelo
            const fechaVencimiento = (() => {
              if (!seleccionada?.fecha_inicio || !formFicha.plazo_dias) return null
              const d = new Date(seleccionada.fecha_inicio)
              d.setDate(d.getDate() + Number(formFicha.plazo_dias))
              return d.toISOString().split('T')[0]
            })()

            // Calcular rendimientos al vuelo usando saldo_cierre del primer mes
            const montoBase = historial.length > 0 ? historial[0].saldo_cierre : 0
            const tasaEA = formFicha.tasa_ea || 0
            const plazo = formFicha.plazo_dias || 0
            const retencion = formFicha.retencion_pct ?? 4
            const rendBruto = montoBase * (tasaEA / 100) * (plazo / 365)
            const retFuente = rendBruto * (retencion / 100)
            const rendNeto = rendBruto - retFuente
            const valorVencimiento = montoBase + rendNeto

            return (
              <>
                <p className="text-indigo-400 text-xs font-semibold uppercase">CDT / Renta fija</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Tasa EA (%)</label>
                    <input type="number" step="0.01" value={formFicha.tasa_ea || ''} placeholder="Ej: 12.5"
                      onChange={e => setFormFicha(p => ({ ...p, tasa_ea: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Plazo (días)</label>
                    <input type="number" value={formFicha.plazo_dias || ''} placeholder="90, 180, 360..."
                      onChange={e => setFormFicha(p => ({ ...p, plazo_dias: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Retención en la fuente (%)</label>
                    <input type="number" step="0.1" value={formFicha.retencion_pct ?? 4} placeholder="4"
                      onChange={e => setFormFicha(p => ({ ...p, retencion_pct: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Fecha vencimiento</label>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                      {fechaVencimiento
                        ? <span className="text-white">{fechaVencimiento}</span>
                        : <span className="text-slate-500 text-xs">Requiere fecha inicio y plazo</span>}
                    </div>
                  </div>
                </div>

                {/* Proyección de rendimientos */}
                {montoBase > 0 && tasaEA > 0 && plazo > 0 && (
                  <div className="bg-slate-900 rounded-lg p-3 space-y-1.5 text-xs mt-1">
                    <p className="text-slate-400 font-semibold mb-2">Proyección al vencimiento</p>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monto invertido:</span>
                      <span className="text-white font-mono">{formatCOP(montoBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rendimiento bruto:</span>
                      <span className="text-green-400 font-mono">+{formatCOP(rendBruto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Retención ({retencion}%):</span>
                      <span className="text-red-400 font-mono">−{formatCOP(retFuente)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-1.5">
                      <span className="text-slate-400 font-semibold">Rendimiento neto:</span>
                      <span className="text-green-400 font-mono font-semibold">+{formatCOP(rendNeto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Valor al vencimiento:</span>
                      <span className="text-white font-mono font-semibold">{formatCOP(valorVencimiento)}</span>
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {getTipoFicha(seleccionada) === 'acciones' && (
            <>
              <p className="text-indigo-400 text-xs font-semibold uppercase">Datos de referencia — Acciones</p>
              <p className="text-slate-500 text-xs">Las compras se registran desde el botón "+ Compra". Aquí solo datos informativos.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-sm block mb-1">Ticker</label>
                  <input value={formFicha.ticker || ''} placeholder="PFCIBEST, AAPL..."
                    onChange={e => setFormFicha(p => ({ ...p, ticker: e.target.value }))} />
                </div>
                <div>
                  <label className="text-slate-400 text-sm block mb-1">Mercado</label>
                  <input value={formFicha.mercado || ''} placeholder="BVC, NYSE..."
                    onChange={e => setFormFicha(p => ({ ...p, mercado: e.target.value }))} />
                </div>
              </div>
            </>
          )}

          {getTipoFicha(seleccionada) === 'crypto' && (
            <>
              <p className="text-indigo-400 text-xs font-semibold uppercase">Datos de referencia — Crypto</p>
              <p className="text-slate-500 text-xs">Las compras se registran desde el botón "+ Compra". Aquí solo datos informativos.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-sm block mb-1">Token / Símbolo</label>
                  <input value={formFicha.token_symbol || ''} placeholder="BTC, ETH, SOL..."
                    onChange={e => setFormFicha(p => ({ ...p, token_symbol: e.target.value }))} />
                </div>
                <div>
                  <label className="text-slate-400 text-sm block mb-1">Mercado / Exchange</label>
                  <input value={formFicha.mercado || ''} placeholder="Binance, Coinbase..."
                    onChange={e => setFormFicha(p => ({ ...p, mercado: e.target.value }))} />
                </div>
              </div>
            </>
          )}

          {getTipoFicha(seleccionada) === 'otro' && (
            <>
              <p className="text-indigo-400 text-xs font-semibold uppercase">Datos generales</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-sm block mb-1">Tasa EA (%)</label>
                  <input type="number" step="0.01" value={formFicha.tasa_ea || ''} placeholder="Opcional"
                    onChange={e => setFormFicha(p => ({ ...p, tasa_ea: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-slate-400 text-sm block mb-1">Monto inicial</label>
                  <input type="number" value={formFicha.monto_inicial || ''} placeholder="0"
                    onChange={e => setFormFicha(p => ({ ...p, monto_inicial: Number(e.target.value) }))} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalFicha(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarFicha}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal inmueble */}
      <Modal open={modalInmueble} onClose={() => setModalInmueble(false)}
        titulo={`Inmueble — ${seleccionada?.nombre}`} ancho="max-w-2xl">
        <div className="space-y-5">

          {/* General */}
          <div>
            <p className="text-indigo-400 text-xs font-semibold uppercase mb-3">Datos generales</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-sm block mb-1">Precio de compra total <span className="text-red-400">*</span></label>
                <input type="number" value={formInmueble.precio_compra_total || ''}
                  placeholder="0"
                  onChange={e => setFormInmueble(p => ({ ...p, precio_compra_total: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Valor estimado actual</label>
                <input type="number" value={formInmueble.valor_estimado_actual || ''}
                  placeholder="0 — actualizar cuando se conozca"
                  onChange={e => setFormInmueble(p => ({ ...p, valor_estimado_actual: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Fecha entrega estimada</label>
                <input type="date" value={formInmueble.fecha_entrega_estimada || ''}
                  onChange={e => setFormInmueble(p => ({ ...p, fecha_entrega_estimada: e.target.value }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Estado</label>
                <select value={formInmueble.estado || 'en_construccion'}
                  onChange={e => setFormInmueble(p => ({ ...p, estado: e.target.value }))}>
                  <option value="en_construccion">En construcción</option>
                  <option value="recibido">Recibido</option>
                  <option value="en_arriendo">En arriendo</option>
                  <option value="vendido">Vendido</option>
                </select>
              </div>
            </div>
          </div>

          {/* Etapa 1 */}
          <div>
            <p className="text-amber-400 text-xs font-semibold uppercase mb-3">Etapa 1 — Separación</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-slate-400 text-sm block mb-1">Monto de separación</label>
                <input type="number" value={formInmueble.monto_separacion || ''}
                  placeholder="0"
                  onChange={e => setFormInmueble(p => ({ ...p, monto_separacion: Number(e.target.value) }))} />
              </div>
            </div>
          </div>

          {/* Etapa 2 */}
          <div>
            <p className="text-cyan-400 text-xs font-semibold uppercase mb-3">Etapa 2 — Cuota inicial (30%)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-sm block mb-1">Total cuota inicial</label>
                <input type="number" value={formInmueble.cuota_inicial_total || ''}
                  placeholder="0"
                  onChange={e => setFormInmueble(p => ({ ...p, cuota_inicial_total: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Número de cuotas</label>
                <input type="number" value={formInmueble.cuota_inicial_num_cuotas || ''}
                  placeholder="0"
                  onChange={e => setFormInmueble(p => ({ ...p, cuota_inicial_num_cuotas: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Valor por cuota</label>
                <input type="number" value={formInmueble.cuota_inicial_valor_cuota || ''}
                  placeholder="0"
                  onChange={e => setFormInmueble(p => ({ ...p, cuota_inicial_valor_cuota: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Cuotas pagadas</label>
                <input type="number" value={formInmueble.cuota_inicial_cuotas_pagadas || 0}
                  onChange={e => setFormInmueble(p => ({ ...p, cuota_inicial_cuotas_pagadas: Number(e.target.value) }))} />
              </div>
            </div>
            {/* Progreso cuota inicial */}
            {(formInmueble.cuota_inicial_num_cuotas || 0) > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Progreso cuota inicial</span>
                  <span>{Math.round(((formInmueble.cuota_inicial_cuotas_pagadas || 0) / (formInmueble.cuota_inicial_num_cuotas || 1)) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round(((formInmueble.cuota_inicial_cuotas_pagadas || 0) / (formInmueble.cuota_inicial_num_cuotas || 1)) * 100))}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Etapa 3 */}
          <div>
            <p className="text-green-400 text-xs font-semibold uppercase mb-3">Etapa 3 — Financiación (70%)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-slate-400 text-sm block mb-1">Entidad financiera</label>
                <select value={formInmueble.financiacion_entidad_id || ''}
                  onChange={e => setFormInmueble(p => ({ ...p, financiacion_entidad_id: Number(e.target.value) || undefined }))}>
                  <option value="">Sin entidad</option>
                  {entidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Monto financiado</label>
                <input type="number" value={formInmueble.financiacion_monto || ''}
                  placeholder="0"
                  onChange={e => setFormInmueble(p => ({ ...p, financiacion_monto: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Plazo (meses)</label>
                <input type="number" value={formInmueble.financiacion_plazo_meses || ''}
                  placeholder="120, 180, 240..."
                  onChange={e => setFormInmueble(p => ({ ...p, financiacion_plazo_meses: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Valor cuota mensual</label>
                <input type="number" value={formInmueble.financiacion_valor_cuota || ''}
                  placeholder="0"
                  onChange={e => setFormInmueble(p => ({ ...p, financiacion_valor_cuota: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Cuotas pagadas</label>
                <input type="number" value={formInmueble.financiacion_cuotas_pagadas || 0}
                  onChange={e => setFormInmueble(p => ({ ...p, financiacion_cuotas_pagadas: Number(e.target.value) }))} />
              </div>
            </div>
            {/* Progreso financiación */}
            {(formInmueble.financiacion_plazo_meses || 0) > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Progreso financiación</span>
                  <span>{Math.round(((formInmueble.financiacion_cuotas_pagadas || 0) / (formInmueble.financiacion_plazo_meses || 1)) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round(((formInmueble.financiacion_cuotas_pagadas || 0) / (formInmueble.financiacion_plazo_meses || 1)) * 100))}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalInmueble(false)}
              className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarInmueble}
              disabled={!formInmueble.precio_compra_total}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── InmuebleCard ────────────────────────────────────────
function InmuebleCard({ inversion, onClick }: { inversion: Inversion; onClick: () => void }) {
  const [inmueble, setInmueble] = useState<Inmueble | null>(null)

  useEffect(() => {
    window.electronAPI.getInmueble(inversion.id).then(setInmueble)
  }, [inversion.id])

  const plusvalia = inmueble
    ? (inmueble.valor_estimado_actual || 0) - inmueble.precio_compra_total : 0

  const progresoCuotaInicial = inmueble && inmueble.cuota_inicial_num_cuotas
    ? Math.round((inmueble.cuota_inicial_cuotas_pagadas / inmueble.cuota_inicial_num_cuotas) * 100) : 0

  const progresoFinanciacion = inmueble && inmueble.financiacion_plazo_meses
    ? Math.round((inmueble.financiacion_cuotas_pagadas / inmueble.financiacion_plazo_meses) * 100) : 0

  const pagadoSeparacion = inmueble?.monto_separacion || 0
  const pagadoCuotaInicial = inmueble
    ? (inmueble.cuota_inicial_valor_cuota || 0) * inmueble.cuota_inicial_cuotas_pagadas : 0
  const pagadoFinanciacion = inmueble
    ? (inmueble.financiacion_valor_cuota || 0) * inmueble.financiacion_cuotas_pagadas : 0
  const totalPagado = pagadoSeparacion + pagadoCuotaInicial + pagadoFinanciacion

  const estadoColors: Record<string, string> = {
    en_construccion: '#eab308', recibido: '#22c55e', en_arriendo: '#06b6d4', vendido: '#8b5cf6',
  }
  const estadoLabels: Record<string, string> = {
    en_construccion: 'En construcción', recibido: 'Recibido',
    en_arriendo: 'En arriendo', vendido: 'Vendido',
  }

  return (
    <Card onClick={onClick} className="space-y-4 cursor-pointer">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-indigo-400" />
            <p className="text-white font-semibold">{inversion.nombre}</p>
            {inmueble && (
              <Badge label={estadoLabels[inmueble.estado] || inmueble.estado}
                color={estadoColors[inmueble.estado] || '#6366f1'} />
            )}
          </div>
          <p className="text-slate-500 text-xs">{inversion.entidad_nombre || 'Sin entidad'}</p>
        </div>
        {inmueble?.fecha_entrega_estimada && (
          <div className="text-right">
            <p className="text-slate-400 text-xs">Entrega estimada</p>
            <p className="text-slate-300 text-sm">{inmueble.fecha_entrega_estimada}</p>
          </div>
        )}
      </div>

      {inmueble ? (
        <>
          {/* Métricas generales */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">Precio compra</p>
              <p className="text-white font-mono font-bold text-sm mt-0.5">{formatCOP(inmueble.precio_compra_total)}</p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">Valor actual</p>
              <p className="text-white font-mono font-bold text-sm mt-0.5">
                {inmueble.valor_estimado_actual ? formatCOP(inmueble.valor_estimado_actual) : '—'}
              </p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">Plusvalía</p>
              <p className={`font-mono font-bold text-sm mt-0.5 ${plusvalia > 0 ? 'text-green-400' : plusvalia < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {inmueble.valor_estimado_actual ? formatCOP(plusvalia) : '—'}
              </p>
            </div>
          </div>

          {/* Etapas */}
          <div className="space-y-3">
            {/* Etapa 1 */}
            {inmueble.monto_separacion > 0 && (
              <div className="bg-slate-900 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <p className="text-amber-400 text-xs font-semibold">Etapa 1 — Separación</p>
                  <p className="text-white font-mono text-xs">{formatCOP(inmueble.monto_separacion)}</p>
                </div>
              </div>
            )}

            {/* Etapa 2 */}
            {inmueble.cuota_inicial_num_cuotas > 0 && (
              <div className="bg-slate-900 p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-cyan-400 text-xs font-semibold">Etapa 2 — Cuota inicial</p>
                  <p className="text-white text-xs font-mono">
                    {inmueble.cuota_inicial_cuotas_pagadas} / {inmueble.cuota_inicial_num_cuotas} cuotas
                  </p>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Pagado: <span className="text-white font-mono">{formatCOP(pagadoCuotaInicial)}</span></span>
                  <span>Cuota: <span className="text-white font-mono">{formatCOP(inmueble.cuota_inicial_valor_cuota)}</span></span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{ width: `${progresoCuotaInicial}%` }} />
                </div>
              </div>
            )}

            {/* Etapa 3 */}
            {inmueble.financiacion_plazo_meses > 0 && (
              <div className="bg-slate-900 p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-green-400 text-xs font-semibold">Etapa 3 — Financiación</p>
                  <p className="text-white text-xs font-mono">
                    {inmueble.financiacion_cuotas_pagadas} / {inmueble.financiacion_plazo_meses} cuotas
                  </p>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Pagado: <span className="text-white font-mono">{formatCOP(pagadoFinanciacion)}</span></span>
                  <span>Cuota: <span className="text-white font-mono">{formatCOP(inmueble.financiacion_valor_cuota)}</span></span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${progresoFinanciacion}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Total pagado */}
          <div className="flex justify-between items-center pt-1 border-t border-slate-700">
            <p className="text-slate-400 text-xs">Total desembolsado</p>
            <p className="text-white font-mono font-bold text-sm">{formatCOP(totalPagado)}</p>
          </div>
        </>
      ) : (
        <p className="text-slate-500 text-sm">Click para agregar datos del inmueble</p>
      )}
    </Card>
  )
}