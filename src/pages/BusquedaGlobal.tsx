import { useState, useCallback } from 'react'
import { Search, Download } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { formatCOP, MESES_NOMBRES } from '@/lib/format'
import { TransaccionDetalle } from '@/types'

export function BusquedaGlobal() {
  const { categorias } = useAppStore()
  const [texto, setTexto] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<number | ''>('')
  const [anioDesde, setAnioDesde] = useState<number | ''>('')
  const [mesDesde, setMesDesde] = useState<number | ''>('')
  const [anioHasta, setAnioHasta] = useState<number | ''>('')
  const [mesHasta, setMesHasta] = useState<number | ''>('')
  const [resultados, setResultados] = useState<TransaccionDetalle[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)

  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 8 }, (_, i) => anioActual - 3 + i)

  const buscar = useCallback(async () => {
    setBuscando(true)
    setBuscado(true)
    const filtros: any = {}
    if (texto.trim()) filtros.texto = texto.trim()
    if (filtroTipo !== 'todos') filtros.tipo = filtroTipo
    if (filtroCategoria) filtros.categoria_id = filtroCategoria
    if (anioDesde !== '' && mesDesde !== '') {
      filtros.anio_desde = Number(anioDesde)
      filtros.mes_desde = Number(mesDesde)
    }
    if (anioHasta !== '' && mesHasta !== '') {
      filtros.anio_hasta = Number(anioHasta)
      filtros.mes_hasta = Number(mesHasta)
    }
    const data = await window.electronAPI.buscarTransacciones(filtros)
    setResultados(data as TransaccionDetalle[])
    setBuscando(false)
  }, [texto, filtroTipo, filtroCategoria, anioDesde, mesDesde, anioHasta, mesHasta])

  const totalIngresos = resultados.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const totalGastos = resultados.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0)

  async function exportar() {
    const encabezado = ['Año', 'Mes', 'Fecha', 'Hora', 'Cuenta', 'Categoría', 'Categoría Original', 'Tipo', 'Monto', 'Descripción']
    const filas = [
      encabezado,
      ...resultados.map(t => [
        String((t as any).anio ?? ''),
        String((t as any).mes ?? ''),
        t.fecha ?? '',
        t.hora ?? '',
        t.cuenta ?? '',
        t.categoria_nombre ?? t.categoria_nombre_original,
        t.categoria_nombre_original,
        t.tipo,
        String(t.monto),
        t.descripcion ?? '',
      ])
    ]
    await window.electronAPI.exportarCSV({ filas, nombreSugerido: 'busqueda-transacciones.csv' })
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      <div>
        <h1 className="text-2xl font-bold text-white">Búsqueda Global</h1>
        <p className="text-slate-400 text-sm mt-0.5">Busca transacciones en todos los meses registrados</p>
      </div>

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          {/* Texto */}
          <div className="xl:col-span-2">
            <label className="text-slate-400 text-xs block mb-1">Buscar en descripción, cuenta o categoría</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                placeholder="Ej: Netflix, Almacenes Éxito, transferencia..."
                className="pl-8 w-full"
              />
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="text-slate-400 text-xs block mb-1">Tipo</label>
            <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 w-fit">
              {(['todos', 'ingreso', 'gasto'] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-all capitalize ${filtroTipo === t ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {t === 'todos' ? 'Todos' : t === 'ingreso' ? '💰 Ingresos' : '💸 Gastos'}
                </button>
              ))}
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="text-slate-400 text-xs block mb-1">Categoría</label>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value ? Number(e.target.value) : '')} className="w-56">
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

          {/* Rango de fechas */}
          <div>
            <label className="text-slate-400 text-xs block mb-1">Desde</label>
            <div className="flex items-center gap-2">
              <select value={mesDesde} onChange={e => setMesDesde(e.target.value ? Number(e.target.value) : '')} className="w-36">
                <option value="">Mes...</option>
                {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
              <select value={anioDesde} onChange={e => setAnioDesde(e.target.value ? Number(e.target.value) : '')} className="w-24">
                <option value="">Año...</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-xs block mb-1">Hasta</label>
            <div className="flex items-center gap-2">
              <select value={mesHasta} onChange={e => setMesHasta(e.target.value ? Number(e.target.value) : '')} className="w-36">
                <option value="">Mes...</option>
                {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
              <select value={anioHasta} onChange={e => setAnioHasta(e.target.value ? Number(e.target.value) : '')} className="w-24">
                <option value="">Año...</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={buscar}
          disabled={buscando}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Search size={14} />
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </Card>

      {/* Resultados */}
      {buscado && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs">Resultados</p>
              <p className="text-white font-bold text-xl mt-1">{resultados.length}{resultados.length === 500 ? '+' : ''}</p>
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

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">
                {resultados.length === 0 ? 'Sin resultados' : `${resultados.length} transacciones encontradas`}
                {resultados.length === 500 && <span className="text-slate-500 text-xs ml-2">(límite: 500)</span>}
              </h3>
              {resultados.length > 0 && (
                <button
                  onClick={exportar}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                  <Download size={14} /> Exportar CSV
                </button>
              )}
            </div>

            {resultados.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No se encontraron transacciones con los filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-3 pr-3">Período</th>
                      <th className="text-left py-3 pr-3">Fecha</th>
                      <th className="text-left py-3 px-3">Descripción</th>
                      <th className="text-left py-3 px-3">Cuenta</th>
                      <th className="text-left py-3 px-3">Categoría</th>
                      <th className="text-center py-3 px-3">Tipo</th>
                      <th className="text-right py-3 pl-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {resultados.map(t => (
                      <tr key={t.id} className="hover:bg-slate-700/20">
                        <td className="py-2.5 pr-3 text-slate-500 text-xs whitespace-nowrap">
                          {MESES_NOMBRES[(t as any).mes]?.slice(0, 3)} {(t as any).anio}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-400 text-xs whitespace-nowrap">{t.fecha}</td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-[200px] truncate" title={t.descripcion}>
                          {t.descripcion || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-xs">{t.cuenta || '—'}</td>
                        <td className="py-2.5 px-3">
                          {t.categoria_id ? (
                            <span className="text-white text-xs">
                              {t.categoria_emoji} {t.categoria_nombre || t.categoria_nombre_original}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">{t.categoria_nombre_original}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${t.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {t.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                          </span>
                        </td>
                        <td className={`py-2.5 pl-3 text-right font-mono font-medium ${t.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                          {t.tipo === 'ingreso' ? '+' : '-'}{formatCOP(t.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
