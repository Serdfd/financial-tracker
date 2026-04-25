import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import ReactApexChart from 'react-apexcharts'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { PresupuestoFijo, PresupuestoVariable } from '@/types'
import { formatCOP, MESES_NOMBRES } from '@/lib/format'

export function Presupuesto() {
  const { categorias, mesActivo, anioActivo, setMesActivo } = useAppStore()
  const [fijos, setFijos] = useState<PresupuestoFijo[]>([])
  const [variables, setVariables] = useState<PresupuestoVariable[]>([])
  const [gastosReales, setGastosReales] = useState<Record<number, number>>({})
  const [modalFijo, setModalFijo] = useState(false)
  const [modalVariable, setModalVariable] = useState(false)
  const [editandoFijo, setEditandoFijo] = useState<Partial<PresupuestoFijo>>({})
  const [editandoVariable, setEditandoVariable] = useState<Partial<PresupuestoVariable>>({})

  const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')

  useEffect(() => { cargar() }, [mesActivo, anioActivo])

  async function cargar() {
    const [f, v] = await Promise.all([
      window.electronAPI.getPresupuestoFijos(),
      window.electronAPI.getPresupuestoVariables(),
    ])
    setFijos(f)
    setVariables(v)
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
    setModalFijo(false)
    setEditandoFijo({})
    cargar()
  }

  async function guardarVariable() {
    await window.electronAPI.savePresupuestoVariable(editandoVariable)
    setModalVariable(false)
    setEditandoVariable({})
    cargar()
  }

  async function eliminarFijo(id: number) {
    if (!confirm('¿Eliminar este gasto fijo?')) return
    await window.electronAPI.deletePresupuestoFijo(id)
    cargar()
  }

  async function eliminarVariable(id: number) {
    if (!confirm('¿Eliminar este gasto variable?')) return
    await window.electronAPI.deletePresupuestoVariable(id)
    cargar()
  }

  const totalFijos = fijos.reduce((s, f) => s + f.monto, 0)
  const totalVariablesTope = variables.reduce((s, v) => s + v.tope_mensual, 0)

  // Datos para gráfica
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
    { name: 'Tope', data: variables.map(v => ({ x: v.nombre, y: v.tope_mensual })) },
    { name: 'Real', data: variables.map(v => ({ x: v.nombre, y: gastosReales[v.categoria_id] || 0 })) },
  ]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Presupuesto</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gastos fijos y topes variables</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mesActivo} onChange={e => setMesActivo(Number(e.target.value), anioActivo)} className="w-36">
            {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select value={anioActivo} onChange={e => setMesActivo(mesActivo, Number(e.target.value))} className="w-24">
            {[2023, 2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-slate-400 text-sm">Total fijos</p>
          <p className="text-white font-mono font-bold text-xl mt-1">{formatCOP(totalFijos)}</p>
        </Card>
        <Card>
          <p className="text-slate-400 text-sm">Tope variables</p>
          <p className="text-white font-mono font-bold text-xl mt-1">{formatCOP(totalVariablesTope)}</p>
        </Card>
        <Card>
          <p className="text-slate-400 text-sm">Presupuesto total</p>
          <p className="text-indigo-400 font-mono font-bold text-xl mt-1">{formatCOP(totalFijos + totalVariablesTope)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Gastos fijos */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Gastos Fijos</h3>
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
            <h3 className="text-white font-semibold">Gastos Variables</h3>
            <button onClick={() => { setEditandoVariable({}); setModalVariable(true) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
          {variables.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Sin topes variables configurados</p>
          ) : (
            <div className="space-y-2">
              {variables.map(v => {
                const real = gastosReales[v.categoria_id] || 0
                const pct = v.tope_mensual > 0 ? Math.min((real / v.tope_mensual) * 100, 100) : 0
                const excedido = real > v.tope_mensual
                return (
                  <div key={v.id} className="bg-slate-900 px-3 py-2.5 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.categoria_color || '#6366f1' }} />
                        <p className="text-white text-sm font-medium">{v.nombre}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono ${excedido ? 'text-red-400' : 'text-slate-400'}`}>
                          {formatCOP(real)} / {formatCOP(v.tope_mensual)}
                        </span>
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
      </div>

      {/* Gráfica real vs tope */}
      {variables.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-4">Real vs Tope — {MESES_NOMBRES[mesActivo]} {anioActivo}</h3>
          <ReactApexChart options={barOptions} series={barSeries} type="bar" height={Math.max(200, variables.length * 45)} />
        </Card>
      )}

      {/* Modal gasto fijo */}
      <Modal open={modalFijo} onClose={() => setModalFijo(false)} titulo={editandoFijo.id ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Nombre *</label>
            <input value={editandoFijo.nombre || ''} placeholder="Ej: Arriendo"
              onChange={e => setEditandoFijo(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Categoría</label>
            <select value={editandoFijo.categoria_id || ''}
              onChange={e => setEditandoFijo(p => ({ ...p, categoria_id: Number(e.target.value) }))}>
              <option value="">Sin categoría</option>
              {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Monto mensual *</label>
            <input type="number" value={editandoFijo.monto || ''} placeholder="0"
              onChange={e => setEditandoFijo(p => ({ ...p, monto: Number(e.target.value) }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalFijo(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarFijo} disabled={!editandoFijo.nombre || !editandoFijo.monto}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal gasto variable */}
      <Modal open={modalVariable} onClose={() => setModalVariable(false)} titulo={editandoVariable.id ? 'Editar Gasto Variable' : 'Nuevo Gasto Variable'}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Nombre *</label>
            <input value={editandoVariable.nombre || ''} placeholder="Ej: Alimentación"
              onChange={e => setEditandoVariable(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Categoría</label>
            <select value={editandoVariable.categoria_id || ''}
              onChange={e => setEditandoVariable(p => ({ ...p, categoria_id: Number(e.target.value) }))}>
              <option value="">Sin categoría</option>
              {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Tope mensual *</label>
            <input type="number" value={editandoVariable.tope_mensual || ''} placeholder="0"
              onChange={e => setEditandoVariable(p => ({ ...p, tope_mensual: Number(e.target.value) }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalVariable(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={guardarVariable} disabled={!editandoVariable.nombre || !editandoVariable.tope_mensual}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}