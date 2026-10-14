import { cn } from '../lib/cn'

/** The Antra "A" mark as an inline SVG (matches the generated PNG icons). */
export function Logo({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Antra"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="antra-logo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B67F0" />
          <stop offset="1" stopColor="#1546D9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#antra-logo)" />
      <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round">
        <path d="M32 14 L16 52" />
        <path d="M32 14 L48 52" />
        <path d="M22 40 H42" />
      </g>
    </svg>
  )
}

export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Logo size={size === 'sm' ? 26 : 34} />
      <span className={cn('font-semibold tracking-tight text-ink', size === 'sm' ? 'text-[17px]' : 'text-[22px]')}>Antra</span>
    </div>
  )
}
