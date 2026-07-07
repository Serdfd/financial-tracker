import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CalendarCheck, TrendingUp,
  Wallet, BarChart3, Settings, List, PiggyBank
} from 'lucide-react'

const links = [
  { to: '/',               icon: LayoutDashboard, label: 'Dashboard'        },
  { to: '/analisis',       icon: BarChart3,       label: 'Análisis'         },
  { to: '/cierre',         icon: CalendarCheck,   label: 'Cierre Mensual'   },
  { to: '/inversiones',    icon: TrendingUp,      label: 'Inversiones'      },
  { to: '/metas',          icon: PiggyBank,       label: 'Metas de Ahorro'  },
  { to: '/presupuesto',    icon: Wallet,          label: 'Presupuesto'      },
  { to: '/transacciones',  icon: List,            label: 'Transacciones'    },
  { to: '/configuracion',  icon: Settings,        label: 'Configuración'    },
]

export function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Financial</p>
            <p className="text-slate-400 text-xs">Tracker</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-slate-600 text-xs text-center">v1.0.0</p>
      </div>
    </aside>
  )
}