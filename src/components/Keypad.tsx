import { useCallback, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { haptic } from '../lib/haptics'
import { evaluateExpression } from '@shared/money'
import { appendKey, balancedExpression, containsOperator, displayMinor, isInvalidExpression } from '../lib/expression'
import { AmountText } from './AmountText'

// Re-exported so existing call sites keep importing from this component module.
export { appendKey, containsOperator, currentTerm, expressionToMinor } from '../lib/expression'

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

interface AmountDisplayProps {
  expression: string
  currency: string
  className?: string
}

/** Live, currency-formatted amount that animates as digits are entered. */
export function AmountDisplay({ expression, currency, className }: AmountDisplayProps) {
  const minor = displayMinor(expression, currency)
  const showExpression = containsOperator(expression) && expression.trim().length > 0
  const invalid = isInvalidExpression(expression)
  const complete = evaluateExpression(expression) !== null

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="h-5 text-[13px] font-medium tabular text-muted">
        <AnimatePresence mode="popLayout" initial={false}>
          {showExpression ? (
            <motion.span
              key={expression}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn('inline-flex items-center gap-1', invalid && 'text-danger')}
            >
              {expression.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−')}
              {complete ? <span className="text-faint">=</span> : null}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <AmountText
        minor={minor}
        currency={currency}
        animate
        className={cn('text-display-lg text-ink', invalid && 'text-danger/70')}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

interface KeyProps {
  label: ReactNode
  onPress: () => void
  variant?: 'digit' | 'operator' | 'muted'
  className?: string
  ariaLabel?: string
  onLongPress?: () => void
}

function Key({ label, onPress, variant = 'digit', className, ariaLabel, onLongPress }: KeyProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longFired = useRef(false)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const start = () => {
    longFired.current = false
    if (!onLongPress) return
    timer.current = setTimeout(() => {
      longFired.current = true
      haptic([10, 30, 10])
      onLongPress()
    }, 480)
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'pressable flex h-[54px] select-none items-center justify-center rounded-2xl text-[24px] font-semibold leading-none',
        variant === 'digit' && 'bg-surface text-ink shadow-card ring-1 ring-hairline/60',
        variant === 'operator' && 'bg-accent/10 text-accent font-bold',
        variant === 'muted' && 'bg-surface-2 text-muted',
        className,
      )}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onClick={() => {
        if (longFired.current) {
          longFired.current = false
          return
        }
        haptic(6)
        onPress()
      }}
    >
      {label}
    </button>
  )
}

const BackspaceIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.6 5.6h10.2A1.2 1.2 0 0 1 20 6.8v10.4a1.2 1.2 0 0 1-1.2 1.2H8.6L3.4 12z" />
    <path d="m11.6 9.4 5 5.2M16.6 9.4l-5 5.2" />
  </svg>
)

// ---------------------------------------------------------------------------
// Amount keypad
// ---------------------------------------------------------------------------

interface KeypadGridProps {
  expression: string
  onExpressionChange: (expression: string) => void
  onSave: () => void
  saveLabel?: string
  saveDisabled?: boolean
  className?: string
  /** Secondary action shown under the grid. */
  footerSecondary?: ReactNode
  /** Bottom safe-area padding for sheets. */
  safePadding?: boolean
}

/** The 1-9/./0 keypad with calculator operators, `=` and the Save button. */
export function KeypadGrid({
  expression,
  onExpressionChange,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
  className,
  footerSecondary,
  safePadding = true,
}: KeypadGridProps) {
  const press = useCallback((key: string) => onExpressionChange(appendKey(expression, key)), [expression, onExpressionChange])

  const equals = () => {
    const result = evaluateExpression(balancedExpression(expression))
    if (result === null || !Number.isFinite(result)) return
    const rounded = Math.round(result * 100) / 100
    onExpressionChange(String(rounded).replace(/\.0+$/, ''))
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="grid grid-cols-4 gap-2 px-4 pt-3">
        <Key label="7" onPress={() => press('7')} />
        <Key label="8" onPress={() => press('8')} />
        <Key label="9" onPress={() => press('9')} />
        <Key label="÷" variant="operator" onPress={() => press('÷')} ariaLabel="Divide" />

        <Key label="4" onPress={() => press('4')} />
        <Key label="5" onPress={() => press('5')} />
        <Key label="6" onPress={() => press('6')} />
        <Key label="×" variant="operator" onPress={() => press('×')} ariaLabel="Multiply" />

        <Key label="1" onPress={() => press('1')} />
        <Key label="2" onPress={() => press('2')} />
        <Key label="3" onPress={() => press('3')} />
        <Key label="−" variant="operator" onPress={() => press('−')} ariaLabel="Subtract" />

        <Key label="." onPress={() => press('.')} ariaLabel="Decimal point" />
        <Key label="0" onPress={() => press('0')} />
        <Key
          label={<BackspaceIcon />}
          variant="muted"
          onPress={() => press('⌫')}
          onLongPress={() => onExpressionChange('')}
          ariaLabel="Backspace, long press to clear"
        />
        <Key label="+" variant="operator" onPress={() => press('+')} ariaLabel="Add" />

        <button
          type="button"
          onClick={() => {
            haptic(10)
            onSave()
          }}
          disabled={saveDisabled}
          className={cn(
            'pressable col-span-3 mt-1 flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-white shadow-float',
            'disabled:opacity-40 disabled:pointer-events-none',
          )}
        >
          {saveLabel}
        </button>
        <Key label="=" variant="operator" onPress={equals} ariaLabel="Equals" className="mt-1 h-[52px]" />
      </div>

      {footerSecondary ? <div className="px-4 pt-3">{footerSecondary}</div> : null}
      {safePadding ? <div className="h-[calc(var(--safe-bottom)+12px)]" /> : null}
    </div>
  )
}

interface AmountKeypadProps {
  expression: string
  onExpressionChange: (expression: string) => void
  currency: string
  onSave: () => void
  saveLabel?: string
  saveDisabled?: boolean
  className?: string
  /** Rendered above the keys (category/account pickers etc.). */
  header?: ReactNode
  /** Secondary action shown next to Save. */
  footerSecondary?: ReactNode
}

/**
 * Custom numeric keypad with calculator operators. The native keyboard is never
 * shown for amounts — the display is read-only.
 */
export function AmountKeypad({
  expression,
  onExpressionChange,
  currency,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
  className,
  header,
  footerSecondary,
}: AmountKeypadProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {header}
      <div className="px-5 pt-2">
        <AmountDisplay expression={expression} currency={currency} />
      </div>
      <KeypadGrid
        expression={expression}
        onExpressionChange={onExpressionChange}
        onSave={onSave}
        saveLabel={saveLabel}
        saveDisabled={saveDisabled}
        footerSecondary={footerSecondary}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// PIN keypad (no operators) — used by the app lock and login PIN
// ---------------------------------------------------------------------------

interface PinKeypadProps {
  onKey: (key: string) => void
  className?: string
  disabled?: boolean
}

export function PinKeypad({ onKey, className, disabled }: PinKeypadProps) {
  const press = (key: string) => {
    haptic(6)
    onKey(key)
  }
  return (
    <div className={cn('grid grid-cols-3 gap-3', className)}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <Key key={digit} label={digit} onPress={() => press(digit)} className="h-[62px] rounded-full" />
      ))}
      <span />
      <Key label="0" onPress={() => press('0')} className="h-[62px] rounded-full" />
      <Key
        label={<BackspaceIcon />}
        variant="muted"
        onPress={() => press('⌫')}
        ariaLabel="Backspace"
        className="h-[62px] rounded-full"
      />
      {disabled ? <span className="col-span-3 h-0" /> : null}
    </div>
  )
}
