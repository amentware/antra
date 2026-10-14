import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Button, IconButton } from './Buttons'
import { CloseIcon } from './Icons'
import { cn } from '../lib/cn'
import { CATEGORY_EMOJI_CHOICES, CATEGORY_PALETTE } from '@shared/categories'

export interface CategoryFormValues {
  name: string
  emoji: string
  color: string
}

interface CategoryFormSheetProps {
  open: boolean
  onClose: () => void
  values?: CategoryFormValues | null
  onSubmit: (values: CategoryFormValues) => Promise<void> | void
}

export function CategoryFormSheet({ open, onClose, values, onSubmit }: CategoryFormSheetProps) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [color, setColor] = useState(CATEGORY_PALETTE[5])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (values) {
      setName(values.name)
      setEmoji(values.emoji || '📦')
      setColor(values.color)
    } else {
      setName('')
      setEmoji('📦')
      setColor(CATEGORY_PALETTE[5])
    }
  }, [open, values])

  const canSave = name.trim().length > 0

  const handleSubmit = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), emoji, color })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <IconButton label="Close" variant="ghost" onClick={onClose}>
          <CloseIcon size={20} />
        </IconButton>
        <h2 className="text-[16px] font-semibold text-ink">{values ? 'Edit category' : 'New category'}</h2>
        <span className="min-w-[44px]" />
      </div>

      <div className="px-4 pb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Name</div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Groceries"
          autoComplete="off"
          className="mt-2 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none placeholder:text-faint"
        />

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Icon</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_EMOJI_CHOICES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setEmoji(candidate)}
                className={cn(
                  'pressable flex h-11 w-11 items-center justify-center rounded-2xl text-[22px]',
                  emoji === candidate ? 'bg-ink/10 ring-2 ring-ink' : 'bg-surface-2',
                )}
              >
                {candidate}
              </button>
            ))}
            <input
              value={emoji}
              onChange={(event) => setEmoji(event.target.value.trim().slice(0, 2) || emoji)}
              placeholder="🧾"
              aria-label="Custom emoji"
              className="h-11 w-16 rounded-2xl bg-surface-2 px-2 text-center text-[20px] text-ink outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Colour</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                style={{ backgroundColor: swatch }}
                className={cn('pressable h-10 w-10 rounded-full', color === swatch && 'ring-2 ring-ink ring-offset-2 ring-offset-canvas')}
              />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <Button block size="lg" disabled={!canSave || busy} onClick={() => void handleSubmit()}>
            {values ? 'Save changes' : 'Add category'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
