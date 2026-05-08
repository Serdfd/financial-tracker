import { create } from 'zustand'
import { Categoria, Entidad, Moneda, PerfilRiesgo, TipoInversion } from '@/types'

interface AppStore {
  // Mes activo en la app
  mesActivo: number
  anioActivo: number
  setMesActivo: (mes: number, anio: number) => void

  // Catálogos cargados globalmente
  categorias: Categoria[]
  entidades: Entidad[]
  monedas: Moneda[]
  perfilesRiesgo: PerfilRiesgo[]
  tiposInversion: TipoInversion[]

  // Cargar catálogos
  cargarCatalogos: () => Promise<void>
}

const hoy = new Date()

// Orden fijo para perfiles de riesgo
const ORDEN_RIESGO: Record<string, number> = { 'Bajo': 1, 'Moderado': 2, 'Alto': 3 }

export const useAppStore = create<AppStore>((set) => ({
  mesActivo: hoy.getMonth() + 1,
  anioActivo: hoy.getFullYear(),

  setMesActivo: (mes, anio) => set({ mesActivo: mes, anioActivo: anio }),

  categorias: [],
  entidades: [],
  monedas: [],
  perfilesRiesgo: [],
  tiposInversion: [],

  cargarCatalogos: async () => {
    const [categorias, entidades, monedas, perfilesRiesgo, tiposInversion] = await Promise.all([
      window.electronAPI.getCatalogo('categorias'),
      window.electronAPI.getCatalogo('entidades'),
      window.electronAPI.getCatalogo('monedas'),
      window.electronAPI.getCatalogo('perfiles_riesgo'),
      window.electronAPI.getCatalogo('tipos_inversion'),
    ])

    // Mejora 4: Ordenar alfabéticamente (excepto riesgo → Bajo, Moderado, Alto)
    const sortAlpha = (a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es')
    const sortRiesgo = (a: any, b: any) => (ORDEN_RIESGO[a.nombre] || 99) - (ORDEN_RIESGO[b.nombre] || 99)

    set({
      categorias: [...categorias].sort(sortAlpha),
      entidades: [...entidades].sort(sortAlpha),
      monedas: [...monedas].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')),
      perfilesRiesgo: [...perfilesRiesgo].sort(sortRiesgo),
      tiposInversion: [...tiposInversion].sort(sortAlpha),
    })
  },
}))