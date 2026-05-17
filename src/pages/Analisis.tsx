import { useEffect, useState } from 'react'
import ReactApexChart from 'react-apexcharts'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { formatCOP, MESES_NOMBRES } from '@/lib/format'

interface FilaMes {
  anio: number
  mes: number
  ingresos: number
  gastos: number
  rendimientos: number
  crecimientoNeto: number
  patrimonio: number
  gastosPorCategoria: Record<number, number>
}

export function Analisis() {
  const { categorias } = useAppStore()
  const [mesInicio, setMesInicio] = useState(1)
  const [anioInicio, setAnioInicio] = useState(new Date().getFullYear())
  const [mesFin, setMesFin] = useState(new Date().getMonth() + 1)
  const [anioFin, setAnioFin] = useState(new Date().getFullYear())
  const [filas, setFilas] = useState<FilaMes[]>([])
  const [cargando, setCargando] = useState(false)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null)

  const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')

  useEffect(() => { cargar() }, [mesInicio, anioInicio, mesFin, anioFin])

  async function cargar() {
    setCargando(true)
    const meses = await window.electronAPI.getMeses()
    const filtrados = meses.filter(m => {
      const val = m.anio * 12 + m.mes
      return val >= anioInicio * 12 + mesInicio && val <= anioFin * 12 + mesFin
    }).sort((a, b) => (a.anio * 12 + a.mes) - (b.anio * 12 + b.mes))

    const rows: FilaMes[] = []
    for (const m of filtrados) {
      const [d, gastos] = await Promise.all([
        window.electronAPI.getDashboardData(m.anio, m.mes),
        window.electronAPI.getGastosMes(m.id)
      ])

      const gastosPorCategoria: Record<number, number> = {}
      gastos.forEach(g => {
        gastosPorCategoria[g.categoria_id] = (gastosPorCategoria[g.categoria_id] || 0) + g.monto
      })

      rows.push({
        anio: m.anio, mes: m.mes,
        ingresos: d.ingresos, gastos: d.gastos,
        rendimientos: d.rendimientos,
        crecimientoNeto: d.ingresos + d.rendimientos - d.gastos,
        patrimonio: d.patrimonioNeto,
        gastosPorCategoria,
      })
    }
    setFilas(rows)
    setCargando(false)
  }

  const ejeX = filas.map(f => `${MESES_NOMBRES[f.mes].slice(0, 3)} ${f.anio}`)

  // Gráfica tendencia general
  const lineOptions: ApexCharts.ApexOptions = {
    chart: { type: 'line', background: 'transparent', toolbar: { show: false } },
    colors: ['#22c55e', '#ef4444', '#06b6d4'],
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: { categories: ejeX, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
    legend: { labels: { colors: '#94a3b8' } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const lineSeries = [
    { name: 'Ingresos', data: filas.map(f => f.ingresos) },
    { name: 'Gastos', data: filas.map(f => f.gastos) },
    { name: 'Rendimientos', data: filas.map(f => f.rendimientos) },
  ]

  // Gráfica patrimonio
  const areaOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
    colors: ['#6366f1'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: { categories: ejeX, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const areaSeries = [{ name: 'Patrimonio Neto', data: filas.map(f => f.patrimonio) }]

  // Top categorías del período
  const totalesPorCategoria: Record<number, number> = {}
  filas.forEach(f => {
    Object.entries(f.gastosPorCategoria).forEach(([catId, monto]) => {
      totalesPorCategoria[Number(catId)] = (totalesPorCategoria[Number(catId)] || 0) + monto
    })
  })

  const topCategorias = Object.entries(totalesPorCategoria)
    .map(([catId, total]) => {
      const cat = categoriasGasto.find(c => c.id === Number(catId))
      return { catId: Number(catId), nombre: cat?.nombre || 'Sin categoría', emoji: cat?.emoji || '', color: cat?.color || '#6366f1', total }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const barTopOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    colors: ['#ef4444'],
    plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(Number(v) / 1_000_000).toFixed(1)}M` } },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const barTopSeries = [{
    name: 'Gasto total',
    data: topCategorias.map(c => ({ x: `${c.emoji ? c.emoji + ' ' : ''}${c.nombre}`, y: c.total }))
  }]

  // Gráfica tendencia por categoría
  const datosCategoria = categoriaSeleccionada
    ? filas.map(f => f.gastosPorCategoria[categoriaSeleccionada] || 0)
    : []

  const catSeleccionadaInfo = categoriasGasto.find(c => c.id === categoriaSeleccionada)

  const [presupuestoCats, setPresupuestoCats] = useState<any[]>([])

  useEffect(() => {
    window.electronAPI.getPresupuestoCategorias().then(setPresupuestoCats)
  }, [])

  const presupuestoCategoria = categoriaSeleccionada
    ? presupuestoCats.find(p => p.categoria_id === categoriaSeleccionada)?.tope_mensual || null
    : null

  const lineCatOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
    colors: [catSeleccionadaInfo?.color || '#6366f1'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: { categories: ejeX, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
    grid: { borderColor: '#334155' },
    annotations: presupuestoCategoria ? {
      yaxis: [{
        y: presupuestoCategoria,
        borderColor: '#f59e0b',
        strokeDashArray: 5,
        label: {
          text: `Presupuesto: ${formatCOP(presupuestoCategoria)}`,
          style: { color: '#f59e0b', background: '#1e293b' }
        }
      }]
    } : {},
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const lineCatSeries = [{ name: catSeleccionadaInfo?.nombre || '', data: datosCategoria }]

  const anios = [2023, 2024, 2025, 2026, 2027]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Análisis</h1>
          <p className="text-slate-400 text-sm mt-0.5">Tendencias y evolución financiera</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-3">
          <span className="text-slate-400 text-sm">Desde</span>
          <select value={mesInicio} onChange={e => setMesInicio(Number(e.target.value))} className="w-32">
            {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select value={anioInicio} onChange={e => setAnioInicio(Number(e.target.value))} className="w-24">
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="text-slate-400 text-sm">hasta</span>
          <select value={mesFin} onChange={e => setMesFin(Number(e.target.value))} className="w-32">
            {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select value={anioFin} onChange={e => setAnioFin(Number(e.target.value))} className="w-24">
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Cargando análisis...</p>
        </div>
      ) : filas.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-slate-400">No hay datos en el rango seleccionado</p>
          <p className="text-slate-500 text-sm mt-1">Registra movimientos en Cierre Mensual primero</p>
        </Card>
      ) : (
        <>
          {/* Gráficas generales */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-white font-semibold mb-4">Tendencia de Ingresos, Gastos y Rendimientos</h3>
              <ReactApexChart options={lineOptions} series={lineSeries} type="line" height={280} />
            </Card>
            <Card>
              <h3 className="text-white font-semibold mb-4">Evolución del Patrimonio Neto</h3>
              <ReactApexChart options={areaOptions} series={areaSeries} type="area" height={280} />
            </Card>
          </div>

          {/* Top categorías */}
          {topCategorias.length > 0 && (
            <Card>
              <h3 className="text-white font-semibold mb-4">Top categorías de gasto — período seleccionado</h3>
              <ReactApexChart options={barTopOptions} series={barTopSeries} type="bar"
                height={Math.max(200, topCategorias.length * 40)} />
            </Card>
          )}

          {/* Tendencia por categoría */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Tendencia por categoría</h3>
              <select
                value={categoriaSeleccionada || ''}
                onChange={e => setCategoriaSeleccionada(Number(e.target.value) || null)}
                className="w-56">
                <option value="">Seleccionar categoría...</option>
                {categoriasGasto.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>
                ))}
              </select>
            </div>
            {categoriaSeleccionada
              ? <ReactApexChart options={lineCatOptions} series={lineCatSeries} type="area" height={280} />
              : <p className="text-slate-500 text-sm text-center py-12">Selecciona una categoría para ver su tendencia</p>
            }
          </Card>

          {/* Tabla resumen */}
          <Card>
            <h3 className="text-white font-semibold mb-4">Resumen mes a mes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700 text-right">
                    <th className="text-left py-3 pr-4">Mes</th>
                    <th className="py-3 px-3">Ingresos</th>
                    <th className="py-3 px-3">Gastos</th>
                    <th className="py-3 px-3">Rendimientos</th>
                    <th className="py-3 px-3">Crecimiento Neto</th>
                    <th className="py-3 pl-3">Patrimonio Cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filas.map((f, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/20 text-right">
                      <td className="py-3 pr-4 text-left text-slate-300 font-medium">{MESES_NOMBRES[f.mes]} {f.anio}</td>
                      <td className="py-3 px-3 font-mono text-green-400">{formatCOP(f.ingresos)}</td>
                      <td className="py-3 px-3 font-mono text-red-400">{formatCOP(f.gastos)}</td>
                      <td className={`py-3 px-3 font-mono ${f.rendimientos >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{formatCOP(f.rendimientos)}</td>
                      <td className={`py-3 px-3 font-mono font-bold ${f.crecimientoNeto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {f.crecimientoNeto >= 0 ? '+' : ''}{formatCOP(f.crecimientoNeto)}
                      </td>
                      <td className="py-3 pl-3 font-mono text-indigo-400 font-bold">{formatCOP(f.patrimonio)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 text-right font-bold">
                    <td className="py-3 pr-4 text-left text-white">TOTAL</td>
                    <td className="py-3 px-3 font-mono text-green-400">{formatCOP(filas.reduce((s, f) => s + f.ingresos, 0))}</td>
                    <td className="py-3 px-3 font-mono text-red-400">{formatCOP(filas.reduce((s, f) => s + f.gastos, 0))}</td>
                    <td className="py-3 px-3 font-mono text-cyan-400">{formatCOP(filas.reduce((s, f) => s + f.rendimientos, 0))}</td>
                    <td className={`py-3 px-3 font-mono ${filas.reduce((s, f) => s + f.crecimientoNeto, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCOP(filas.reduce((s, f) => s + f.crecimientoNeto, 0))}
                    </td>
                    <td className="py-3 pl-3 font-mono text-indigo-400">{formatCOP(filas[filas.length - 1]?.patrimonio || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}