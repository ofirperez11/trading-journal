/** App logo mark — a clean Action-Blue tile with a white trend line. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect width="64" height="64" rx="15" fill="#37352f" />
      <polyline
        points="14,42 26,30 36,38 50,18"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="18" r="3.5" fill="#ffffff" />
    </svg>
  )
}

export function LogoWordmark({ size = 30 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="text-[15px] font-bold text-ink">
        Trading&nbsp;Journal
      </span>
    </div>
  )
}
