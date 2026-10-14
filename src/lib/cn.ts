import clsx, { type ClassValue } from 'clsx'

/** Conditional class names. Kept tiny — no tailwind-merge to stay lean. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
