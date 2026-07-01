import { useEffect, useState } from 'react'
import ReactApexChart from 'react-apexcharts'
import { TrendingUp, TrendingDown, Wallet, CreditCard, DollarSign, AlertTriangle } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { DashboardData, AlertaCDT } from '@/types'
import { formatCOP, formatPct, MESES_NOMBRES, nombreMes } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'

export function Dashboard() {
  const { mesActivo, anioActivo, setMesActivo } = useAppStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [alertas, setAlertas] = useState<AlertaCDT[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAlertas, setModalAlertas] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [mesActivo, anioActivo])

  async function cargarDatos() {
    setCargando(true)
    const [d, a] = await Promise.all([
      window.electronAPI.getDashboardData(anioActivo, mesActivo),
      window.electronAPI.getAlertasCDT(),
    ])
    setData(d)
    setAlertas(a)
    if (a.length > 0) setModalAlertas(true)
    setCargando(false)
  }

  const crecimiento = data ? data.ingresos + data.rendimientos - data.gastos : 0

  // Gráfica barras
  const barOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    colors: ['#22c55e', '#ef4444'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data?.ultimos6Meses.map(m => `${MESES_NOMBRES[m.mes].slice(0, 3)} ${m.anio}`) || [],
      labels: { style: { colors: '#94a3b8' } },
    },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
    legend: { labels: { colors: '#94a3b8' } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const barSeries = [
    { name: 'Ingresos', data: data?.ultimos6Meses.map(m => m.ingresos) || [] },
    { name: 'Gastos', data: data?.ultimos6Meses.map(m => m.gastos) || [] },
  ]

  // Gráfica línea
  const lineOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
    colors: ['#6366f1'],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data?.ultimos12Meses.map(m => `${MESES_NOMBRES[m.mes].slice(0, 3)} ${m.anio}`) || [],
      labels: { style: { colors: '#94a3b8' } },
    },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (v) => `$${(v / 1_000_000).toFixed(1)}M` } },
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
  }

  const lineSeries = [
    { name: 'Patrimonio Neto', data: data?.ultimos12Meses.map(m => m.patrimonio) || [] }
  ]

  function donutOptions(labels: string[], colors?: string[]): ApexCharts.ApexOptions {
    return {
      chart: { type: 'donut', background: 'transparent' },
      labels,
      colors: colors || ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#ec4899', '#f97316'],
      legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
      dataLabels: { enabled: false },
      plotOptions: { pie: { donut: { size: '65%' } } },
      tooltip: { theme: 'dark', y: { formatter: (v) => formatCOP(v) } },
    }
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Resumen financiero personal</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mesActivo} onChange={e => setMesActivo(Number(e.target.value), anioActivo)} className="w-36">
            {MESES_NOMBRES.slice(1).map((nombre, i) => <option key={i + 1} value={i + 1}>{nombre}</option>)}
          </select>
          <select value={anioActivo} onChange={e => setMesActivo(mesActivo, Number(e.target.value))} className="w-24">
            {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Cargando datos...</p>
        </div>
      ) : (
        <>
          {/* Alertas CDT */}
          {alertas.length > 0 && (
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                  a.dias_restantes <= 0
                    ? 'bg-red-500/10 border-red-500/30'
                    : a.dias_restantes <= 7
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-indigo-500/10 border-indigo-500/30'
                }`}>
                  <AlertTriangle size={18} className={
                    a.dias_restantes <= 0 ? 'text-red-400' :
                    a.dias_restantes <= 7 ? 'text-amber-400' : 'text-indigo-400'
                  } />
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      {a.dias_restantes <= 0
                        ? `⚠️ ${a.nombre} venció hace ${Math.abs(Math.round(a.dias_restantes))} día(s)`
                        : `📅 ${a.nombre} vence en ${Math.round(a.dias_restantes)} día(s)`
                      }
                    </p>
                    <p className="text-slate-400 text-xs">
                      {a.entidad_nombre || ''} · Vence: {a.fecha_vencimiento}
                      {a.tasa_ea ? ` · Tasa: ${a.tasa_ea}% EA` : ''}
                      {a.plazo_dias ? ` · ${a.plazo_dias} días` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

         {/* Métricas principales */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard titulo="Patrimonio Total" valor={formatCOP(data?.patrimonioNeto || 0)}
              subtitulo={nombreMes(mesActivo, anioActivo)} icono={<Wallet size={20} />} colorIcono="text-indigo-400" />
            <MetricCard titulo="Ingresos del Mes" valor={formatCOP(data?.ingresos || 0)}
              icono={<TrendingUp size={20} />} colorIcono="text-green-400" />
            <MetricCard titulo="Gastos del Mes" valor={formatCOP(data?.gastos || 0)}
              icono={<TrendingDown size={20} />} colorIcono="text-red-400" />
            <MetricCard titulo="Rendimientos" valor={formatCOP(data?.rendimientos || 0)}
              icono={<DollarSign size={20} />} colorIcono="text-cyan-400" />
          </div>

          {/* Desglose del patrimonio */}
          <Card>
            <h3 className="text-white font-semibold text-sm mb-3">Composición del patrimonio</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Inversiones financieras</p>
                <p className="text-white font-mono font-bold">{formatCOP(data?.patrimonioInversiones || 0)}</p>
                <p className="text-slate-500 text-xs mt-0.5">CDTs, acciones, crypto, FICs</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Inmuebles</p>
                <p className="text-white font-mono font-bold">{formatCOP(data?.patrimonioInmuebles || 0)}</p>
                <p className="text-slate-500 text-xs mt-0.5">Valor estimado actual</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Deudas TC</p>
                <p className="text-red-400 font-mono font-bold">−{formatCOP(data?.deudasTC || 0)}</p>
                <p className="text-slate-500 text-xs mt-0.5">Saldo tarjetas de crédito</p>
              </div>
            </div>
          </Card>

          {/* Crecimiento */}
          <Card className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-slate-400 text-sm">Crecimiento neto del mes</p>
              <p className={`text-3xl font-mono font-bold mt-1 ${crecimiento >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {crecimiento >= 0 ? '+' : ''}{formatCOP(crecimiento)}
              </p>
              <p className="text-slate-500 text-xs mt-1">Ingresos + Rendimientos − Gastos</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm">Deudas TC</p>
              <p className="text-red-400 font-mono font-bold text-xl">{formatCOP(data?.deudasTC || 0)}</p>
            </div>
          </Card>

          {/* Gráficas */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-white font-semibold mb-4">Ingresos vs Gastos — Últimos 6 meses</h3>
              {(data?.ultimos6Meses.length || 0) > 0 ? (
                <ReactApexChart options={barOptions} series={barSeries} type="bar" height={250} />
              ) : (
                <EmptyChart mensaje="Registra datos en Cierre Mensual para ver esta gráfica" />
              )}
            </Card>
            <Card>
              <h3 className="text-white font-semibold mb-4">Evolución Patrimonial — Últimos 12 meses</h3>
              {(data?.ultimos12Meses.length || 0) > 0 ? (
                <ReactApexChart options={lineOptions} series={lineSeries} type="area" height={250} />
              ) : (
                <EmptyChart mensaje="Registra saldos de inversiones para ver esta gráfica" />
              )}
            </Card>
          </div>

          {/* Donuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <h3 className="text-white font-semibold mb-2 text-sm">Por Producto</h3>
              {(data?.distribucionInversiones.length || 0) > 0 ? (
                <ReactApexChart options={donutOptions(data!.distribucionInversiones.map(d => d.nombre))}
                  series={data!.distribucionInversiones.map(d => d.valor)} type="donut" height={280} />
              ) : (<EmptyChart mensaje="Sin datos de inversiones" altura="h-48" />)}
            </Card>
            <Card>
              <h3 className="text-white font-semibold mb-2 text-sm">Por Tipo de Inversión</h3>
              {(data?.distribucionTipos.length || 0) > 0 ? (
                <ReactApexChart options={donutOptions(data!.distribucionTipos.map(d => d.tipo))}
                  series={data!.distribucionTipos.map(d => d.valor)} type="donut" height={280} />
              ) : (<EmptyChart mensaje="Sin datos de inversiones" altura="h-48" />)}
            </Card>
            <Card>
              <h3 className="text-white font-semibold mb-2 text-sm">Por Perfil de Riesgo</h3>
              {(data?.distribucionRiesgo.length || 0) > 0 ? (
                <ReactApexChart options={donutOptions(
                  data!.distribucionRiesgo.map(d => d.riesgo), data!.distribucionRiesgo.map(d => d.color))}
                  series={data!.distribucionRiesgo.map(d => d.valor)} type="donut" height={280} />
              ) : (<EmptyChart mensaje="Sin datos de inversiones" altura="h-48" />)}
            </Card>
          </div>
        </>
      )}
      {/* Modal alertas CDT al abrir */}
      <Modal open={modalAlertas} onClose={() => setModalAlertas(false)}
        titulo="⚠️ Alertas de vencimiento — CDTs" ancho="max-w-lg">
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Los siguientes CDTs están próximos a vencer o ya vencieron:</p>
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
              a.dias_restantes <= 0
                ? 'bg-red-500/10 border-red-500/30'
                : a.dias_restantes <= 7
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-indigo-500/10 border-indigo-500/30'
            }`}>
              <AlertTriangle size={18} className={`mt-0.5 flex-shrink-0 ${
                a.dias_restantes <= 0 ? 'text-red-400' :
                a.dias_restantes <= 7 ? 'text-amber-400' : 'text-indigo-400'
              }`} />
              <div>
                <p className="text-white text-sm font-medium">
                  {a.dias_restantes <= 0
                    ? `Venció hace ${Math.abs(Math.round(a.dias_restantes))} día(s)`
                    : `Vence en ${Math.round(a.dias_restantes)} día(s)`}
                </p>
                <p className="text-white text-sm">{a.nombre}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {a.entidad_nombre || ''} · {a.fecha_vencimiento}
                  {a.tasa_ea ? ` · ${a.tasa_ea}% EA` : ''}
                </p>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button onClick={() => setModalAlertas(false)}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm">
              Entendido
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function EmptyChart({ mensaje, altura = 'h-60' }: { mensaje: string; altura?: string }) {
  return (
    <div className={`${altura} flex items-center justify-center`}>
      <p className="text-slate-500 text-sm text-center">{mensaje}</p>
    </div>
  )
}