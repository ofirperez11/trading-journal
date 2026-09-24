import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Page header: a coloured page icon, a bold title and a muted subtitle. */
export function PageTitle({
  icon: Icon,
  color,
  title,
  subtitle,
  actions,
}: {
  icon: LucideIcon
  color: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="block-in flex flex-wrap items-end justify-between gap-4">
      <div>
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-bg shadow-[0_0_0_1px_#ededeb,0_4px_12px_-6px_rgba(15,15,15,.2)]"
          style={{ color }}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}
