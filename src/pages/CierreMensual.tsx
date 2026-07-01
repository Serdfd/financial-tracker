import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Save, Lock, Upload, CheckCircle, AlertCircle, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { Mes, IngresoMes, GastoMes, DeudaTC, InversionMensual, Inversion } from '@/types'
import { formatCOP, formatPct, MESES_NOMBRES } from '@/lib/format'

type Tab = 'ingresos' | 'gastos' | 'inversiones' | 'deudas' | 'cuadre'

export function CierreMensual() {
  const { mesActivo, anioActivo, setMesActivo, categorias, monedas } = useAppStore()
  const [tab, setTab] = useState<Tab>('ingresos')
  const [mes, setMes] = useState<Mes | null>(null)
  const [ingresos, setIngresos] = useState<IngresoMes[]>([])
  const [gastos, setGastos] = useState<GastoMes[]>([])
  const [deudas, setDeudas] = useState<DeudaTC[]>([])
  const [inversiones, setInversiones] = useState<Inversion[]>([])
  const [invMensual, setInvMensual] = useState<Record<number, InversionMensual>>({})
  const [guardando, setGuardando] = useState(false)
  const [cuadre, setCuadre] = useState<any>(null)
  const [cargandoCuadre, setCargandoCuadre] = useState(false)

  // ── IMPORTACIÓN CSV DETALLE ──────────────────────────
  const inputCsvRef = useRef<HTMLInputElement>(null)
  const [modalCsv, setModalCsv] = useState(false)
  const [importando, setImportando] = useState(false)
  const [soloDetalle, setSoloDetalle] = useState(false)

  type FilaCsv = {
    fecha: string
    hora: string
    cuenta: string
    categoria_nombre_original: string
    tipo: 'ingreso' | 'gasto'
    monto: number
    descripcion: string
    categoria_id: number | null
    omitir: boolean
  }

  const [csvRows, setCsvRows] = useState<FilaCsv[]>([])

  function fixEncoding(str: string): string {
    try { return decodeURIComponent(escape(str)) } catch { return str }
  }

  function parsearMonto(str: string): number {
    return parseFloat(str.replace(/,/g, '')) || 0
  }

  function procesarCsvDetalle(contenido: string) {
    const todasCategorias = [...categorias]
    const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l)

    const headerIdx = lineas.findIndex(l =>
      l.toLowerCase().includes('fecha') && l.toLowerCase().includes('gasto')
    )
    if (headerIdx === -1) {
      alert('No se encontró el encabezado esperado en el CSV.')
      return
    }

    const filas: FilaCsv[] = []
    for (const linea of lineas.slice(headerIdx + 1)) {
      const matches = [...linea.matchAll(/"([^"]*)"/g)].map(m => m[1])
      if (matches.length < 7) continue

      const fecha = matches[1].trim()
      const hora = matches[2].trim()
      const cuenta = fixEncoding(matches[3].trim())
      const categoriaNombre = fixEncoding(matches[4].trim())
      const ingresoStr = matches[5].trim()
      const gastoStr = matches[6].trim()
      const descripcion = fixEncoding(matches[7]?.trim() || '')

      const esIngreso = ingresoStr !== '' && parsearMonto(ingresoStr) > 0
      const monto = parsearMonto(esIngreso ? ingresoStr : gastoStr)
      if (monto <= 0) continue

      const tipo: 'ingreso' | 'gasto' = esIngreso ? 'ingreso' : 'gasto'
      const tipoFiltro = tipo === 'ingreso' ? 'ingreso' : 'gasto'
      const cat = todasCategorias.find(
        c => c.tipo === tipoFiltro &&
          c.nombre.toLowerCase().trim() === categoriaNombre.toLowerCase().trim()
      )

      filas.push({
        fecha, hora, cuenta, categoria_nombre_original: categoriaNombre,
        tipo, monto, descripcion,
        categoria_id: cat?.id || null,
        omitir: false
      })
    }

    if (filas.length === 0) {
      alert('No se encontraron transacciones válidas en el CSV.')
      return
    }

    setCsvRows(filas)
    setModalCsv(true)
  }

  function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const reader = new FileReader()
    reader.onload = ev => procesarCsvDetalle(ev.target?.result as string)
    reader.readAsText(archivo, 'UTF-8')
    e.target.value = ''
  }

  async function confirmarImportacion() {
    if (!mes) return

    // Verificar si ya hay transacciones importadas para este mes
    const existentes = await window.electronAPI.getTransaccionesMes(mes.id)
    if (existentes.length > 0) {
      const confirmar = confirm(`Ya hay ${existentes.length} transacciones registradas para este mes. ¿Deseas agregar más de todas formas?`)
      if (!confirmar) return
    }

    setImportando(true)
    const copId = monedas.find(m => m.codigo === 'COP')?.id || 1
    const filasValidas = csvRows.filter(r => !r.omitir && r.categoria_id && r.monto > 0)

    if (!soloDetalle) {
      // Agrupar por tipo + categoria_id para el cierre mensual
      const totalesIngreso: Record<number, number> = {}
      const totalesGasto: Record<number, number> = {}

      for (const fila of filasValidas) {
        if (fila.tipo === 'ingreso') {
          totalesIngreso[fila.categoria_id!] = (totalesIngreso[fila.categoria_id!] || 0) + fila.monto
        } else {
          totalesGasto[fila.categoria_id!] = (totalesGasto[fila.categoria_id!] || 0) + fila.monto
        }
      }

      for (const [catId, monto] of Object.entries(totalesIngreso)) {
        await window.electronAPI.saveIngresoMes({
          id: 0, mes_id: mes.id,
          categoria_id: Number(catId),
          monto, moneda_id: copId,
          nota: 'Importado desde CSV'
        })
      }

      for (const [catId, monto] of Object.entries(totalesGasto)) {
        await window.electronAPI.saveGastoMes({
          id: 0, mes_id: mes.id,
          categoria_id: Number(catId),
          monto, moneda_id: copId,
          nota: 'Importado desde CSV'
        })
      }
    }

    // Siempre guardar detalle
    for (const fila of filasValidas) {
      await window.electronAPI.saveTransaccionDetalle({
        mes_id: mes.id,
        fecha: fila.fecha, hora: fila.hora, cuenta: fila.cuenta,
        categoria_id: fila.categoria_id,
        categoria_nombre_original: fila.categoria_nombre_original,
        tipo: fila.tipo, monto: fila.monto, descripcion: fila.descripcion
      })
    }

    await cargarDatos()
    setModalCsv(false)
    setCsvRows([])
    setSoloDetalle(false)
    setImportando(false)
  }

  // Agrupar filas por tipo y categoria para el preview
  const resumenIngreso = csvRows
    .filter(r => r.tipo === 'ingreso' && !r.omitir)
    .reduce((acc, r) => {
      const key = r.categoria_nombre_original
      if (!acc[key]) acc[key] = { nombre: key, categoria_id: r.categoria_id, total: 0, count: 0 }
      acc[key].total += r.monto
      acc[key].count += 1
      return acc
    }, {} as Record<string, { nombre: string; categoria_id: number | null; total: number; count: number }>)

  const resumenGasto = csvRows
    .filter(r => r.tipo === 'gasto' && !r.omitir)
    .reduce((acc, r) => {
      const key = r.categoria_nombre_original
      if (!acc[key]) acc[key] = { nombre: key, categoria_id: r.categoria_id, total: 0, count: 0 }
      acc[key].total += r.monto
      acc[key].count += 1
      return acc
    }, {} as Record<string, { nombre: string; categoria_id: number | null; total: number; count: number }>)

  const hayNoEncontrados = csvRows.some(r => !r.omitir && !r.categoria_id)
  const filasValidas = csvRows.filter(r => !r.omitir && r.categoria_id).length

  useEffect(() => { cargarDatos() }, [mesActivo, anioActivo])

  useEffect(() => {
    if (tab === 'cuadre') cargarCuadre()
  }, [tab, mesActivo, anioActivo])

  async function cargarCuadre() {
    setCargandoCuadre(true)
    const data = await window.electronAPI.getCuadreMensual(anioActivo, mesActivo)
    setCuadre(data)
    setCargandoCuadre(false)
  }

  async function cargarDatos() {
    const m = await window.electronAPI.getOrCreateMes(anioActivo, mesActivo)
    setMes(m)
    const [ing, gas, deu, invs] = await Promise.all([
      window.electronAPI.getIngresosMes(m.id),
      window.electronAPI.getGastosMes(m.id),
      window.electronAPI.getDeudasTC(m.id),
      window.electronAPI.getInversiones(),
    ])
    setIngresos(ing)
    setGastos(gas)
    setDeudas(deu)
    setInversiones(invs.filter(i => i.tipo_nombre?.toLowerCase() !== 'inmueble'))

    // Cargar saldos de inversiones para este mes
    const im = await window.electronAPI.getInversionMensualMes(m.id)
    const imMap: Record<number, InversionMensual> = {}
    im.forEach(i => { imMap[i.inversion_id] = i })
    setInvMensual(imMap)
  }

  // ── INGRESOS ────────────────────────────────────────
  function agregarIngreso() {
    const copId = monedas.find(m => m.codigo === 'COP')?.id || 1
    setIngresos(prev => [...prev, {
      id: 0, mes_id: mes!.id, categoria_id: 0,
      monto: 0, moneda_id: copId, nota: ''
    }])
  }

  async function guardarIngreso(idx: number) {
    const ing = ingresos[idx]
    await window.electronAPI.saveIngresoMes({ ...ing, mes_id: mes!.id })
    await cargarDatos()
  }

  async function eliminarIngreso(id: number, idx: number) {
    if (id) await window.electronAPI.deleteIngresoMes(id)
    setIngresos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── GASTOS ──────────────────────────────────────────
  function agregarGasto() {
    const copId = monedas.find(m => m.codigo === 'COP')?.id || 1
    setGastos(prev => [...prev, {
      id: 0, mes_id: mes!.id, categoria_id: 0,
      monto: 0, moneda_id: copId, nota: ''
    }])
  }

  async function guardarGasto(idx: number) {
    const g = gastos[idx]
    await window.electronAPI.saveGastoMes({ ...g, mes_id: mes!.id })
    await cargarDatos()
  }

  async function eliminarGasto(id: number, idx: number) {
    if (id) await window.electronAPI.deleteGastoMes(id)
    setGastos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── DEUDAS TC ────────────────────────────────────────
  function agregarDeuda() {
    setDeudas(prev => [...prev, { id: 0, mes_id: mes!.id, nombre_tc: '', saldo: 0 }])
  }

  async function guardarDeuda(idx: number) {
    await window.electronAPI.saveDeudaTC({ ...deudas[idx], mes_id: mes!.id })
    await cargarDatos()
  }

  async function eliminarDeuda(id: number, idx: number) {
    if (id) await window.electronAPI.deleteDeudaTC(id)
    setDeudas(prev => prev.filter((_, i) => i !== idx))
  }

  // ── INVERSIONES ──────────────────────────────────────
  function updateInvMensual(invId: number, campo: string, valor: number) {
    setInvMensual(prev => ({
      ...prev,
      [invId]: {
        ...(prev[invId] || { inversion_id: invId, mes_id: mes!.id, saldo_cierre: 0, aportes: 0, retiros: 0, rendimiento: 0, rentabilidad_pct: 0 }),
        [campo]: valor
      }
    }))
  }

  async function guardarInversiones() {
    setGuardando(true)
    for (const invId of Object.keys(invMensual)) {
      const im = invMensual[Number(invId)]
      await window.electronAPI.saveInversionMensual({ ...im, mes_id: mes!.id })
    }
    await cargarDatos()
    setGuardando(false)
  }

  async function cerrarMes() {
    if (!mes) return
    if (!confirm(`¿Cerrar ${MESES_NOMBRES[mesActivo]} ${anioActivo}? No podrás editar los datos.`)) return
    await window.electronAPI.cerrarMes(mes.id)
    await cargarDatos()
  }

  // Mejora 3: Validación por fila
  function ingresoValido(ing: IngresoMes): boolean {
    return !!(ing.categoria_id && ing.monto && ing.monto > 0)
  }
  function gastoValido(g: GastoMes): boolean {
    return !!(g.categoria_id && g.monto && g.monto > 0)
  }
  function deudaValida(d: DeudaTC): boolean {
    return !!(d.nombre_tc && d.nombre_tc.trim() && d.saldo && d.saldo > 0)
  }

  const totalIngresos = ingresos.reduce((s, i) => s + (i.monto || 0), 0)
  const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0)
  const totalDeudas = deudas.reduce((s, d) => s + (d.saldo || 0), 0)
  const categoriasIngreso = categorias.filter(c => c.tipo === 'ingreso')
  const categoriasGasto = categorias.filter(c => c.tipo === 'gasto')
  const cerrado = mes?.cerrado === 1

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ingresos', label: `Ingresos (${formatCOP(totalIngresos)})` },
    { key: 'gastos', label: `Gastos (${formatCOP(totalGastos)})` },
    { key: 'inversiones', label: `Inversiones (${inversiones.length})` },
    { key: 'deudas', label: `Deudas TC (${formatCOP(totalDeudas)})` },
    { key: 'cuadre', label: 'Conciliación' },
  ]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cierre Mensual</h1>
          <p className="text-slate-400 text-sm mt-0.5">Registra los movimientos del mes</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={mesActivo} onChange={e => setMesActivo(Number(e.target.value), anioActivo)} className="w-36">
            {MESES_NOMBRES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select value={anioActivo} onChange={e => setMesActivo(mesActivo, Number(e.target.value))} className="w-24">
            {[2023, 2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {!cerrado && (
            <button
              onClick={cerrarMes}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              <Lock size={14} /> Cerrar Mes
            </button>
          )}
          {cerrado && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm border border-amber-500/30">
              <Lock size={14} /> Mes cerrado
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: INGRESOS ── */}
      {tab === 'ingresos' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Ingresos del mes</h3>
            <div className="flex items-center gap-2">
              <input ref={inputCsvRef} type="file" accept=".csv" className="hidden" onChange={onArchivoSeleccionado} />
              <button onClick={() => inputCsvRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                <Upload size={14} /> Importar CSV
              </button>
              {!cerrado && (
                <button onClick={agregarIngreso} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                  <Plus size={14} /> Agregar
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {ingresos.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No hay ingresos registrados</p>}
            {ingresos.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-lg">
                <select className="col-span-3" value={ing.categoria_id || ''} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, categoria_id: Number(e.target.value) } : x))}>
                  <option value="">Categoría *</option>
                  {categoriasIngreso.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                </select>
                <input type="number" className="col-span-2" placeholder="Monto *" value={ing.monto || ''} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, monto: Number(e.target.value) } : x))} />
                <select className="col-span-2" value={ing.moneda_id} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, moneda_id: Number(e.target.value) } : x))}>
                  {monedas.map(m => <option key={m.id} value={m.id}>{m.codigo}</option>)}
                </select>
                <input className="col-span-3" placeholder="Nota (opcional)" value={ing.nota || ''} disabled={cerrado}
                  onChange={e => setIngresos(prev => prev.map((x, i) => i === idx ? { ...x, nota: e.target.value } : x))} />
                {!cerrado && (
                  <>
                    <button onClick={() => guardarIngreso(idx)} disabled={!ingresoValido(ing)}
                      className="col-span-1 p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                      <Save size={14} />
                    </button>
                    <button onClick={() => eliminarIngreso(ing.id, idx)} className="col-span-1 p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {ingresos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700 flex justify-end">
              <span className="text-slate-400 text-sm">Total: <span className="text-green-400 font-mono font-bold">{formatCOP(totalIngresos)}</span></span>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: GASTOS ── */}
      {tab === 'gastos' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Gastos del mes</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => inputCsvRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                  <Upload size={14} /> Importar CSV
                </button>                
                {!cerrado && (
                  <button onClick={agregarGasto} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                    <Plus size={14} /> Agregar
                  </button>
                )}
              </div>            
          </div>
          <div className="space-y-2">
            {gastos.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No hay gastos registrados</p>}
            {gastos.map((g, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-lg">
                <select className="col-span-3" value={g.categoria_id || ''} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, categoria_id: Number(e.target.value) } : x))}>
                  <option value="">Categoría *</option>
                  {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                </select>
                <input type="number" className="col-span-2" placeholder="Monto *" value={g.monto || ''} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, monto: Number(e.target.value) } : x))} />
                <select className="col-span-2" value={g.moneda_id} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, moneda_id: Number(e.target.value) } : x))}>
                  {monedas.map(m => <option key={m.id} value={m.id}>{m.codigo}</option>)}
                </select>
                <input className="col-span-3" placeholder="Nota (opcional)" value={g.nota || ''} disabled={cerrado}
                  onChange={e => setGastos(prev => prev.map((x, i) => i === idx ? { ...x, nota: e.target.value } : x))} />
                {!cerrado && (
                  <>
                    <button onClick={() => guardarGasto(idx)} disabled={!gastoValido(g)}
                      className="col-span-1 p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                      <Save size={14} />
                    </button>
                    <button onClick={() => eliminarGasto(g.id, idx)} className="col-span-1 p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {gastos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700 flex justify-end">
              <span className="text-slate-400 text-sm">Total: <span className="text-red-400 font-mono font-bold">{formatCOP(totalGastos)}</span></span>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: INVERSIONES ── */}
      {tab === 'inversiones' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Saldos de inversiones</h3>
            {!cerrado && (
              <button onClick={guardarInversiones} disabled={guardando}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar todo'}
              </button>
            )}
          </div>
          {inversiones.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No hay inversiones. Agrégalas en la sección Inversiones.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2 pr-2">Inversión</th>
                    <th className="text-right py-2 px-2">Saldo Cierre</th>
                    <th className="text-right py-2 px-2">Aportes</th>
                    <th className="text-right py-2 px-2">Retiros</th>
                    <th className="text-right py-2 px-2">Rendimiento</th>
                    <th className="text-right py-2 pl-2">Rentab. %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {inversiones.map(inv => {
                    const im = invMensual[inv.id] || { saldo_cierre: 0, aportes: 0, retiros: 0, rendimiento: 0, rentabilidad_pct: 0 }
                    const esCuenta = !!inv.es_cuenta
                    return (
                      <tr key={inv.id} className="hover:bg-slate-700/30">
                        <td className="py-2 pr-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-white font-medium truncate">{inv.nombre}</p>
                              {esCuenta && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 shrink-0">Cuenta</span>}
                            </div>
                            <p className="text-slate-500 text-xs truncate">{inv.entidad_nombre} · {inv.moneda_codigo}</p>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" disabled={cerrado} value={im.saldo_cierre || ''}
                            onChange={e => updateInvMensual(inv.id, 'saldo_cierre', Number(e.target.value))}
                            className="w-full text-right" placeholder="0" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" disabled={cerrado} value={im.aportes || ''}
                            onChange={e => updateInvMensual(inv.id, 'aportes', Number(e.target.value))}
                            className="w-full text-right" placeholder="0" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" disabled={cerrado} value={im.retiros || ''}
                            onChange={e => updateInvMensual(inv.id, 'retiros', Number(e.target.value))}
                            className="w-full text-right" placeholder="0" />
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-medium ${im.rendimiento >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {esCuenta ? <span className="text-slate-600">—</span> : formatCOP(im.rendimiento || 0)}
                        </td>
                        <td className={`py-2 pl-2 text-right font-mono ${im.rentabilidad_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {esCuenta ? <span className="text-slate-600">—</span> : formatPct(im.rentabilidad_pct || 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: DEUDAS TC ── */}
      {tab === 'deudas' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Deudas de Tarjetas de Crédito</h3>
            {!cerrado && (
              <button onClick={agregarDeuda} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
                <Plus size={14} /> Agregar TC
              </button>
            )}
          </div>
          <p className="text-slate-500 text-xs mb-4">💡 Registra solo el saldo pendiente al final del mes, no los pagos (los pagos son traslados, no gastos)</p>
          <div className="space-y-2">
            {deudas.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No hay deudas de TC registradas</p>}
            {deudas.map((d, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-lg">
                <input className="col-span-5" placeholder="Nombre de la tarjeta *" value={d.nombre_tc} disabled={cerrado}
                  onChange={e => setDeudas(prev => prev.map((x, i) => i === idx ? { ...x, nombre_tc: e.target.value } : x))} />
                <input type="number" className="col-span-4" placeholder="Saldo pendiente *" value={d.saldo || ''} disabled={cerrado}
                  onChange={e => setDeudas(prev => prev.map((x, i) => i === idx ? { ...x, saldo: Number(e.target.value) } : x))} />
                {!cerrado && (
                  <>
                    <button onClick={() => guardarDeuda(idx)} disabled={!deudaValida(d)}
                      className="col-span-1 p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                      <Save size={14} />
                    </button>
                    <button onClick={() => eliminarDeuda(d.id, idx)} className="col-span-2 p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {deudas.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700 flex justify-end">
              <span className="text-slate-400 text-sm">Total deuda: <span className="text-red-400 font-mono font-bold">{formatCOP(totalDeudas)}</span></span>
            </div>
         )}
      </Card>
      )}
      {/* ── TAB: CUADRE ── */}
      {tab === 'cuadre' && (
        cargandoCuadre ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">Calculando cuadre...</p>
          </div>
        ) : !cuadre ? (
          <Card>
            <p className="text-slate-500 text-center py-8">No hay datos registrados para este mes.</p>
          </Card>
        ) : (() => {
          const cuadraOk = Math.abs(cuadre.diferencia) < 1000
          const cuadraCerca = Math.abs(cuadre.diferencia) < Math.max(cuadre.ingresos * 0.02, 50000)
          const color = cuadraOk ? 'green' : cuadraCerca ? 'amber' : 'red'
          const colorClass = { green: 'text-green-400', amber: 'text-amber-400', red: 'text-red-400' }[color]
          const borderClass = { green: 'border-green-500/30 bg-green-500/10', amber: 'border-amber-500/30 bg-amber-500/10', red: 'border-red-500/30 bg-red-500/10' }[color]
          const icono = cuadraOk ? '🟢' : cuadraCerca ? '🟡' : '🔴'
          const label = cuadraOk ? 'Conciliación correcta' : cuadraCerca ? 'Diferencia menor' : 'Diferencia significativa'
          return (
            <div className="space-y-4">
              {/* Banner estado */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${borderClass}`}>
                <div>
                  <p className={`text-lg font-bold ${colorClass}`}>{icono} {label}</p>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {cuadraOk ? 'Todos los movimientos están bien registrados.' :
                      cuadre.diferencia > 0
                        ? 'Hay plata no rastreada: gastos sin registrar o ingresos de más.'
                        : 'Hay activos que crecieron sin flujo registrado: aportes u otros movimientos no reflejados.'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs mb-0.5">Diferencia</p>
                  <p className={`text-2xl font-mono font-bold ${colorClass}`}>
                    {cuadre.diferencia >= 0 ? '+' : ''}{formatCOP(cuadre.diferencia)}
                  </p>
                </div>
              </div>

              {/* Dos columnas */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <h3 className="text-white font-semibold mb-4">Flujo registrado</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ingresos</span>
                      <span className="text-green-400 font-mono">+{formatCOP(cuadre.ingresos)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gastos</span>
                      <span className="text-red-400 font-mono">−{formatCOP(cuadre.gastos)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rendimientos</span>
                      <span className={`font-mono ${cuadre.rendimientos >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {cuadre.rendimientos >= 0 ? '+' : ''}{formatCOP(cuadre.rendimientos)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-slate-700 flex justify-between">
                      <span className="text-white font-semibold">Crecimiento teórico</span>
                      <span className={`font-mono font-bold text-base ${cuadre.crecimientoTeorico >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                        {cuadre.crecimientoTeorico >= 0 ? '+' : ''}{formatCOP(cuadre.crecimientoTeorico)}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-white font-semibold mb-4">Cambio en balances</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <div>
                        <span className="text-slate-400">Δ Activos</span>
                        <span className="text-xs text-slate-500 ml-1">(inv+cuentas, excl. inmuebles)</span>
                      </div>
                      <span className={`font-mono ${cuadre.deltaSaldos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {cuadre.deltaSaldos >= 0 ? '+' : ''}{formatCOP(cuadre.deltaSaldos)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Anterior: {formatCOP(cuadre.totalSaldosAnteriores)}</span>
                      <span>Actual: {formatCOP(cuadre.totalSaldosActuales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <div>
                        <span className="text-slate-400">Δ Deudas TC</span>
                        <span className="text-xs text-slate-500 ml-1">(efecto patrimonio)</span>
                      </div>
                      <span className={`font-mono ${cuadre.deltaDeudas <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {cuadre.deltaDeudas > 0 ? '−' : '+'}{formatCOP(Math.abs(cuadre.deltaDeudas))}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Anterior: {formatCOP(cuadre.deudasAnteriores)}</span>
                      <span>Actual: {formatCOP(cuadre.deudasActuales)}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-700 flex justify-between">
                      <span className="text-white font-semibold">Crecimiento real</span>
                      <span className={`font-mono font-bold text-base ${cuadre.crecimientoReal >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                        {cuadre.crecimientoReal >= 0 ? '+' : ''}{formatCOP(cuadre.crecimientoReal)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Desglose por activo */}
              <Card>
                <h3 className="text-white font-semibold mb-3">Desglose por activo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700 text-right">
                        <th className="text-left py-2 pr-3">Activo</th>
                        <th className="py-2 px-3">Saldo mes anterior</th>
                        <th className="py-2 px-3">Saldo cierre</th>
                        <th className="py-2 pl-3">Δ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {cuadre.detalle.map((d: any) => (
                        <tr key={d.inversion_id} className="hover:bg-slate-700/20 text-right">
                          <td className="py-2 pr-3 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white">{d.nombre}</span>
                              {d.es_cuenta === 1 && <span className="text-xs px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Cuenta</span>}
                            </div>
                            <p className="text-slate-500 text-xs">{d.tipo_nombre || '—'}</p>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">{formatCOP(d.saldo_anterior)}</td>
                          <td className="py-2 px-3 font-mono text-white">{formatCOP(d.saldo_actual)}</td>
                          <td className={`py-2 pl-3 font-mono font-bold ${d.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {d.delta >= 0 ? '+' : ''}{formatCOP(d.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-600 text-right font-bold">
                        <td className="py-2 pr-3 text-left text-white">Total</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{formatCOP(cuadre.totalSaldosAnteriores)}</td>
                        <td className="py-2 px-3 font-mono text-white">{formatCOP(cuadre.totalSaldosActuales)}</td>
                        <td className={`py-2 pl-3 font-mono ${cuadre.deltaSaldos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {cuadre.deltaSaldos >= 0 ? '+' : ''}{formatCOP(cuadre.deltaSaldos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-slate-500 text-xs mt-3">* Los inmuebles se excluyen porque su valor no varía mensualmente por flujo de caja.</p>
              </Card>

              {/* Guía de diferencias */}
              {!cuadraOk && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm">
                  <p className="text-white font-medium mb-2">¿Por qué puede haber diferencia?</p>
                  {cuadre.diferencia > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li>Gastos en efectivo no registrados como gasto</li>
                      <li>Ingreso registrado que en realidad fue un aporte a inversión</li>
                      <li>Retiro de inversión no registrado como ingreso</li>
                    </ul>
                  ) : (
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li>Aporte a inversión no registrado como ingreso previo</li>
                      <li>Pago de TC registrado como gasto (solo registra el saldo pendiente)</li>
                      <li>Saldo de inversión actualizado sin el rendimiento correspondiente</li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })()
      )}

      {/* ── MODAL IMPORTAR CSV DETALLE ── */}
      <Modal open={modalCsv} onClose={() => { setModalCsv(false); setCsvRows([]) }}
        titulo="Importar movimientos desde CSV" ancho="max-w-3xl">
        <div className="space-y-4">

          {/* Resumen */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="flex items-center gap-1.5 text-green-400">
              <CheckCircle size={14} /> {filasValidas} transacciones listas
            </span>
            {hayNoEncontrados && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertCircle size={14} /> Hay categorías sin mapear
              </span>
            )}
            <span className="text-slate-500 text-xs">
              {csvRows.filter(r => r.tipo === 'ingreso').length} ingresos · {csvRows.filter(r => r.tipo === 'gasto').length} gastos
            </span>
          </div>

          {/* Ingresos agrupados */}
          {Object.keys(resumenIngreso).length > 0 && (
            <div>
              <p className="text-green-400 text-xs font-semibold uppercase mb-2">Ingresos</p>
              <div className="space-y-1">
                {Object.values(resumenIngreso).map((grupo, idx) => {
                  const cats = categorias.filter(c => c.tipo === 'ingreso')
                  const encontrada = !!grupo.categoria_id
                  return (
                    <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg text-sm ${encontrada ? 'bg-slate-900' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                      <div className="col-span-1 flex justify-center">
                        {encontrada ? <CheckCircle size={14} className="text-green-400" /> : <AlertCircle size={14} className="text-amber-400" />}
                      </div>
                      <div className="col-span-3 text-slate-400 truncate text-xs" title={grupo.nombre}>{grupo.nombre}</div>
                      <div className="col-span-2 text-slate-500 text-xs">{grupo.count} mov.</div>
                      <div className="col-span-2 text-green-400 font-mono text-right">{formatCOP(grupo.total)}</div>
                      <div className="col-span-4">
                        {encontrada
                          ? <span className="text-green-400 text-xs">{cats.find(c => c.id === grupo.categoria_id)?.emoji} {cats.find(c => c.id === grupo.categoria_id)?.nombre}</span>
                          : <select className="w-full text-xs"
                              value={grupo.categoria_id || ''}
                              onChange={e => setCsvRows(prev => prev.map(r =>
                                r.tipo === 'ingreso' && r.categoria_nombre_original === grupo.nombre
                                  ? { ...r, categoria_id: Number(e.target.value) || null }
                                  : r
                              ))}>
                              <option value="">Seleccionar...</option>
                              {cats.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                            </select>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Gastos agrupados */}
          {Object.keys(resumenGasto).length > 0 && (
            <div>
              <p className="text-red-400 text-xs font-semibold uppercase mb-2">Gastos</p>
              <div className="space-y-1">
                {Object.values(resumenGasto).map((grupo, idx) => {
                  const cats = categorias.filter(c => c.tipo === 'gasto')
                  const encontrada = !!grupo.categoria_id
                  return (
                    <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg text-sm ${encontrada ? 'bg-slate-900' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                      <div className="col-span-1 flex justify-center">
                        {encontrada ? <CheckCircle size={14} className="text-green-400" /> : <AlertCircle size={14} className="text-amber-400" />}
                      </div>
                      <div className="col-span-3 text-slate-400 truncate text-xs" title={grupo.nombre}>{grupo.nombre}</div>
                      <div className="col-span-2 text-slate-500 text-xs">{grupo.count} mov.</div>
                      <div className="col-span-2 text-red-400 font-mono text-right">{formatCOP(grupo.total)}</div>
                      <div className="col-span-4">
                        {encontrada
                          ? <span className="text-green-400 text-xs">{cats.find(c => c.id === grupo.categoria_id)?.emoji} {cats.find(c => c.id === grupo.categoria_id)?.nombre}</span>
                          : <select className="w-full text-xs"
                              value={grupo.categoria_id || ''}
                              onChange={e => setCsvRows(prev => prev.map(r =>
                                r.tipo === 'gasto' && r.categoria_nombre_original === grupo.nombre
                                  ? { ...r, categoria_id: Number(e.target.value) || null }
                                  : r
                              ))}>
                              <option value="">Seleccionar...</option>
                              {cats.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>)}
                            </select>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Modo importación */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={soloDetalle}
                onChange={e => setSoloDetalle(e.target.checked)}
                className="w-4 h-4 rounded" />
              <span className="text-slate-300 text-sm">Solo guardar detalle</span>
            </label>
            <p className="text-slate-500 text-xs">Actívalo si el mes ya está cerrado — no modifica ingresos ni gastos registrados</p>
          </div>

          {/* Acciones */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-700">
            <button onClick={() => { setModalCsv(false); setCsvRows([]) }}
              className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={confirmarImportacion}
              disabled={importando || filasValidas === 0 || (hayNoEncontrados && !soloDetalle)}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {importando ? 'Importando...' : soloDetalle ? `Guardar detalle (${filasValidas} transacciones)` : `Importar ${filasValidas} transacciones`}
            </button>
          </div>

          {hayNoEncontrados && (
            <p className="text-amber-400 text-xs text-center">
              Asigna una categoría a todos los grupos marcados en amarillo para poder importar.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}