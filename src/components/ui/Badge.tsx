interface BadgeProps {
  label: string
  color?: string
  size?: 'sm' | 'md'
}

export function Badge({ label, color = '#6366f1', size = 'sm' }: BadgeProps) {
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${padding}`}
      style={{
        backgroundColor: `${color}22`,
        color: color,
        border: `1px solid ${color}44`
      }}
    >
      {label}
    </span>
  )
}