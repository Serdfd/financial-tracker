import { useEffect, useState } from 'react'
import { Plus, ChevronRight, TrendingUp, Building2, X } from 'lucide-react'
import ReactApexChart from 'react-apexcharts'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { Inversion, InversionMensual, Inmueble } from '@/types'
import { formatCOP, formatPct, MESES_NOMBRES, nombreMes } from '@/lib/format'

export function Inversiones() {
  const { entidades, tiposInversion, perfilesRiesgo, monedas, cargarCatalogos } = useAppStore()
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [seleccionada, setSeleccionada] = useState<Inversion | null>(null)
  const [historial, setHistorial] = useState<InversionMensual[]>([])
  const [inmueble, setInmueble] = useState<Inmueble | null>(null)
  const [modalInversion, setModalInversion] = useState(false)
  const [modalInmueble, setModalInmueble] = useState(false)
  const [tab, setTab] = useState<'lista' | 'inmuebles'>('lista')

  // Formulario nueva inversión
  const [form, setForm] = useState<Partial<Inversion>>({ estado: 'activo' })
  const [formInmueble, setFormInmueble] = useState<Partial<Inmueble>>({ estado: 'en_construccion', cuotas_pagadas: 0 })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const inv = await window.electronAPI.getInversiones()
    setInversiones(inv)
  }

  async function verDetalle(inv: Inversion) {
    setSeleccionada(inv)
    const h = await window.electronAPI.getInversionMensual(inv.id)
    setHistorial(h)
    const inm = await window.electronAPI.getInmueble(inv.id)
    setInmueble(inm)
  }

  async function guardarInversion() {
    await window.electronAPI.saveInversion(form)
    await cargarCatalogos()
    await cargar()
    setModalInversion(false)
    setForm({ estado: 'activo' })
  }

  async function guardarInmueble() {
    if (!seleccionada) return
    await window.electronAPI.saveInmueble({ ...formInmueble, inversion_id: seleccionada.id })
    const inm = await window.electronAPI.getInmueble(seleccionada.id)
    setInmueble(inm)
    setModalInmueble(false)
  }

  async function eliminarInversion(id: number) {
    if (!confirm('¿Eliminar esta inversión?')) return
    await window.electronAPI.deleteInversion(id)
    await cargar()
    if (seleccionada?.id === id) setSeleccionada(null)
  }

  // Calcular saldo actual (último registro)
  function saldoActual(inv: Inversion): number {
    return 0 // Se calcula en el detalle
  }

  // Gráfica evolución
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
    yaxis: {
      labels: {
        style: { colors: '#94a3b8' },
        formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M`
      }
    },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const inversionesConTipo = inversiones.filter(i => i.tipo_nombre !== 'Inmueble')
  const inmuebles = inversiones.filter(i => i.tipo_nombre === 'Inmueble')

  return (
    <div className="p-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Inversiones</h1>
          <p className="text-slate-400 text-sm mt-0.5">Portafolio y seguimiento</p>
        </div>
        <button onClick={() => setModalInversion(true)}
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
        {/* Lista de inversiones */}
        <div className="flex-1 space-y-3">
          {tab === 'lista' && (
            <>
              {inversiones.length === 0 && (
                <Card className="text-center py-12">
                  <TrendingUp size={40} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No tienes inversiones registradas</p>
                  <button onClick={() => setModalInversion(true)}
                    className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                    Agregar primera inversión
                  </button>
                </Card>
              )}
              {inversiones.map(inv => (
                <Card key={inv.id}
                  onClick={() => verDetalle(inv)}
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
                <InmuebleCard key={inv.id} inversion={inv}
                  onClick={() => { verDetalle(inv); setModalInmueble(true) }} />
              ))}
            </>
          )}
        </div>

        {/* Panel de detalle */}
        {seleccionada && tab === 'lista' && (
          <div className="w-[480px] space-y-4">
            <Card>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{seleccionada.nombre}</h3>
                  <p className="text-slate-400 text-sm">{seleccionada.entidad_nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => eliminarInversion(seleccionada.id)}
                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                    <X size={16} />
                  </button>
                </div>
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
            </Card>

            {/* Gráfica evolución */}
            {historial.length > 0 && (
              <Card>
                <h4 className="text-white font-semibold mb-3 text-sm">Evolución del saldo</h4>
                <ReactApexChart options={lineOptions}
                  series={[{ name: 'Saldo', data: historial.map(h => h.saldo_cierre) }]}
                  type="area" height={200} />
              </Card>
            )}

            {/* Historial mes a mes */}
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

      {/* Modal nueva inversión */}
      <Modal open={modalInversion} onClose={() => setModalInversion(false)} titulo="Nueva Inversión">
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Nombre *</label>
            <input value={form.nombre || ''} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: CDT Bancolombia 90 días" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1">Entidad</label>
              <select value={form.entidad_id || ''} onChange={e => setForm(p => ({ ...p, entidad_id: Number(e.target.value) }))}>
                <option value="">Sin entidad</option>
                {entidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Tipo de inversión</label>
              <select value={form.tipo_id || ''} onChange={e => setForm(p => ({ ...p, tipo_id: Number(e.target.value) }))}>
                <option value="">Sin tipo</option>
                {tiposInversion.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Perfil de riesgo</label>
              <select value={form.riesgo_id || ''} onChange={e => setForm(p => ({ ...p, riesgo_id: Number(e.target.value) }))}>
                <option value="">Sin perfil</option>
                {perfilesRiesgo.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Moneda</label>
              <select value={form.moneda_id || ''} onChange={e => setForm(p => ({ ...p, moneda_id: Number(e.target.value) }))}>
                <option value="">Seleccionar</option>
                {monedas.map(m => <option key={m.id} value={m.id}>{m.codigo} — {m.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio || ''} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Estado</label>
              <select value={form.estado || 'activo'} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
                <option value="activo">Activo</option>
                <option value="pausado">Pausado</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Notas</label>
            <textarea value={form.notas || ''} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              placeholder="Información adicional..." rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalInversion(false)}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">
              Cancelar
            </button>
            <button onClick={guardarInversion} disabled={!form.nombre}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal datos inmueble */}
      <Modal open={modalInmueble} onClose={() => setModalInmueble(false)} titulo={`Inmueble — ${seleccionada?.nombre}`} ancho="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1">Precio de compra *</label>
              <input type="number" value={formInmueble.precio_compra || ''} placeholder="0"
                onChange={e => setFormInmueble(p => ({ ...p, precio_compra: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Valor estimado actual</label>
              <input type="number" value={formInmueble.valor_estimado_actual || ''} placeholder="0"
                onChange={e => setFormInmueble(p => ({ ...p, valor_estimado_actual: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Cuota mensual</label>
              <input type="number" value={formInmueble.cuota_mensual || ''} placeholder="0"
                onChange={e => setFormInmueble(p => ({ ...p, cuota_mensual: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Cuotas totales</label>
              <input type="number" value={formInmueble.cuotas_totales || ''} placeholder="0"
                onChange={e => setFormInmueble(p => ({ ...p, cuotas_totales: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Cuotas pagadas</label>
              <input type="number" value={formInmueble.cuotas_pagadas || 0}
                onChange={e => setFormInmueble(p => ({ ...p, cuotas_pagadas: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Fecha entrega estimada</label>
              <input type="date" value={formInmueble.fecha_entrega_estimada || ''}
                onChange={e => setFormInmueble(p => ({ ...p, fecha_entrega_estimada: e.target.value }))} />
            </div>
            <div className="col-span-2">
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
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalInmueble(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarInmueble} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm">Guardar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function InmuebleCard({ inversion, onClick }: { inversion: Inversion; onClick: () => void }) {
  const [inmueble, setInmueble] = useState<Inmueble | null>(null)

  useEffect(() => {
    window.electronAPI.getInmueble(inversion.id).then(setInmueble)
  }, [inversion.id])

  const plusvalia = inmueble ? (inmueble.valor_estimado_actual || 0) - inmueble.precio_compra : 0
  const progreso = inmueble && inmueble.cuotas_totales
    ? Math.round((inmueble.cuotas_pagadas / inmueble.cuotas_totales) * 100)
    : 0
  const pagadoHastaHoy = inmueble ? (inmueble.cuota_mensual || 0) * inmueble.cuotas_pagadas : 0

  const estadoColors: Record<string, string> = {
    en_construccion: '#eab308',
    recibido: '#22c55e',
    en_arriendo: '#06b6d4',
    vendido: '#8b5cf6',
  }
  const estadoLabels: Record<string, string> = {
    en_construccion: 'En construcción',
    recibido: 'Recibido',
    en_arriendo: 'En arriendo',
    vendido: 'Vendido',
  }

  return (
    <Card onClick={onClick} className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-indigo-400" />
            <p className="text-white font-semibold">{inversion.nombre}</p>
            {inmueble && (
              <Badge
                label={estadoLabels[inmueble.estado] || inmueble.estado}
                color={estadoColors[inmueble.estado] || '#6366f1'}
              />
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
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 p-3 rounded-lg">
            <p className="text-slate-400 text-xs">Precio compra</p>
            <p className="text-white font-mono font-bold text-sm mt-0.5">{formatCOP(inmueble.precio_compra)}</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg">
            <p className="text-slate-400 text-xs">Valor actual</p>
            <p className="text-white font-mono font-bold text-sm mt-0.5">
              {inmueble.valor_estimado_actual ? formatCOP(inmueble.valor_estimado_actual) : '—'}
            </p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg">
            <p className="text-slate-400 text-xs">Plusvalía</p>
            <p className={`font-mono font-bold text-sm mt-0.5 ${plusvalia >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {plusvalia !== 0 ? formatCOP(plusvalia) : '—'}
            </p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg">
            <p className="text-slate-400 text-xs">Pagado hasta hoy</p>
            <p className="text-cyan-400 font-mono font-bold text-sm mt-0.5">{formatCOP(pagadoHastaHoy)}</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg">
            <p className="text-slate-400 text-xs">Cuota mensual</p>
            <p className="text-white font-mono text-sm mt-0.5">
              {inmueble.cuota_mensual ? formatCOP(inmueble.cuota_mensual) : '—'}
            </p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg">
            <p className="text-slate-400 text-xs">Cuotas</p>
            <p className="text-white font-mono text-sm mt-0.5">
              {inmueble.cuotas_pagadas} / {inmueble.cuotas_totales || '?'}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-sm">Click para agregar datos del inmueble</p>
      )}

      {inmueble && inmueble.cuotas_totales && (
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progreso de cuotas</span>
            <span>{progreso}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progreso}%`, backgroundColor: estadoColors[inmueble.estado] || '#6366f1' }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}