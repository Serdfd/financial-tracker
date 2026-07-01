import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import ReactApexChart from 'react-apexcharts'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { PresupuestoFijo, PresupuestoVariable, PresupuestoCategoria } from '@/types'
import { formatCOP, MESES_NOMBRES } from '@/lib/format'

export function Presupuesto() {
  const { categorias, mesActivo, anioActivo, setMesActivo } = useAppStore()
  const [fijos, setFijos] = useState<PresupuestoFijo[]>([])
  const [variables, setVariables] = useState<PresupuestoVariable[]>([])
  const [presupuestoCats, setPresupuestoCats] = useState<PresupuestoCategoria[]>([])
  const [gastosReales, setGastosReales] = useState<Record<number, number>>({})
  const [modalFijo, setModalFijo] = useState(false)
  const [modalVariable, setModalVariable] = useState(false)
  const [modalCat, setModalCat] = useState(false)
  const [editandoFijo, setEditandoFijo] = useState<Partial<PresupuestoFijo>>({})
  const [editandoVariable, setEditandoVariable] = useState<Partial<PresupuestoVariable>>({})
  const [editandoCat, setEditandoCat] = useState<Partial<PresupuestoCategoria>>({})

  const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')

  useEffect(() => { cargar() }, [mesActivo, anioActivo])

  async function cargar() {
    const [f, v, pc] = await Promise.all([
      window.electronAPI.getPresupuestoFijos(),
      window.electronAPI.getPresupuestoVariables(),
      window.electronAPI.getPresupuestoCategorias(),
    ])
    setFijos(f)
    setVariables(v)
    setPresupuestoCats(pc)
    await cargarGastosReales()
  }

  async function cargarGastosReales() {
    const mes = await window.electronAPI.getOrCreateMes(anioActivo, mesActivo)
    const gastos = await window.electronAPI.getGastosMes(mes.id)
    const totales: Record<number, number> = {}
    gastos.forEach(g => {
      totales[g.categoria_id] = (totales[g.categoria_id] || 0) + g.monto
    })
    setGastosReales(totales)
  }

  async function guardarFijo() {
    await window.electronAPI.savePresupuestoFijo(editandoFijo)
    setModalFijo(false); setEditandoFijo({}); cargar()
  }

  async function guardarVariable() {
    await window.electronAPI.savePresupuestoVariable(editandoVariable)
    setModalVariable(false); setEditandoVariable({}); cargar()
  }

  async function guardarCat() {
    await window.electronAPI.savePresupuestoCategoria(editandoCat)
    setModalCat(false); setEditandoCat({}); cargar()
  }

  async function eliminarFijo(id: number) {
    if (!confirm('¿Eliminar?')) return
    await window.electronAPI.deletePresupuestoFijo(id); cargar()
  }

  async function eliminarVariable(id: number) {
    if (!confirm('¿Eliminar?')) return
    await window.electronAPI.deletePresupuestoVariable(id); cargar()
  }

  async function eliminarCat(id: number) {
    if (!confirm('¿Eliminar?')) return
    await window.electronAPI.deletePresupuestoCategoria(id); cargar()
  }

  const fijoValido = !!(editandoFijo.nombre?.trim() && editandoFijo.monto && editandoFijo.monto > 0 && editandoFijo.categoria_id)
  const variableValido = !!(editandoVariable.nombre?.trim() && editandoVariable.tope_mensual && editandoVariable.tope_mensual > 0 && editandoVariable.categoria_id)
  const catValido = !!(editandoCat.categoria_id && editandoCat.tope_mensual && editandoCat.tope_mensual > 0)

  const totalFijos = fijos.reduce((s, f) => s + f.monto, 0)

  // Datos para gráfica por categoría
  const barOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    colors: ['#6366f1', '#ef4444'],
    plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      labels: {
        style: { colors: '#94a3b8' },
        formatter: (v) => `$${(Number(v) / 1_000_000).toFixed(1)}M`
      }
    },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    legend: { labels: { colors: '#94a3b8' } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const barSeries = [
    { name: 'Presupuesto', data: presupuestoCats.map(pc => ({ x: pc.categoria_nombre, y: pc.tope_mensual })) },
    { name: 'Real', data: presupuestoCats.map(pc => ({ x: pc.categoria_nombre, y: gastosReales[pc.categoria_id] || 0 })) },
  ]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Presupuesto</h1>
          <p className="text-slate-400 text-sm mt-0.5">Control de gastos y presupuesto por categoría</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mesActivo} onChange={e => setMesActivo(Number(e.target.value), anioActivo)} className="w-36">
            {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select value={anioActivo} onChange={e => setMesActivo(mesActivo, Number(e.target.value))} className="w-24">
            {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── PRESUPUESTO POR CATEGORÍA ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Presupuesto por categoría</h3>
            <p className="text-slate-500 text-xs mt-0.5">Tope mensual por categoría vs gasto real del mes</p>
          </div>
          <button onClick={() => { setEditandoCat({}); setModalCat(true) }}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
            <Plus size={14} /> Agregar
          </button>
        </div>
        {presupuestoCats.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Sin categorías configuradas</p>
        ) : (
          <div className="space-y-3">
            {presupuestoCats.map(pc => {
              const real = gastosReales[pc.categoria_id] || 0
              const pct = pc.tope_mensual > 0 ? Math.min((real / pc.tope_mensual) * 100, 100) : 0
              const excedido = real > pc.tope_mensual
              return (
                <div key={pc.id} className="bg-slate-900 px-3 py-2.5 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span>{pc.categoria_emoji || ''}</span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pc.categoria_color || '#6366f1' }} />
                      <p className="text-white text-sm font-medium">{pc.categoria_nombre}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono ${excedido ? 'text-red-400' : 'text-slate-400'}`}>
                        {formatCOP(real)} / {formatCOP(pc.tope_mensual)}
                      </span>
                      <button onClick={() => { setEditandoCat(pc); setModalCat(true) }}
                        className="p-1 text-slate-400 hover:text-indigo-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => eliminarCat(pc.id)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: excedido ? '#ef4444' : '#22c55e' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Gráfica real vs presupuesto */}
      {presupuestoCats.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-4">Real vs Presupuesto — {MESES_NOMBRES[mesActivo]} {anioActivo}</h3>
          <ReactApexChart options={barOptions} series={barSeries} type="bar"
            height={Math.max(200, presupuestoCats.length * 45)} />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Gastos fijos */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Gastos Fijos</h3>
              <p className="text-slate-500 text-xs mt-0.5">Conceptos de referencia</p>
            </div>
            <button onClick={() => { setEditandoFijo({}); setModalFijo(true) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
          {fijos.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Sin gastos fijos configurados</p>
          ) : (
            <div className="space-y-2">
              {fijos.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-slate-900 px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.categoria_color || '#6366f1' }} />
                    <div>
                      <p className="text-white text-sm font-medium">{f.nombre}</p>
                      <p className="text-slate-500 text-xs">{f.categoria_nombre}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-mono text-sm">{formatCOP(f.monto)}</p>
                    <button onClick={() => { setEditandoFijo(f); setModalFijo(true) }}
                      className="p-1 text-slate-400 hover:text-indigo-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => eliminarFijo(f.id)}
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-700 flex justify-between">
                <span className="text-slate-400 text-sm">Total</span>
                <span className="text-white font-mono font-bold">{formatCOP(totalFijos)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Gastos variables */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Gastos Variables</h3>
              <p className="text-slate-500 text-xs mt-0.5">Conceptos de referencia</p>
            </div>
            <button onClick={() => { setEditandoVariable({}); setModalVariable(true) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
          {variables.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Sin gastos variables configurados</p>
          ) : (
            <div className="space-y-2">
              {variables.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-slate-900 px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.categoria_color || '#6366f1' }} />
                    <div>
                      <p className="text-white text-sm font-medium">{v.nombre}</p>
                      <p className="text-slate-500 text-xs">{v.categoria_nombre}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-slate-400 font-mono text-sm">tope: {formatCOP(v.tope_mensual)}</p>
                    <button onClick={() => { setEditandoVariable(v); setModalVariable(true) }}
                      className="p-1 text-slate-400 hover:text-indigo-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => eliminarVariable(v.id)}
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modal presupuesto por categoría */}
      <Modal open={modalCat} onClose={() => setModalCat(false)}
        titulo={editandoCat.id ? 'Editar presupuesto' : 'Nueva categoría con presupuesto'}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Categoría <span className="text-red-400">*</span></label>
            <select value={editandoCat.categoria_id || ''}
              onChange={e => setEditandoCat(p => ({ ...p, categoria_id: Number(e.target.value) }))}>
              <option value="">Seleccionar categoría</option>
              {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Tope mensual <span className="text-red-400">*</span></label>
            <input type="number" value={editandoCat.tope_mensual || ''} placeholder="0"
              onChange={e => setEditandoCat(p => ({ ...p, tope_mensual: Number(e.target.value) }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalCat(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarCat} disabled={!catValido}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal gasto fijo */}
      <Modal open={modalFijo} onClose={() => setModalFijo(false)} titulo={editandoFijo.id ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Nombre <span className="text-red-400">*</span></label>
            <input value={editandoFijo.nombre || ''} placeholder="Ej: Arriendo"
              onChange={e => setEditandoFijo(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Categoría <span className="text-red-400">*</span></label>
            <select value={editandoFijo.categoria_id || ''}
              onChange={e => setEditandoFijo(p => ({ ...p, categoria_id: Number(e.target.value) }))}>
              <option value="">Seleccionar categoría</option>
              {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Monto mensual <span className="text-red-400">*</span></label>
            <input type="number" value={editandoFijo.monto || ''} placeholder="0"
              onChange={e => setEditandoFijo(p => ({ ...p, monto: Number(e.target.value) }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalFijo(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarFijo} disabled={!fijoValido}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal gasto variable */}
      <Modal open={modalVariable} onClose={() => setModalVariable(false)} titulo={editandoVariable.id ? 'Editar Gasto Variable' : 'Nuevo Gasto Variable'}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Nombre <span className="text-red-400">*</span></label>
            <input value={editandoVariable.nombre || ''} placeholder="Ej: Alimentación"
              onChange={e => setEditandoVariable(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Categoría <span className="text-red-400">*</span></label>
            <select value={editandoVariable.categoria_id || ''}
              onChange={e => setEditandoVariable(p => ({ ...p, categoria_id: Number(e.target.value) }))}>
              <option value="">Seleccionar categoría</option>
              {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Tope mensual <span className="text-red-400">*</span></label>
            <input type="number" value={editandoVariable.tope_mensual || ''} placeholder="0"
              onChange={e => setEditandoVariable(p => ({ ...p, tope_mensual: Number(e.target.value) }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalVariable(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarVariable} disabled={!variableValido}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}