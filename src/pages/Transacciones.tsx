import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { TransaccionDetalle } from '@/types'
import { formatCOP, MESES_NOMBRES } from '@/lib/format'

export function Transacciones() {
  const { categorias, mesActivo, anioActivo, setMesActivo } = useAppStore()
  const [transacciones, setTransacciones] = useState<TransaccionDetalle[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<number | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => { cargar() }, [mesActivo, anioActivo])

  async function cargar() {
    setCargando(true)
    const mes = await window.electronAPI.getOrCreateMes(anioActivo, mesActivo)
    const data = await window.electronAPI.getTransaccionesMes(mes.id)
    setTransacciones(data)
    setCargando(false)
  }

  const filtradas = transacciones.filter(t => {
    if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false
    if (filtroCategoria && t.categoria_id !== filtroCategoria) return false
    if (busqueda && !t.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) &&
        !t.categoria_nombre_original?.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const totalIngresos = filtradas.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const totalGastos = filtradas.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0)

  const anios = [2023, 2024, 2025, 2026, 2027]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transacciones</h1>
          <p className="text-slate-400 text-sm mt-0.5">Detalle de movimientos importados</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mesActivo} onChange={e => setMesActivo(Number(e.target.value), anioActivo)} className="w-36">
            {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select value={anioActivo} onChange={e => setMesActivo(mesActivo, Number(e.target.value))} className="w-24">
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por descripción o categoría..."
            className="pl-8 w-full"
          />
        </div>

        {/* Tipo */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {(['todos', 'ingreso', 'gasto'] as const).map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all capitalize ${
                filtroTipo === t ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {t === 'todos' ? 'Todos' : t === 'ingreso' ? '💰 Ingresos' : '💸 Gastos'}
            </button>
          ))}
        </div>

        {/* Categoría */}
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value ? Number(e.target.value) : '')}
          className="w-48">
          <option value="">Todas las categorías</option>
          <optgroup label="Ingresos">
            {categorias.filter(c => c.tipo === 'ingreso').map(c => (
              <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>
            ))}
          </optgroup>
          <optgroup label="Gastos">
            {categorias.filter(c => c.tipo === 'gasto').map(c => (
              <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs">Transacciones</p>
          <p className="text-white font-bold text-xl mt-1">{filtradas.length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs">Total ingresos</p>
          <p className="text-green-400 font-bold text-xl font-mono mt-1">{formatCOP(totalIngresos)}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs">Total gastos</p>
          <p className="text-red-400 font-bold text-xl font-mono mt-1">{formatCOP(totalGastos)}</p>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        {cargando ? (
          <p className="text-slate-400 text-sm text-center py-8">Cargando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            {transacciones.length === 0
              ? 'No hay transacciones importadas para este mes'
              : 'No hay resultados con los filtros aplicados'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-3 pr-3">Fecha</th>
                  <th className="text-left py-3 px-3">Descripción</th>
                  <th className="text-left py-3 px-3">Cuenta</th>
                  <th className="text-left py-3 px-3">Categoría</th>
                  <th className="text-center py-3 px-3">Tipo</th>
                  <th className="text-right py-3 pl-3">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtradas.map(t => (
                  <tr key={t.id} className="hover:bg-slate-700/20">
                    <td className="py-2.5 pr-3 text-slate-400 text-xs whitespace-nowrap">{t.fecha}</td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-[200px] truncate" title={t.descripcion}>
                      {t.descripcion || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-xs">{t.cuenta || '—'}</td>
                    <td className="py-2.5 px-3">
                      {t.categoria_id ? (
                        <span className="text-white text-xs">
                          {categorias.find(c => c.id === t.categoria_id)?.emoji} {t.categoria_nombre || t.categoria_nombre_original}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">{t.categoria_nombre_original}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.tipo === 'ingreso'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {t.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td className={`py-2.5 pl-3 text-right font-mono font-medium ${
                      t.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {t.tipo === 'ingreso' ? '+' : '-'}{formatCOP(t.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}