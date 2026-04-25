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
    set({ categorias, entidades, monedas, perfilesRiesgo, tiposInversion })
  },
}))