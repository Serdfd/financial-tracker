import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { Categoria, Entidad, Moneda, PerfilRiesgo, TipoInversion, ReglaCategorizacion } from '@/types'

type TabConfig = 'entidades' | 'tipos' | 'riesgos' | 'categorias' | 'monedas' | 'parametros' | 'reglas'

// Emojis predefinidos para categorías financieras
const EMOJIS_DISPONIBLES = [
  '💰', '💵', '💳', '🏦', '📈', '📉', '💹', '🎁',
  '🏠', '🏢', '🏗️', '🚗', '🚌', '✈️', '🛒', '🍽️',
  '💡', '📱', '💻', '🏥', '🎬', '🎮', '👕', '👗',
  '🏛️', '📦', '🎓', '🐕', '🏋️', '🎣', '🏃', '🎵',
  '🍺', '☕', '🎉', '💄', '🔧', '📚', '🌍', '⛽',
]

export function Configuracion() {
  const { cargarCatalogos, categorias: todasCategorias } = useAppStore()
  const [tab, setTab] = useState<TabConfig>('entidades')
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [tipos, setTipos] = useState<TipoInversion[]>([])
  const [riesgos, setRiesgos] = useState<PerfilRiesgo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [subTabCat, setSubTabCat] = useState<'ingreso' | 'gasto'>('ingreso')
  const [actualizandoTRM, setActualizandoTRM] = useState(false)
  const [trmMensaje, setTrmMensaje] = useState('')

  // Reglas de categorización
  const [reglas, setReglas] = useState<ReglaCategorizacion[]>([])
  const [nuevaRegla, setNuevaRegla] = useState<Partial<ReglaCategorizacion>>({ tipo_patron: 'contiene', tipo: 'ambos', prioridad: 0 })

  const [parametros, setParametros] = useState<Record<string, string>>({ smlv: '1300000', retencion_cdt: '4' })
  const [guardandoParams, setGuardandoParams] = useState(false)

  useEffect(() => {
    window.electronAPI.getParametros().then(setParametros)
  }, [])

  async function guardarParametro(clave: string, valor: string) {
    setGuardandoParams(true)
    await window.electronAPI.saveParametro(clave, valor)
    const p = await window.electronAPI.getParametros()
    setParametros(p)
    setGuardandoParams(false)
  }

  // Edición inline
  const [editando, setEditando] = useState<any>(null)
  const [nuevo, setNuevo] = useState<any>(null)

  useEffect(() => { cargar() }, [tab])

  async function cargarReglas() {
    const r = await window.electronAPI.getReglasCategorizacion()
    setReglas(r)
  }

  useEffect(() => {
    if (tab === 'reglas') cargarReglas()
  }, [tab])

  async function cargar() {
    const [e, t, r, c, m] = await Promise.all([
      window.electronAPI.getCatalogo('entidades'),
      window.electronAPI.getCatalogo('tipos_inversion'),
      window.electronAPI.getCatalogo('perfiles_riesgo'),
      window.electronAPI.getCatalogo('categorias'),
      window.electronAPI.getCatalogo('monedas'),
    ])
    setEntidades(e)
    setTipos(t)
    setRiesgos(r)
    setCategorias(c)
    setMonedas(m)
  }

  async function guardar(tabla: string, data: any) {
    await window.electronAPI.saveCatalogo(tabla, data)
    await cargar()
    await cargarCatalogos()
    setEditando(null)
    setNuevo(null)
  }

  async function eliminar(tabla: string, id: number) {
    if (!confirm('¿Eliminar este registro?')) return
    await window.electronAPI.deleteCatalogo(tabla, id)
    await cargar()
    await cargarCatalogos()
  }

  async function actualizarTasas() {
    setActualizandoTRM(true)
    setTrmMensaje('')
    const result = await window.electronAPI.actualizarTRM()
    setTrmMensaje(result.ok ? `✅ ${result.mensaje}` : `❌ ${result.mensaje}`)
    if (result.ok) {
      await cargar()
      await cargarCatalogos()
    }
    setActualizandoTRM(false)
  }

  const tabs: { key: TabConfig; label: string }[] = [
    { key: 'parametros', label: 'Parámetros Globales' },
    { key: 'entidades', label: 'Entidades' },
    { key: 'tipos', label: 'Tipos de Inversión' },
    { key: 'riesgos', label: 'Perfiles de Riesgo' },
    { key: 'categorias', label: 'Categorías' },
    { key: 'monedas', label: 'Monedas' },
    { key: 'reglas', label: 'Reglas de Categorización' },
  ]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-slate-400 text-sm mt-0.5">Administra los catálogos de la aplicación</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setEditando(null); setNuevo(null) }}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ENTIDADES ── */}
      {tab === 'entidades' && (
        <CatalogoTabla
          titulo="Entidades financieras"
          descripcion="Bancos, corredoras, fintech donde tienes productos"
          items={entidades}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'tipo', label: 'Tipo', type: 'text', placeholder: 'Banco, Fintech, etc.' },
          ]}
          tabla="entidades"
          onGuardar={guardar}
          onEliminar={eliminar}
          editando={editando}
          setEditando={setEditando}
          nuevo={nuevo}
          setNuevo={setNuevo}
        />
      )}

      {/* ── TIPOS DE INVERSIÓN ── */}
      {tab === 'tipos' && (
        <CatalogoTabla
          titulo="Tipos de inversión"
          descripcion="Categorías de productos de inversión"
          items={tipos}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'descripcion', label: 'Descripción', type: 'text' },
          ]}
          tabla="tipos_inversion"
          onGuardar={guardar}
          onEliminar={eliminar}
          editando={editando}
          setEditando={setEditando}
          nuevo={nuevo}
          setNuevo={setNuevo}
        />
      )}

      {/* ── PERFILES DE RIESGO ── */}
      {tab === 'riesgos' && (
        <CatalogoTabla
          titulo="Perfiles de riesgo"
          descripcion="Niveles de riesgo para clasificar inversiones"
          items={riesgos}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'color', label: 'Color', type: 'color' },
            { key: 'descripcion', label: 'Descripción', type: 'text' },
          ]}
          tabla="perfiles_riesgo"
          onGuardar={guardar}
          onEliminar={eliminar}
          editando={editando}
          setEditando={setEditando}
          nuevo={nuevo}
          setNuevo={setNuevo}
        />
      )}

      {/* ── CATEGORÍAS ── */}
      {tab === 'categorias' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Categorías</h3>
              <p className="text-slate-500 text-xs mt-0.5">Categorías para ingresos y gastos</p>
            </div>
            <button
              onClick={() => setNuevo({ tipo: subTabCat, color: '#6366f1', emoji: '' })}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>

          {/* Sub-tabs ingreso/gasto */}
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg mb-4 w-fit">
            {(['ingreso', 'gasto'] as const).map(t => (
              <button key={t} onClick={() => setSubTabCat(t)}
                className={`py-1.5 px-4 rounded text-sm font-medium transition-all capitalize ${subTabCat === t ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                {t === 'ingreso' ? '💰 Ingresos' : '💸 Gastos'}
              </button>
            ))}
          </div>

          {/* Fila nueva */}
          {nuevo && nuevo.tipo === subTabCat && (
            <FilaCategoriaEdicion
              data={nuevo}
              onChange={setNuevo}
              onGuardar={() => guardar('categorias', { ...nuevo, tipo: subTabCat })}
              onCancelar={() => setNuevo(null)}
            />
          )}

          <div className="space-y-2">
            {categorias.filter(c => c.tipo === subTabCat).length === 0 && !nuevo && (
              <p className="text-slate-500 text-sm text-center py-6">Sin categorías de {subTabCat}</p>
            )}
            {categorias.filter(c => c.tipo === subTabCat).map(c => (
              editando?.id === c.id ? (
                <FilaCategoriaEdicion key={c.id}
                  data={editando}
                  onChange={setEditando}
                  onGuardar={() => guardar('categorias', editando)}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <div key={c.id} className="flex items-center justify-between bg-slate-900 px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{c.emoji || '•'}</span>
                    <div className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: c.color }} />
                    <p className="text-white text-sm">{c.nombre}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditando({ ...c })}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors rounded">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => eliminar('categorias', c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        </Card>
      )}

      {/* ── MONEDAS ── */}
      {tab === 'monedas' && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold">Tasas de cambio (TRM)</h3>
                <p className="text-slate-500 text-xs mt-0.5">Se actualiza automáticamente al abrir la app · Fuente: open.er-api.com</p>
              </div>
              <div className="flex items-center gap-3">
                {trmMensaje && <span className="text-xs text-slate-400">{trmMensaje}</span>}
                <button onClick={actualizarTasas} disabled={actualizandoTRM}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                  <RefreshCw size={14} className={actualizandoTRM ? 'animate-spin' : ''} />
                  {actualizandoTRM ? 'Actualizando...' : 'Actualizar TRM'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {monedas.map(m => (
                <div key={m.id} className="bg-slate-900 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-mono font-bold">{m.codigo}</span>
                    <span className="text-slate-400 text-xs">{m.nombre}</span>
                  </div>
                  <p className="text-indigo-400 font-mono text-lg mt-1">
                    {m.codigo === 'COP' ? '—' : `$${m.tasa_a_cop.toLocaleString('es-CO')}`}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {m.codigo === 'COP' ? 'Moneda base' : `1 ${m.codigo} = ${m.tasa_a_cop.toLocaleString('es-CO')} COP`}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <CatalogoTabla
            titulo="Gestión de monedas"
            descripcion="Agrega o edita monedas disponibles"
            items={monedas}
            campos={[
              { key: 'codigo', label: 'Código', type: 'text', required: true, placeholder: 'USD' },
              { key: 'nombre', label: 'Nombre', type: 'text', required: true },
              { key: 'simbolo', label: 'Símbolo', type: 'text', required: true, placeholder: 'US$' },
              { key: 'tasa_a_cop', label: 'Tasa a COP', type: 'number', placeholder: '1' },
            ]}
            tabla="monedas"
            onGuardar={guardar}
            onEliminar={eliminar}
            editando={editando}
            setEditando={setEditando}
            nuevo={nuevo}
            setNuevo={setNuevo}
          />
        </>
      )}

      {/* ── PARÁMETROS GLOBALES ── */}
      {tab === 'parametros' && (
        <Card>
          <h2 className="text-white font-semibold text-lg mb-4">Parámetros globales</h2>
          <div className="space-y-4">

            {/* SMLV */}
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">Salario Mínimo Legal Vigente (SMLV)</p>
                  <p className="text-slate-400 text-xs mt-0.5">Se usa para calcular el valor estimado de inmuebles VIS/VIP. Actualízalo cada año.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={parametros.smlv || ''}
                    onChange={e => setParametros(p => ({ ...p, smlv: e.target.value }))}
                    className="w-36 text-right"
                    placeholder="1300000"
                  />
                  <button
                    onClick={() => guardarParametro('smlv', parametros.smlv)}
                    disabled={guardandoParams}
                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            {/* Retención CDT */}
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">Retención en la fuente — CDT (%)</p>
                  <p className="text-slate-400 text-xs mt-0.5">Porcentaje de retención aplicado al rendimiento de CDTs. Default: 4%.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.retencion_cdt || ''}
                    onChange={e => setParametros(p => ({ ...p, retencion_cdt: e.target.value }))}
                    className="w-24 text-right"
                    placeholder="4"
                  />
                  <span className="text-slate-400 text-sm">%</span>
                  <button
                    onClick={() => guardarParametro('retencion_cdt', parametros.retencion_cdt)}
                    disabled={guardandoParams}
                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            {/* Rendimiento mínimo esperado */}
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">Rendimiento mínimo esperado (%)</p>
                  <p className="text-slate-400 text-xs mt-0.5">Meta de rentabilidad anual. Se usa para evaluar el desempeño de tus inversiones.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={parametros.rendimiento_minimo_esperado || ''}
                    onChange={e => setParametros(p => ({ ...p, rendimiento_minimo_esperado: e.target.value }))}
                    className="w-24 text-right"
                    placeholder="10"
                  />
                  <span className="text-slate-400 text-sm">%</span>
                  <button
                    onClick={() => guardarParametro('rendimiento_minimo_esperado', parametros.rendimiento_minimo_esperado)}
                    disabled={guardandoParams}
                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">
                    Guardar
                  </button>
                </div>
              </div>
            </div>

          </div>
        </Card>
      )}

      {/* ── REGLAS DE CATEGORIZACIÓN ── */}
      {tab === 'reglas' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-white font-semibold mb-1">Reglas de categorización automática</h3>
            <p className="text-slate-400 text-xs mb-4">
              Al importar un CSV, si la categoría original de una transacción no coincide exactamente con una categoría del sistema,
              se aplican estas reglas en orden de prioridad (mayor = primero).
            </p>

            {/* Formulario nueva regla */}
            <div className="bg-slate-900 rounded-lg p-4 mb-4">
              <p className="text-slate-300 text-sm font-medium mb-3">Agregar regla</p>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Patrón (texto a buscar)</label>
                  <input
                    type="text"
                    value={nuevaRegla.patron || ''}
                    onChange={e => setNuevaRegla(r => ({ ...r, patron: e.target.value }))}
                    placeholder="Ej: supermercado, Netflix, Uber..."
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Tipo de coincidencia</label>
                  <select
                    value={nuevaRegla.tipo_patron || 'contiene'}
                    onChange={e => setNuevaRegla(r => ({ ...r, tipo_patron: e.target.value as any }))}
                    className="w-full"
                  >
                    <option value="contiene">Contiene</option>
                    <option value="igual">Igual exacto</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Aplica a</label>
                  <select
                    value={nuevaRegla.tipo || 'ambos'}
                    onChange={e => setNuevaRegla(r => ({ ...r, tipo: e.target.value as any }))}
                    className="w-full"
                  >
                    <option value="ambos">Ingresos y Gastos</option>
                    <option value="ingreso">Solo Ingresos</option>
                    <option value="gasto">Solo Gastos</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Categoría destino</label>
                  <select
                    value={nuevaRegla.categoria_id || ''}
                    onChange={e => setNuevaRegla(r => ({ ...r, categoria_id: Number(e.target.value) || null }))}
                    className="w-full"
                  >
                    <option value="">Seleccionar...</option>
                    <optgroup label="Ingresos">
                      {todasCategorias.filter(c => c.tipo === 'ingreso').map(c => (
                        <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Gastos">
                      {todasCategorias.filter(c => c.tipo === 'gasto').map(c => (
                        <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nombre}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-slate-400 text-xs">Prioridad:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={nuevaRegla.prioridad ?? 0}
                    onChange={e => setNuevaRegla(r => ({ ...r, prioridad: Number(e.target.value) }))}
                    className="w-20 text-right"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!nuevaRegla.patron?.trim() || !nuevaRegla.categoria_id) return
                    await window.electronAPI.saveReglaCategorizacion(nuevaRegla)
                    setNuevaRegla({ tipo_patron: 'contiene', tipo: 'ambos', prioridad: 0 })
                    cargarReglas()
                  }}
                  disabled={!nuevaRegla.patron?.trim() || !nuevaRegla.categoria_id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} /> Agregar regla
                </button>
              </div>
            </div>

            {/* Tabla de reglas existentes */}
            {reglas.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No hay reglas definidas. Las reglas se aplican automáticamente al importar CSV.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2 pr-3">Patrón</th>
                      <th className="text-left py-2 px-3">Coincidencia</th>
                      <th className="text-left py-2 px-3">Aplica a</th>
                      <th className="text-left py-2 px-3">Categoría destino</th>
                      <th className="text-center py-2 px-3">Prioridad</th>
                      <th className="text-center py-2 pl-3">Activa</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {reglas.map(r => (
                      <tr key={r.id} className={`hover:bg-slate-700/20 ${!r.activo ? 'opacity-50' : ''}`}>
                        <td className="py-2 pr-3 font-mono text-amber-300 text-xs">"{r.patron}"</td>
                        <td className="py-2 px-3 text-slate-400 text-xs">
                          {r.tipo_patron === 'contiene' ? 'Contiene' : 'Igual exacto'}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-xs capitalize">
                          {r.tipo === 'ambos' ? 'Ambos' : r.tipo}
                        </td>
                        <td className="py-2 px-3">
                          {r.categoria_nombre ? (
                            <span className="text-white text-xs">
                              {r.categoria_emoji ? `${r.categoria_emoji} ` : ''}{r.categoria_nombre}
                              <span className="ml-1 text-slate-500 capitalize">({r.categoria_tipo})</span>
                            </span>
                          ) : <span className="text-slate-500 text-xs">—</span>}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-300 text-xs font-mono">{r.prioridad}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={async () => {
                              await window.electronAPI.saveReglaCategorizacion({ ...r, activo: r.activo ? 0 : 1 })
                              cargarReglas()
                            }}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${r.activo ? 'bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40' : 'bg-slate-700 text-slate-500 border border-slate-600'}`}
                            title={r.activo ? 'Desactivar' : 'Activar'}
                          >
                            {r.activo ? <Check size={12} /> : <X size={12} />}
                          </button>
                        </td>
                        <td className="py-2 pl-3">
                          <button
                            onClick={async () => {
                              if (!confirm('¿Eliminar esta regla?')) return
                              await window.electronAPI.deleteReglaCategorizacion(r.id)
                              cargarReglas()
                            }}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

// ── COMPONENTE: Fila edición categoría con emoji ────────

interface FilaCategoriaEdicionProps {
  data: any
  onChange: (v: any) => void
  onGuardar: () => void
  onCancelar: () => void
}

function FilaCategoriaEdicion({ data, onChange, onGuardar, onCancelar }: FilaCategoriaEdicionProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const valido = !!(data.nombre && data.nombre.trim())

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/30 px-3 py-2 rounded-lg mb-2 space-y-2">
      <div className="flex items-center gap-2">
        {/* Emoji picker */}
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-10 h-10 bg-slate-800 border border-slate-600 rounded-lg text-lg flex items-center justify-center hover:border-indigo-400 transition-colors"
            title="Elegir emoji"
          >
            {data.emoji || '😀'}
          </button>
          {showEmojiPicker && (
            <div className="absolute top-12 left-0 z-50 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl w-[280px]">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS_DISPONIBLES.map(e => (
                  <button key={e}
                    onClick={() => { onChange({ ...data, emoji: e }); setShowEmojiPicker(false) }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-700 rounded transition-colors">
                    {e}
                  </button>
                ))}
              </div>
              <button onClick={() => { onChange({ ...data, emoji: '' }); setShowEmojiPicker(false) }}
                className="mt-2 w-full text-xs text-slate-400 hover:text-white py-1 bg-slate-700 rounded">
                Sin emoji
              </button>
            </div>
          )}
        </div>

        {/* Color */}
        <input type="color" value={data.color || '#6366f1'}
          onChange={e => onChange({ ...data, color: e.target.value })}
          className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent p-0" />

        {/* Nombre */}
        <input
          placeholder="Nombre de la categoría"
          value={data.nombre || ''}
          onChange={e => onChange({ ...data, nombre: e.target.value })}
          className="flex-1 text-sm py-1.5"
        />

        <button onClick={onGuardar} disabled={!valido}
          className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors disabled:opacity-40 flex-shrink-0">
          <Check size={15} />
        </button>
        <button onClick={onCancelar}
          className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors flex-shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

// ── COMPONENTES INTERNOS ────────────────────────────────

interface Campo {
  key: string
  label: string
  type: 'text' | 'color' | 'number'
  required?: boolean
  placeholder?: string
}

interface CatalogoTablaProps {
  titulo: string
  descripcion: string
  items: any[]
  campos: Campo[]
  tabla: string
  onGuardar: (tabla: string, data: any) => void
  onEliminar: (tabla: string, id: number) => void
  editando: any
  setEditando: (v: any) => void
  nuevo: any
  setNuevo: (v: any) => void
}

function CatalogoTabla({ titulo, descripcion, items, campos, tabla, onGuardar, onEliminar, editando, setEditando, nuevo, setNuevo }: CatalogoTablaProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">{titulo}</h3>
          <p className="text-slate-500 text-xs mt-0.5">{descripcion}</p>
        </div>
        <button onClick={() => setNuevo({})}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
          <Plus size={14} /> Agregar
        </button>
      </div>

      {/* Fila nueva */}
      {nuevo && (
        <FilaEdicion
          data={nuevo}
          campos={campos}
          onChange={setNuevo}
          onGuardar={() => onGuardar(tabla, nuevo)}
          onCancelar={() => setNuevo(null)}
        />
      )}

      <div className="space-y-2">
        {items.length === 0 && !nuevo && (
          <p className="text-slate-500 text-sm text-center py-6">Sin registros. Agrega el primero.</p>
        )}
        {items.map(item => (
          editando?.id === item.id ? (
            <FilaEdicion key={item.id}
              data={editando}
              campos={campos}
              onChange={setEditando}
              onGuardar={() => onGuardar(tabla, editando)}
              onCancelar={() => setEditando(null)}
            />
          ) : (
            <div key={item.id} className="flex items-center justify-between bg-slate-900 px-3 py-2.5 rounded-lg">
              <div className="flex items-center gap-3 flex-1">
                {campos.find(c => c.type === 'color') && (
                  <div className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0"
                    style={{ backgroundColor: item[campos.find(c => c.type === 'color')!.key] }} />
                )}
                <div className="flex gap-4 flex-1">
                  {campos.filter(c => c.type !== 'color').map(c => (
                    <span key={c.key} className="text-sm">
                      <span className="text-slate-500 text-xs">{c.label}: </span>
                      <span className={c.key === campos[0].key ? 'text-white font-medium' : 'text-slate-300'}>
                        {c.type === 'number' && c.key === 'tasa_a_cop'
                          ? Number(item[c.key]).toLocaleString('es-CO')
                          : item[c.key] || '—'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <button onClick={() => setEditando({ ...item })}
                  className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors rounded">
                  <Pencil size={13} />
                </button>
                <button onClick={() => onEliminar(tabla, item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </Card>
  )
}

interface FilaEdicionProps {
  data: any
  campos: Campo[]
  onChange: (v: any) => void
  onGuardar: () => void
  onCancelar: () => void
}

function FilaEdicion({ data, campos, onChange, onGuardar, onCancelar }: FilaEdicionProps) {
  const valido = campos.filter(c => c.required).every(c => data[c.key])
  return (
    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-2 rounded-lg mb-2">
      {campos.map(c => (
        <div key={c.key} className={c.type === 'color' ? 'flex-shrink-0' : 'flex-1'}>
          {c.type === 'color' ? (
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs">{c.label}</label>
              <input type="color" value={data[c.key] || '#6366f1'}
                onChange={e => onChange({ ...data, [c.key]: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0" />
            </div>
          ) : (
            <input
              type={c.type}
              placeholder={c.placeholder || c.label}
              value={data[c.key] || ''}
              onChange={e => onChange({ ...data, [c.key]: c.type === 'number' ? Number(e.target.value) : e.target.value })}
              className="text-sm py-1.5"
            />
          )}
        </div>
      ))}
      <button onClick={onGuardar} disabled={!valido}
        className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors disabled:opacity-40 flex-shrink-0">
        <Check size={15} />
      </button>
      <button onClick={onCancelar}
        className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors flex-shrink-0">
        <X size={15} />
      </button>
    </div>
  )
}