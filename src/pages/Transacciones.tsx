import { useEffect, useState, useCallback } from 'react'
import { Search, Download } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { TransaccionDetalle } from '@/types'
import { formatCOP, MESES_NOMBRES } from '@/lib/format'

type Tab = 'mes' | 'busqueda'

export function Transacciones() {
  const { categorias, mesActivo, anioActivo, setMesActivo } = useAppStore()
  const [tab, setTab] = useState<Tab>('mes')

  // ── Tab: Este mes ──
  const [transacciones, setTransacciones] = useState<TransaccionDetalle[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<number | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)

  // ── Tab: Búsqueda global ──
  const [bTexto, setBTexto] = useState('')
  const [bTipo, setBTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos')
  const [bCategoria, setBCategoria] = useState<number | ''>('')
  const [bAnioDesde, setBAnioDesde] = useState<number | ''>('')
  const [bMesDesde, setBMesDesde] = useState<number | ''>('')
  const [bAnioHasta, setBAnioHasta] = useState<number | ''>('')
  const [bMesHasta, setBMesHasta] = useState<number | ''>('')
  const [bResultados, setBResultados] = useState<TransaccionDetalle[]>([])
  const [bBuscando, setBBuscando] = useState(false)
  const [bBuscado, setBBuscado] = useState(false)

  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 8 }, (_, i) => anioActual - 3 + i)

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

  const buscarGlobal = useCallback(async () => {
    setBBuscando(true)
    setBBuscado(true)
    const filtros: any = {}
    if (bTexto.trim()) filtros.texto = bTexto.trim()
    if (bTipo !== 'todos') filtros.tipo = bTipo
    if (bCategoria) filtros.categoria_id = bCategoria
    if (bAnioDesde !== '' && bMesDesde !== '') { filtros.anio_desde = Number(bAnioDesde); filtros.mes_desde = Number(bMesDesde) }
    if (bAnioHasta !== '' && bMesHasta !== '') { filtros.anio_hasta = Number(bAnioHasta); filtros.mes_hasta = Number(bMesHasta) }
    const data = await window.electronAPI.buscarTransacciones(filtros)
    setBResultados(data as TransaccionDetalle[])
    setBBuscando(false)
  }, [bTexto, bTipo, bCategoria, bAnioDesde, bMesDesde, bAnioHasta, bMesHasta])

  const bTotalIngresos = bResultados.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const bTotalGastos = bResultados.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0)

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transacciones</h1>
          <p className="text-slate-400 text-sm mt-0.5">Detalle de movimientos importados</p>
        </div>
        {tab === 'mes' && (
          <div className="flex items-center gap-2">
            <select value={mesActivo} onChange={e => setMesActivo(Number(e.target.value), anioActivo)} className="w-36">
              {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
            </select>
            <select value={anioActivo} onChange={e => setMesActivo(mesActivo, Number(e.target.value))} className="w-24">
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {filtradas.length > 0 && (
              <button
                onClick={async () => {
                  const encabezado = ['Fecha', 'Hora', 'Cuenta', 'Categoría', 'Categoría Original', 'Tipo', 'Monto', 'Descripción']
                  const filas = [encabezado, ...filtradas.map(t => [
                    t.fecha ?? '', t.hora ?? '', t.cuenta ?? '',
                    t.categoria_nombre ?? t.categoria_nombre_original,
                    t.categoria_nombre_original, t.tipo, String(t.monto), t.descripcion ?? ''
                  ])]
                  await window.electronAPI.exportarCSV({ filas, nombreSugerido: `transacciones-${MESES_NOMBRES[mesActivo].toLowerCase()}-${anioActivo}.csv` })
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                <Download size={14} /> Exportar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 w-fit">
        {([
          { key: 'mes', label: 'Este mes' },
          { key: 'busqueda', label: 'Búsqueda global' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: ESTE MES ── */}
      {tab === 'mes' && (
        <>
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por descripción o categoría..." className="pl-8 w-full" />
            </div>
            <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              {(['todos', 'ingreso', 'gasto'] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${filtroTipo === t ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {t === 'todos' ? 'Todos' : t === 'ingreso' ? '💰 Ingresos' : '💸 Gastos'}
                </button>
              ))}
            </div>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value ? Number(e.target.value) : '')} className="w-48">
              <option value="">Todas las categorías</option>
              <optgroup label="Ingresos">
                {categorias.filter(c => c.tipo === 'ingreso').map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
              </optgroup>
              <optgroup label="Gastos">
                {categorias.filter(c => c.tipo === 'gasto').map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
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
                {transacciones.length === 0 ? 'No hay transacciones importadas para este mes' : 'No hay resultados con los filtros aplicados'}
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
                        <td className="py-2.5 px-3 text-slate-300 max-w-[200px] truncate" title={t.descripcion}>{t.descripcion || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-xs">{t.cuenta || '—'}</td>
                        <td className="py-2.5 px-3">
                          {t.categoria_id
                            ? <span className="text-white text-xs">{categorias.find(c => c.id === t.categoria_id)?.emoji} {t.categoria_nombre || t.categoria_nombre_original}</span>
                            : <span className="text-slate-500 text-xs">{t.categoria_nombre_original}</span>}
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

      {/* ── TAB: BÚSQUEDA GLOBAL ── */}
      {tab === 'busqueda' && (
        <>
          <Card>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Texto */}
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={bTexto} onChange={e => setBTexto(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarGlobal()}
                  placeholder="Buscar descripción, cuenta, categoría..." className="pl-8 w-full" />
              </div>

              {/* Tipo */}
              <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
                {(['todos', 'ingreso', 'gasto'] as const).map(t => (
                  <button key={t} onClick={() => setBTipo(t)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all ${bTipo === t ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {t === 'todos' ? 'Todos' : t === 'ingreso' ? '💰 Ing.' : '💸 Gas.'}
                  </button>
                ))}
              </div>

              {/* Categoría */}
              <select value={bCategoria} onChange={e => setBCategoria(e.target.value ? Number(e.target.value) : '')} className="w-44 shrink-0">
                <option value="">Categoría...</option>
                <optgroup label="Ingresos">
                  {categorias.filter(c => c.tipo === 'ingreso').map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                </optgroup>
                <optgroup label="Gastos">
                  {categorias.filter(c => c.tipo === 'gasto').map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                </optgroup>
              </select>

              {/* Desde */}
              <span className="text-slate-400 text-xs shrink-0">Desde</span>
              <select value={bMesDesde} onChange={e => setBMesDesde(e.target.value ? Number(e.target.value) : '')} className="w-28 shrink-0">
                <option value="">Mes...</option>
                {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
              <select value={bAnioDesde} onChange={e => setBAnioDesde(e.target.value ? Number(e.target.value) : '')} className="w-20 shrink-0">
                <option value="">Año...</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              {/* Hasta */}
              <span className="text-slate-400 text-xs shrink-0">Hasta</span>
              <select value={bMesHasta} onChange={e => setBMesHasta(e.target.value ? Number(e.target.value) : '')} className="w-28 shrink-0">
                <option value="">Mes...</option>
                {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
              <select value={bAnioHasta} onChange={e => setBAnioHasta(e.target.value ? Number(e.target.value) : '')} className="w-20 shrink-0">
                <option value="">Año...</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              {/* Botón */}
              <button onClick={buscarGlobal} disabled={bBuscando}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0">
                <Search size={14} />
                {bBuscando ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </Card>

          {bBuscado && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-xs">Resultados</p>
                  <p className="text-white font-bold text-xl mt-1">{bResultados.length}{bResultados.length === 500 ? '+' : ''}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-xs">Total ingresos</p>
                  <p className="text-green-400 font-bold text-xl font-mono mt-1">{formatCOP(bTotalIngresos)}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-xs">Total gastos</p>
                  <p className="text-red-400 font-bold text-xl font-mono mt-1">{formatCOP(bTotalGastos)}</p>
                </div>
              </div>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">
                    {bResultados.length === 0 ? 'Sin resultados' : `${bResultados.length} transacciones encontradas`}
                    {bResultados.length === 500 && <span className="text-slate-500 text-xs ml-2">(límite: 500)</span>}
                  </h3>
                  {bResultados.length > 0 && (
                    <button
                      onClick={async () => {
                        const enc = ['Año', 'Mes', 'Fecha', 'Hora', 'Cuenta', 'Categoría', 'Categoría Original', 'Tipo', 'Monto', 'Descripción']
                        const filas = [enc, ...bResultados.map(t => [
                          String((t as any).anio ?? ''), String((t as any).mes ?? ''),
                          t.fecha ?? '', t.hora ?? '', t.cuenta ?? '',
                          t.categoria_nombre ?? t.categoria_nombre_original,
                          t.categoria_nombre_original, t.tipo, String(t.monto), t.descripcion ?? ''
                        ])]
                        await window.electronAPI.exportarCSV({ filas, nombreSugerido: 'busqueda-transacciones.csv' })
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                    >
                      <Download size={14} /> Exportar CSV
                    </button>
                  )}
                </div>
                {bResultados.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No se encontraron transacciones con los filtros aplicados.</p>
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
                        {bResultados.map(t => (
                          <tr key={t.id} className="hover:bg-slate-700/20">
                            <td className="py-2.5 pr-3 text-slate-500 text-xs whitespace-nowrap">
                              {MESES_NOMBRES[(t as any).mes]?.slice(0, 3)} {(t as any).anio}
                            </td>
                            <td className="py-2.5 pr-3 text-slate-400 text-xs whitespace-nowrap">{t.fecha}</td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-[200px] truncate" title={t.descripcion}>{t.descripcion || '—'}</td>
                            <td className="py-2.5 px-3 text-slate-400 text-xs">{t.cuenta || '—'}</td>
                            <td className="py-2.5 px-3">
                              {t.categoria_id
                                ? <span className="text-white text-xs">{t.categoria_emoji} {t.categoria_nombre || t.categoria_nombre_original}</span>
                                : <span className="text-slate-500 text-xs">{t.categoria_nombre_original}</span>}
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
        </>
      )}
    </div>
  )
}

