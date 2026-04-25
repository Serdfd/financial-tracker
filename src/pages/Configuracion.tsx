import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'
import { Categoria, Entidad, Moneda, PerfilRiesgo, TipoInversion } from '@/types'

type TabConfig = 'entidades' | 'tipos' | 'riesgos' | 'categorias' | 'monedas'

export function Configuracion() {
  const { cargarCatalogos } = useAppStore()
  const [tab, setTab] = useState<TabConfig>('entidades')
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [tipos, setTipos] = useState<TipoInversion[]>([])
  const [riesgos, setRiesgos] = useState<PerfilRiesgo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [subTabCat, setSubTabCat] = useState<'ingreso' | 'gasto'>('ingreso')

  // Edición inline
  const [editando, setEditando] = useState<any>(null)
  const [nuevo, setNuevo] = useState<any>(null)

  useEffect(() => { cargar() }, [tab])

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

  const tabs: { key: TabConfig; label: string }[] = [
    { key: 'entidades', label: 'Entidades' },
    { key: 'tipos', label: 'Tipos de Inversión' },
    { key: 'riesgos', label: 'Perfiles de Riesgo' },
    { key: 'categorias', label: 'Categorías' },
    { key: 'monedas', label: 'Monedas' },
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
              onClick={() => setNuevo({ tipo: subTabCat, color: '#6366f1' })}
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
            <FilaEdicion
              data={nuevo}
              campos={[
                { key: 'nombre', label: 'Nombre', type: 'text', required: true },
                { key: 'color', label: 'Color', type: 'color' },
              ]}
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
                <FilaEdicion key={c.id}
                  data={editando}
                  campos={[
                    { key: 'nombre', label: 'Nombre', type: 'text', required: true },
                    { key: 'color', label: 'Color', type: 'color' },
                  ]}
                  onChange={setEditando}
                  onGuardar={() => guardar('categorias', editando)}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <div key={c.id} className="flex items-center justify-between bg-slate-900 px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-3">
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
        <CatalogoTabla
          titulo="Monedas"
          descripcion="Monedas disponibles para registrar movimientos e inversiones"
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
      )}
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