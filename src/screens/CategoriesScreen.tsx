import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tile } from '../components/Card'
import { Button, IconButton } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { Sheet } from '../components/Sheet'
import { CategoryFormSheet, type CategoryFormValues } from '../components/CategoryFormSheet'
import { MoreIcon, MoveDownIcon, MoveUpIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { useCategories, useExpenses } from '../hooks/useData'
import { createCategory, deleteCategory, reorderCategories, updateCategory } from '../lib/repo'
import { toast } from '../store/useToastStore'

export function CategoriesScreen() {
  const navigate = useNavigate()
  const categories = useCategories()
  const expenses = useExpenses()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; values: CategoryFormValues } | null>(null)
  const [reassignOpen, setReassignOpen] = useState<{ id: string; usage: number; candidates: Array<{ id: string; name: string }> } | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const usageMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of expenses) {
      map.set(expense.category_id, (map.get(expense.category_id) ?? 0) + 1)
    }
    return map
  }, [expenses])

  const handleCreate = async (values: CategoryFormValues) => {
    await createCategory(values)
    toast('Category added', 'success')
  }

  const handleUpdate = async (id: string, values: CategoryFormValues) => {
    await updateCategory(id, values)
    toast('Category updated', 'success')
  }

  const requestDelete = (id: string) => {
    const usage = usageMap.get(id) ?? 0
    if (usage === 0) {
      void deleteCategory(id)
      toast('Category removed', 'default')
      return
    }
    const candidates = categories.filter((c) => c.id !== id).map((c) => ({ id: c.id, name: c.name }))
    setReassignOpen({ id, usage, candidates })
  }

  const confirmReassign = async (reassignToId: string | undefined) => {
    if (!reassignOpen) return
    const { reassigned } = await deleteCategory(reassignOpen.id, reassignToId)
    setReassignOpen(null)
    toast(`Category removed · ${reassigned} expense${reassigned === 1 ? '' : 's'} reassigned`, 'default')
  }

  const move = (id: string, direction: -1 | 1) => {
    const order = categories.map((c) => c.id)
    const from = order.indexOf(id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= order.length) return
    ;[order[from], order[to]] = [order[to], order[from]]
    void reorderCategories(order)
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+96px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <ScreenHeader
          title="Categories"
          onBack={() => navigate(-1)}
          right={
            <IconButton label="Add category" onClick={() => setFormOpen(true)}>
              <PlusIcon size={20} />
            </IconButton>
          }
        />
      </div>

      <div className="px-4">
        <Card className="divide-y divide-hairline/60">
          {categories.map((category) => {
            const usage = usageMap.get(category.id) ?? 0
            return (
              <div key={category.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing({ id: category.id, values: { name: category.name, emoji: category.emoji, color: category.color } })}
                  className="pressable flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
                >
                  <Tile emoji={category.emoji} color={category.color} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ink">{category.name}</div>
                    <div className="text-[12px] text-muted">{usage} transaction{usage === 1 ? '' : 's'}</div>
                  </div>
                </button>
                <IconButton label="More" variant="ghost" onClick={() => setActionId(actionId === category.id ? null : category.id)}>
                  <MoreIcon size={18} />
                </IconButton>
              </div>
            )
          })}
        </Card>
      </div>

      <Sheet open={Boolean(actionId)} onClose={() => setActionId(null)}>
        <div className="px-4 pb-4 pt-1">
          <h2 className="text-[16px] font-semibold text-ink">Category options</h2>
        </div>
        {actionId && (
          <div className="px-4 pb-6">
            <button
              type="button"
              onClick={() => {
                const category = categories.find((c) => c.id === actionId)
                if (category) setEditing({ id: category.id, values: { name: category.name, emoji: category.emoji, color: category.color } })
                setActionId(null)
              }}
              className="pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                move(actionId, -1)
              }}
              className="pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-ink"
            >
              <MoveUpIcon size={18} /> Move up
            </button>
            <button
              type="button"
              onClick={() => {
                move(actionId, 1)
              }}
              className="pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-ink"
            >
              <MoveDownIcon size={18} /> Move down
            </button>
            <button
              type="button"
              onClick={() => {
                requestDelete(actionId)
                setActionId(null)
              }}
              className="pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-danger"
            >
              <TrashIcon size={18} /> Delete
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(reassignOpen)} onClose={() => setReassignOpen(null)}>
        <div className="px-5 pb-2 pt-1">
          <h2 className="text-[17px] font-semibold text-ink">Reassign transactions?</h2>
          {reassignOpen && (
            <p className="mt-1 text-[14px] text-muted">
              This category has {reassignOpen.usage} transaction{reassignOpen.usage === 1 ? '' : 's'}. Reassign them to another category before deleting.
            </p>
          )}
        </div>
        <div className="scroll-y max-h-[40vh] px-5 pb-4">
          {reassignOpen?.candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => void confirmReassign(candidate.id)}
              className="pressable flex w-full items-center justify-between border-b border-hairline/60 py-3.5 text-left last:border-0"
            >
              <span className="text-[15px] font-medium text-ink">{candidate.name}</span>
            </button>
          ))}
          {reassignOpen && reassignOpen.candidates.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">No other categories available.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 px-5 pb-6">
          <Button block variant="secondary" size="lg" onClick={() => void confirmReassign(undefined)}>
            Delete anyway
          </Button>
          <Button block size="lg" onClick={() => setReassignOpen(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <CategoryFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
      <CategoryFormSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        values={editing?.values}
        onSubmit={async (values) => {
          if (editing) await handleUpdate(editing.id, values)
        }}
      />
    </div>
  )
}
