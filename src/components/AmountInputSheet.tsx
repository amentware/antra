import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { AmountKeypad, expressionToMinor } from './Keypad'
import { IconButton } from './Buttons'
import { CloseIcon } from './Icons'
import { minorToMajor } from '@shared/money'

interface AmountInputSheetProps {
  open: boolean
  onClose: () => void
  title: string
  currency: string
  valueMinor: number | null
  onConfirm: (minor: number | null) => void
  /** Allow a zero/empty value to mean "clear". */
  allowClear?: boolean
  confirmLabel?: string
}

/**
 * A keypad-backed amount editor used anywhere a money value is set from a
 * screen that is not the main add-expense flow (credit limits, budgets, …).
 * The custom keypad means the native keyboard never appears for amounts.
 */
export function AmountInputSheet({
  open,
  onClose,
  title,
  currency,
  valueMinor,
  onConfirm,
  allowClear,
  confirmLabel = 'Done',
}: AmountInputSheetProps) {
  const [expression, setExpression] = useState('')

  useEffect(() => {
    if (!open) return
    setExpression(valueMinor && valueMinor > 0 ? String(minorToMajor(valueMinor, currency)).replace(/\.0+$/, '') : '')
  }, [open, valueMinor, currency])

  const minor = expressionToMinor(expression, currency)

  return (
    <Sheet open={open} onClose={onClose} fullHeight>
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <IconButton label="Close" variant="ghost" onClick={onClose}>
          <CloseIcon size={20} />
        </IconButton>
        <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
        <IconButton
          label={confirmLabel}
          variant="ghost"
          className="text-link"
          onClick={() => {
            if (allowClear && (!expression.trim() || minor === 0)) {
              onConfirm(null)
              onClose()
              return
            }
            if (minor !== null && minor > 0) {
              onConfirm(minor)
              onClose()
            }
          }}
        >
          {confirmLabel}
        </IconButton>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end">
        <AmountKeypad
          expression={expression}
          onExpressionChange={setExpression}
          currency={currency}
          saveLabel={confirmLabel}
          saveDisabled={minor === null || minor <= 0}
          onSave={() => {
            if (minor !== null && minor > 0) {
              onConfirm(minor)
              onClose()
            }
          }}
          className="pb-1"
        />
      </div>
    </Sheet>
  )
}
