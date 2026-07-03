/** App logo mark — an amber phosphor trend line on a graphite tile. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC661" />
          <stop offset="1" stopColor="#E89227" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#12151B" stroke="#222732" />
      <polyline
        points="14,42 26,30 36,38 50,18"
        fill="none"
        stroke="url(#logoGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="18" r="3.5" fill="#FFC661" />
    </svg>
  )
}

export function LogoWordmark({ size = 30 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-ink">
        Trading&nbsp;Journal
      </span>
    </div>
  )
}
