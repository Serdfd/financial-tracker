import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { CierreMensual } from './pages/CierreMensual'
import { Inversiones } from './pages/Inversiones'
import { Presupuesto } from './pages/Presupuesto'
import { Analisis } from './pages/Analisis'
import { Configuracion } from './pages/Configuracion'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const cargarCatalogos = useAppStore(s => s.cargarCatalogos)

  useEffect(() => {
    cargarCatalogos()
  }, [])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/"              element={<Dashboard />}     />
        <Route path="/cierre"        element={<CierreMensual />} />
        <Route path="/inversiones"   element={<Inversiones />}   />
        <Route path="/presupuesto"   element={<Presupuesto />}   />
        <Route path="/analisis"      element={<Analisis />}      />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  )
}