import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-slate-800 border border-slate-700 rounded-xl p-4 ${onClick ? 'cursor-pointer hover:border-indigo-500 transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface MetricCardProps {
  titulo: string
  valor: string
  subtitulo?: string
  icono: ReactNode
  variacion?: number
  colorIcono?: string
}

export function MetricCard({ titulo, valor, subtitulo, icono, variacion, colorIcono = 'text-indigo-400' }: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-sm font-medium">{titulo}</p>
          <p className="text-white text-2xl font-mono font-bold mt-1">{valor}</p>
          {subtitulo && <p className="text-slate-500 text-xs mt-1">{subtitulo}</p>}
          {variacion !== undefined && (
            <p className={`text-xs mt-1 font-medium ${variacion >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}% vs mes anterior
            </p>
          )}
        </div>
        <div className={`${colorIcono} bg-slate-700 p-2 rounded-lg`}>
          {icono}
        </div>
      </div>
    </Card>
  )
}