import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import ReactApexChart from 'react-apexcharts'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { formatCOP, formatPct, MESES_NOMBRES } from '@/lib/format'
import { ResumenPortafolio } from '@/types'

type Tab = 'flujo' | 'portafolio' | 'patrimonio'

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
  const [tab, setTab] = useState<Tab>('flujo')
  const [mesInicio, setMesInicio] = useState(1)
  const [anioInicio, setAnioInicio] = useState(new Date().getFullYear())
  const [mesFin, setMesFin] = useState(new Date().getMonth() + 1)
  const [anioFin, setAnioFin] = useState(new Date().getFullYear())
  const [filas, setFilas] = useState<FilaMes[]>([])
  const [cargando, setCargando] = useState(false)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null)
  const [presupuestoCats, setPresupuestoCats] = useState<any[]>([])
  const [portafolio, setPortafolio] = useState<ResumenPortafolio[]>([])
  const [invSeleccionada, setInvSeleccionada] = useState<number | null>(null)
  const [historialInv, setHistorialInv] = useState<any[]>([])

  const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')
  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 8 }, (_, i) => anioActual - 3 + i)

  const [parametros, setParametros] = useState<Record<string, string>>({ rendimiento_minimo_esperado: '10' })

  useEffect(() => {
    window.electronAPI.getParametros().then(setParametros)
  }, [])

  useEffect(() => {
    window.electronAPI.getPresupuestoCategorias().then(setPresupuestoCats)
  }, [])

  useEffect(() => { cargar() }, [mesInicio, anioInicio, mesFin, anioFin])

  useEffect(() => {
    if (tab === 'portafolio') cargarPortafolio()
  }, [tab])

  useEffect(() => {
    if (invSeleccionada) {
      window.electronAPI.getInversionMensual(invSeleccionada).then(setHistorialInv)
    }
  }, [invSeleccionada])

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

  async function cargarPortafolio() {
    const data = await window.electronAPI.getResumenPortafolio()
    setPortafolio(data)
  }

  const ejeX = filas.map(f => `${MESES_NOMBRES[f.mes].slice(0, 3)} ${f.anio}`)

  // ── GRÁFICAS FLUJO ──
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
    .sort((a, b) => b.total - a.total).slice(0, 10)

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
  const barTopSeries = [{ name: 'Gasto total', data: topCategorias.map(c => ({ x: `${c.emoji ? c.emoji + ' ' : ''}${c.nombre}`, y: c.total })) }]

  const catSeleccionadaInfo = categoriasGasto.find(c => c.id === categoriaSeleccionada)
  const presupuestoCategoria = categoriaSeleccionada
    ? presupuestoCats.find(p => p.categoria_id === categoriaSeleccionada)?.tope_mensual || null : null
  const datosCategoria = categoriaSeleccionada ? filas.map(f => f.gastosPorCategoria[categoriaSeleccionada] || 0) : []
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
      yaxis: [{ y: presupuestoCategoria, borderColor: '#f59e0b', strokeDashArray: 5,
        label: { text: `Presupuesto: ${formatCOP(presupuestoCategoria)}`, style: { color: '#f59e0b', background: '#1e293b' } } }]
    } : {},
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }
  const lineCatSeries = [{ name: catSeleccionadaInfo?.nombre || '', data: datosCategoria }]

  // ── TASA DE AHORRO E INSIGHTS ──
  const tasasAhorroMes = filas.map(f =>
    f.ingresos > 0 ? Number(((f.ingresos - f.gastos) / f.ingresos * 100).toFixed(1)) : 0
  )
  const tasaAhorroPromedio = filas.length > 0
    ? tasasAhorroMes.reduce((s, t) => s + t, 0) / filas.length : 0
  const mejorMesAhorroIdx = tasasAhorroMes.length > 0
    ? tasasAhorroMes.indexOf(Math.max(...tasasAhorroMes)) : -1
  const peorMesAhorroIdx = tasasAhorroMes.length > 0
    ? tasasAhorroMes.indexOf(Math.min(...tasasAhorroMes)) : -1
  const mesesPositivos = filas.filter(f => f.crecimientoNeto >= 0).length
  const hoyAnio = new Date().getFullYear()
  const hoyMes = new Date().getMonth() + 1
  const filasPatrimonio = filas.filter(f => !(f.anio === hoyAnio && f.mes === hoyMes))
  const crecPatrimonioPct = filasPatrimonio.length >= 2 && filasPatrimonio[0].patrimonio > 0
    ? ((filasPatrimonio[filasPatrimonio.length - 1].patrimonio - filasPatrimonio[0].patrimonio) / filasPatrimonio[0].patrimonio) * 100 : 0
  const mitad = Math.floor(filas.length / 2)
  const ratioGastos1 = mitad > 0
    ? filas.slice(0, mitad).reduce((s, f) => s + (f.ingresos > 0 ? f.gastos / f.ingresos : 0), 0) / mitad : 0
  const ratioGastos2 = filas.length - mitad > 0
    ? filas.slice(mitad).reduce((s, f) => s + (f.ingresos > 0 ? f.gastos / f.ingresos : 0), 0) / (filas.length - mitad) : 0
  const tendenciaGastosPp = (ratioGastos2 - ratioGastos1) * 100

  const savingsRateOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    colors: tasasAhorroMes.map(t => t >= 20 ? '#22c55e' : t >= 0 ? '#f59e0b' : '#ef4444'),
    plotOptions: { bar: { borderRadius: 4, distributed: true } },
    dataLabels: { enabled: false },
    legend: { show: false },
    annotations: {
      yaxis: [{ y: 20, borderColor: '#6366f1', strokeDashArray: 4,
        label: { text: 'Meta 20%', style: { color: '#6366f1', background: '#1e293b' } } }]
    },
    xaxis: { categories: ejeX, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `${Number(v).toFixed(0)}%` } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => `${Number(v).toFixed(1)}%` } },
  }
  const savingsRateSeries = [{ name: 'Tasa de ahorro', data: tasasAhorroMes }]

  // ── GRÁFICAS PORTAFOLIO ──
  const portafolioOrdenado = [...portafolio].sort((a, b) => {
      const mesesA = Math.max(a.meses_registrados - 1, 1)
      const mesesB = Math.max(b.meses_registrados - 1, 1)
      const invertidoA = a.saldo_inicial + a.aportes_acumulados
      const invertidoB = b.saldo_inicial + b.aportes_acumulados
      const rentA = invertidoA > 0 ? (Math.pow((a.saldo_actual || 0) / invertidoA, 12 / mesesA) - 1) * 100 : 0
      const rentB = invertidoB > 0 ? (Math.pow((b.saldo_actual || 0) / invertidoB, 12 / mesesB) - 1) * 100 : 0
      return rentB - rentA
  })

  const barPortafolioOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    colors: portafolioOrdenado.map(p => {
      const rent = p.saldo_inicial > 0 ? (p.rendimiento_acumulado / p.saldo_inicial) * 100 : 0
      return rent >= 0 ? '#22c55e' : '#ef4444'
    }),
    plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `${Number(v).toFixed(1)}%` } },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => `${Number(v).toFixed(2)}%` } },
  }
  const barPortafolioSeries = [{
    name: 'Rentabilidad %',
    data: portafolioOrdenado.map(p => ({
      x: p.nombre,
      y: p.saldo_inicial > 0 ? Number(((p.rendimiento_acumulado / p.saldo_inicial) * 100).toFixed(2)) : 0
    }))
  }]

  // Distribución por tipo
  const distribucionTipo: Record<string, number> = {}
  portafolio.forEach(p => {
    const tipo = p.tipo_nombre || 'Otro'
    distribucionTipo[tipo] = (distribucionTipo[tipo] || 0) + (p.saldo_actual || 0)
  })
  const pieOptions: ApexCharts.ApexOptions = {
    chart: { type: 'donut', background: 'transparent' },
    colors: ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'],
    labels: Object.keys(distribucionTipo),
    legend: { labels: { colors: '#94a3b8' } },
    dataLabels: { style: { colors: ['#fff'] } },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }
  const pieSeries = Object.values(distribucionTipo)

  // Evolución inversión seleccionada
  const ejeXInv = historialInv.map(h => `${MESES_NOMBRES[h.mes].slice(0, 3)} ${h.anio}`)
  const invInfo = portafolio.find(p => p.id === invSeleccionada)
  const lineInvOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
    colors: ['#6366f1', '#22c55e'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: { categories: ejeXInv, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
    legend: { labels: { colors: '#94a3b8' } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }
  const lineInvSeries = [
    { name: 'Saldo', data: historialInv.map(h => h.saldo_cierre) },
    { name: 'Rendimiento acum.', data: historialInv.map((_, i) => historialInv.slice(0, i + 1).reduce((s, h) => s + h.rendimiento, 0)) },
  ]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Análisis</h1>
          <p className="text-slate-400 text-sm mt-0.5">Tendencias, portafolio y patrimonio</p>
        </div>
        {tab !== 'portafolio' && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 w-fit">
        {([
          { key: 'flujo', label: 'Flujo Mensual' },
          { key: 'portafolio', label: 'Portafolio' },
          { key: 'patrimonio', label: 'Patrimonio' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: FLUJO MENSUAL ── */}
      {tab === 'flujo' && (
        cargando ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">Cargando análisis...</p>
          </div>
        ) : filas.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-slate-400">No hay datos en el rango seleccionado</p>
          </Card>
        ) : (
          <div className="space-y-6">

            {/* ── DIAGNÓSTICO ── */}
            <Card>
              <h3 className="text-white font-semibold mb-4">Diagnóstico del período</h3>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Tasa de ahorro promedio</p>
                  <p className={`text-2xl font-bold font-mono ${tasaAhorroPromedio >= 20 ? 'text-green-400' : tasaAhorroPromedio >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {tasaAhorroPromedio.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Meses con crecimiento positivo</p>
                  <p className="text-2xl font-bold font-mono text-white">
                    {mesesPositivos} <span className="text-base text-slate-400">/ {filas.length}</span>
                  </p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Crecimiento del patrimonio</p>
                  <p className={`text-2xl font-bold font-mono ${crecPatrimonioPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {crecPatrimonioPct >= 0 ? '+' : ''}{crecPatrimonioPct.toFixed(1)}%
                  </p>
                  {filasPatrimonio.length < filas.length && filasPatrimonio.length > 0 && (
                    <p className="text-slate-500 text-xs mt-1">hasta {MESES_NOMBRES[filasPatrimonio[filasPatrimonio.length - 1].mes].slice(0, 3)}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2.5 border-t border-slate-700 pt-4">
                {mejorMesAhorroIdx >= 0 && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <span>🏆</span>
                    <p className="text-slate-300">Mejor mes de ahorro: <span className="text-green-400 font-medium">{MESES_NOMBRES[filas[mejorMesAhorroIdx].mes]} {filas[mejorMesAhorroIdx].anio}</span> — guardaste el <span className="text-green-400 font-mono font-bold">{tasasAhorroMes[mejorMesAhorroIdx].toFixed(1)}%</span> de tus ingresos.</p>
                  </div>
                )}
                {peorMesAhorroIdx >= 0 && peorMesAhorroIdx !== mejorMesAhorroIdx && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <span>{tasasAhorroMes[peorMesAhorroIdx] < 0 ? '🔴' : '⚠️'}</span>
                    <p className="text-slate-300">Peor mes de ahorro: <span className="text-red-400 font-medium">{MESES_NOMBRES[filas[peorMesAhorroIdx].mes]} {filas[peorMesAhorroIdx].anio}</span> — solo guardaste el <span className="text-red-400 font-mono font-bold">{tasasAhorroMes[peorMesAhorroIdx].toFixed(1)}%</span>{tasasAhorroMes[peorMesAhorroIdx] < 0 ? ' (gastos superaron ingresos)' : ''}.</p>
                  </div>
                )}
                {filas.length >= 4 && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <span>{tendenciaGastosPp > 5 ? '⚠️' : tendenciaGastosPp < -5 ? '✅' : 'ℹ️'}</span>
                    <p className="text-slate-300">
                      {tendenciaGastosPp > 5
                        ? <><span className="text-amber-400 font-semibold">Los gastos crecieron {tendenciaGastosPp.toFixed(1)}pp</span> como % de tus ingresos en la segunda mitad del período — monitorea esta tendencia.</>
                        : tendenciaGastosPp < -5
                        ? <><span className="text-green-400 font-semibold">Los gastos bajaron {Math.abs(tendenciaGastosPp).toFixed(1)}pp</span> como % de tus ingresos en la segunda mitad — vas mejorando.</>
                        : <>La relación gastos/ingresos se mantiene <span className="text-slate-200 font-semibold">estable</span> en el período.</>
                      }
                    </p>
                  </div>
                )}
                {topCategorias.length > 0 && filas.reduce((s, f) => s + f.ingresos, 0) > 0 && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <span>💸</span>
                    <p className="text-slate-300">
                      Mayor categoría de gasto: <span className="text-white font-medium">{topCategorias[0].emoji ? `${topCategorias[0].emoji} ` : ''}{topCategorias[0].nombre}</span>{' '}
                      — el <span className="text-amber-400 font-mono font-bold">{((topCategorias[0].total / filas.reduce((s, f) => s + f.ingresos, 0)) * 100).toFixed(1)}%</span> de tus ingresos del período.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Tasa de ahorro mensual */}
            <Card>
              <h3 className="text-white font-semibold mb-4">Tasa de ahorro mensual</h3>
              <ReactApexChart options={savingsRateOptions} series={savingsRateSeries} type="bar" height={220} />
            </Card>

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

            <div className="grid grid-cols-2 gap-4">
              {topCategorias.length > 0 && (
                <Card>
                  <h3 className="text-white font-semibold mb-4">Top categorías de gasto — período seleccionado</h3>
                  <ReactApexChart options={barTopOptions} series={barTopSeries} type="bar"
                    height={Math.max(200, topCategorias.length * 40)} />
                </Card>
              )}
              <Card className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Tendencia Gastos por categoría</h3>
                  <select value={categoriaSeleccionada || ''} onChange={e => setCategoriaSeleccionada(Number(e.target.value) || null)} className="w-56">
                    <option value="">Seleccionar categoría...</option>
                    {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-h-0">
                  {categoriaSeleccionada
                    ? <ReactApexChart options={lineCatOptions} series={lineCatSeries} type="area" height={Math.max(200, topCategorias.length * 40)} />
                    : <div className="flex items-center justify-center h-full min-h-[200px]">
                        <p className="text-slate-500 text-sm">Selecciona una categoría para ver su tendencia</p>
                      </div>
                  }
                </div>
              </Card>
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Resumen mes a mes</h3>
                <button
                  onClick={async () => {
                    const enc = ['Mes', 'Año', 'Ingresos', 'Gastos', 'Rendimientos', 'Crecimiento Neto', 'Patrimonio Cierre']
                    const rows = filas.map(f => [
                      MESES_NOMBRES[f.mes], String(f.anio),
                      String(f.ingresos), String(f.gastos),
                      String(f.rendimientos), String(f.crecimientoNeto), String(f.patrimonio)
                    ])
                    await window.electronAPI.exportarCSV({ filas: [enc, ...rows], nombreSugerido: 'analisis-flujo.csv' })
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                  <Download size={14} /> Exportar
                </button>
              </div>
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
          </div>
        )
      )}

     {/* ── TAB: PORTAFOLIO ── */}
      {tab === 'portafolio' && (
        <div className="space-y-4">

          {/* Tabla resumen portafolio */}
          <Card>
            <h3 className="text-white font-semibold mb-3">Resumen del portafolio</h3>
            {portafolio.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No hay inversiones con historial registrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700 text-right">
                      <th className="text-left py-2 pr-3">Inversión</th>
                      <th className="py-2 px-2">Tipo</th>
                      <th className="py-2 px-2">Saldo actual</th>
                      <th className="py-2 px-2">Invertido</th>
                      <th className="py-2 px-2">Rendim. $</th>
                      <th className="py-2 px-2">Rent. acum %</th>
                      <th className="py-2 px-2">Rent. anual %</th>
                      <th className="py-2 pl-2">Señal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {portafolioOrdenado.map(p => {
                      const invertido = p.saldo_inicial + p.aportes_acumulados
                      const rentAcumPct = invertido > 0 ? (p.rendimiento_acumulado / invertido) * 100 : 0
                      const meses = Math.max(p.meses_registrados - 1, 1)
                      const rentAnualPct = invertido > 0
                        ? (Math.pow((p.saldo_actual || 0) / invertido, 12 / meses) - 1) * 100
                        : 0
                      const meta = Number(parametros.rendimiento_minimo_esperado || 10)
                      const senal = rentAnualPct >= meta ? '🟢' : rentAnualPct >= 0 ? '🟡' : '🔴'
                      return (
                        <tr key={p.id}
                          onClick={() => setInvSeleccionada(p.id === invSeleccionada ? null : p.id)}
                          className={`hover:bg-slate-700/20 text-right cursor-pointer transition-colors ${invSeleccionada === p.id ? 'bg-indigo-500/10' : ''}`}>
                          <td className="py-2 pr-3 text-left">
                            <p className="text-white font-medium">{p.nombre}</p>
                            <p className="text-slate-500 text-xs">{p.entidad_nombre}</p>
                          </td>
                          <td className="py-2 px-2 text-slate-400">{p.tipo_nombre}</td>
                          <td className="py-2 px-2 font-mono text-white">{formatCOP(p.saldo_actual || 0)}</td>
                          <td className="py-2 px-2 font-mono text-slate-400">{formatCOP(invertido)}</td>
                          <td className={`py-2 px-2 font-mono font-bold ${p.rendimiento_acumulado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {p.rendimiento_acumulado >= 0 ? '+' : ''}{formatCOP(p.rendimiento_acumulado)}
                          </td>
                          <td className={`py-2 px-2 font-mono ${rentAcumPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {rentAcumPct >= 0 ? '+' : ''}{rentAcumPct.toFixed(2)}%
                          </td>
                          <td className={`py-2 px-2 font-mono font-bold ${rentAnualPct >= meta ? 'text-green-400' : rentAnualPct >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {rentAnualPct >= 0 ? '+' : ''}{rentAnualPct.toFixed(2)}%
                          </td>
                          <td className="py-2 pl-2 text-center text-base">{senal}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Evolución de inversión seleccionada — justo debajo de la tabla */}
          {invSeleccionada && historialInv.length > 0 && (
            <Card>
              <h3 className="text-white font-semibold mb-3">
                Evolución — {portafolio.find(p => p.id === invSeleccionada)?.nombre}
              </h3>
              {(() => {
                const p = portafolio.find(x => x.id === invSeleccionada)!
                const invertido = p.saldo_inicial + p.aportes_acumulados
                const meses = Math.max(p.meses_registrados - 1, 1)
                const rentAnualPct = invertido > 0
                  ? (Math.pow((p.saldo_actual || 0) / invertido, 12 / meses) - 1) * 100 : 0
                const rentAcumPct = invertido > 0 ? (p.rendimiento_acumulado / invertido) * 100 : 0
                return (
                  <>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-slate-900 p-3 rounded-lg">
                        <p className="text-slate-400 text-xs">Saldo actual</p>
                        <p className="text-white font-mono font-bold mt-1">{formatCOP(p.saldo_actual || 0)}</p>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg">
                        <p className="text-slate-400 text-xs">Total invertido</p>
                        <p className="text-white font-mono font-bold mt-1">{formatCOP(invertido)}</p>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg">
                        <p className="text-slate-400 text-xs">Rent. acumulada</p>
                        <p className={`font-mono font-bold mt-1 ${rentAcumPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {rentAcumPct >= 0 ? '+' : ''}{rentAcumPct.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg">
                        <p className="text-slate-400 text-xs">Rent. anualizada</p>
                        <p className={`font-mono font-bold mt-1 ${rentAnualPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {rentAnualPct >= 0 ? '+' : ''}{rentAnualPct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <ReactApexChart options={lineInvOptions} series={lineInvSeries} type="area" height={220} />
                  </>
                )
              })()}
            </Card>
          )}

          {/* Gráficas comparativas */}
          {portafolio.length > 0 && (() => {
            const alturaComparativa = Math.max(300, portafolio.length * 45)
            return (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <h3 className="text-white font-semibold mb-4">Rentabilidad anualizada % por inversión</h3>
                <ReactApexChart
                  options={{
                    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
                    colors: portafolioOrdenado.map(p => {
                      const invertido = p.saldo_inicial + p.aportes_acumulados
                      const meses = Math.max(p.meses_registrados - 1, 1)
                      const rentAnual = invertido > 0 ? (Math.pow((p.saldo_actual || 0) / invertido, 12 / meses) - 1) * 100 : 0
                      const meta = Number(parametros.rendimiento_minimo_esperado || 10)
                      return rentAnual >= meta ? '#22c55e' : rentAnual >= 0 ? '#f59e0b' : '#ef4444'
                    }),
                    plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
                    dataLabels: { enabled: false },
                    legend: { show: false },
                    annotations: {
                      xaxis: [{
                        x: Number(parametros.rendimiento_minimo_esperado || 10),
                        borderColor: '#6366f1',
                        strokeDashArray: 4,
                        label: {
                          text: `Meta ${parametros.rendimiento_minimo_esperado || 10}%`,
                          style: { color: '#6366f1', background: '#1e293b' }
                        }
                      }]
                    },
                    xaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `${Number(v).toFixed(1)}%` } },
                    yaxis: { labels: { style: { colors: '#94a3b8' } } },
                    grid: { borderColor: '#334155' },
                    tooltip: { theme: 'dark', y: { formatter: (v) => `${Number(v).toFixed(2)}%` } },
                  }}
                  series={[{
                    name: 'Rentabilidad anualizada',
                    data: portafolioOrdenado.map(p => {
                      const invertido = p.saldo_inicial + p.aportes_acumulados
                      const meses = Math.max(p.meses_registrados - 1, 1)
                      const rentAnual = invertido > 0 ? (Math.pow((p.saldo_actual || 0) / invertido, 12 / meses) - 1) * 100 : 0
                      return { x: p.nombre, y: Number(rentAnual.toFixed(2)) }
                    })
                  }]}
                  type="bar" height={alturaComparativa} />
              </Card>
              <Card>
                <h3 className="text-white font-semibold mb-4">Distribución del portafolio</h3>
                <ReactApexChart options={pieOptions} series={pieSeries} type="donut" height={alturaComparativa} />
              </Card>
            </div>
            )
          })()}
        </div>
      )}

      {/* ── TAB: PATRIMONIO ── */}
      {tab === 'patrimonio' && (
        cargando ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">Cargando...</p>
          </div>
        ) : filas.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-slate-400">No hay datos en el rango seleccionado</p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <h3 className="text-white font-semibold mb-4">Evolución del Patrimonio Neto</h3>
              <ReactApexChart options={areaOptions} series={areaSeries} type="area" height={320} />
            </Card>

            <Card>
              <h3 className="text-white font-semibold mb-4">Crecimiento neto mes a mes</h3>
              <ReactApexChart
                options={{
                  chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
                  colors: filas.map(f => f.crecimientoNeto >= 0 ? '#22c55e' : '#ef4444'),
                  plotOptions: { bar: { borderRadius: 4, distributed: true } },
                  dataLabels: { enabled: false },
                  legend: { show: false },
                  xaxis: { categories: ejeX, labels: { style: { colors: '#94a3b8' } } },
                  yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
                  grid: { borderColor: '#334155' },
                  tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
                }}
                series={[{ name: 'Crecimiento neto', data: filas.map(f => f.crecimientoNeto) }]}
                type="bar" height={280}
              />
            </Card>

            <Card>
              <h3 className="text-white font-semibold mb-4">Detalle patrimonial</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700 text-right">
                      <th className="text-left py-3 pr-4">Mes</th>
                      <th className="py-3 px-3">Patrimonio</th>
                      <th className="py-3 px-3">Crecimiento $</th>
                      <th className="py-3 pl-3">Crecimiento %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filas.map((f, idx) => {
                      const patrimonioAnterior = idx > 0 ? filas[idx - 1].patrimonio : f.patrimonio
                      const crecimientoPct = patrimonioAnterior > 0 ? ((f.patrimonio - patrimonioAnterior) / patrimonioAnterior) * 100 : 0
                      return (
                        <tr key={idx} className="hover:bg-slate-700/20 text-right">
                          <td className="py-3 pr-4 text-left text-slate-300 font-medium">{MESES_NOMBRES[f.mes]} {f.anio}</td>
                          <td className="py-3 px-3 font-mono text-indigo-400 font-bold">{formatCOP(f.patrimonio)}</td>
                          <td className={`py-3 px-3 font-mono font-bold ${f.crecimientoNeto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {f.crecimientoNeto >= 0 ? '+' : ''}{formatCOP(f.crecimientoNeto)}
                          </td>
                          <td className={`py-3 pl-3 font-mono ${crecimientoPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {idx === 0 ? '—' : `${crecimientoPct >= 0 ? '+' : ''}${crecimientoPct.toFixed(1)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      )}
    </div>
  )
}