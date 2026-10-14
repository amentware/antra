import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

/**
 * Phone-only shell. On screens wider than 480px the app is centred inside a
 * phone-width column so it never looks like a web page.
 */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-[100dvh] w-full bg-[#DCDAD1] dark:bg-black flex justify-center">
      <div
        className={cn(
          'relative w-full max-w-[430px] bg-canvas overflow-hidden',
          'min-[481px]:my-4 min-[481px]:h-[calc(100dvh-2rem)] min-[481px]:rounded-[44px] min-[481px]:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] min-[481px]:ring-1 min-[481px]:ring-black/5',
          'h-[100dvh]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
