import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tile } from '../components/Card'
import { IconButton } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { AccountFormSheet, type AccountFormValues } from '../components/AccountFormSheet'
import { EditIcon, PlusIcon } from '../components/Icons'
import { useAccounts } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { createAccount, setAccountArchived, updateAccount } from '../lib/repo'
import { toast } from '../store/useToastStore'

export function ManageAccountsScreen() {
  const navigate = useNavigate()
  const preferences = usePreferences()
  const accounts = useAccounts({ includeArchived: true })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AccountFormValues & { id?: string } | null>(null)

  const active = useMemo(() => accounts.filter((a) => a.archived === 0), [accounts])
  const archived = useMemo(() => accounts.filter((a) => a.archived === 1), [accounts])

  const handleCreate = async (values: AccountFormValues) => {
    await createAccount(values)
    toast('Account added', 'success')
  }

  const handleEdit = async (id: string, values: AccountFormValues) => {
    await updateAccount(id, values)
    toast('Account updated', 'success')
  }

  const toggleArchived = async (id: string, archived: boolean) => {
    await setAccountArchived(id, archived)
    toast(archived ? 'Account archived' : 'Account restored', 'success')
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+96px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <ScreenHeader
          title="Manage accounts"
          onBack={() => navigate(-1)}
          right={
            <IconButton label="Add account" onClick={() => setFormOpen(true)}>
              <PlusIcon size={20} />
            </IconButton>
          }
        />
      </div>

      <div className="px-4">
        <Card className="divide-y divide-hairline/60">
          {active.map((account) => (
            <div key={account.id} className="flex items-center gap-3 px-4 py-3">
              <Tile emoji={account.icon} color={account.color} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-ink">{account.name}</div>
                <div className="text-[12px] text-muted">{account.type === 'credit_card' ? 'Credit card' : 'Bank account'}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditing({ id: account.id, name: account.name, type: account.type, last4: account.last4 ?? '', color: account.color, icon: account.icon, credit_limit_minor: account.credit_limit_minor, statement_day: account.statement_day, due_day: account.due_day })}
                className="pressable rounded-full bg-surface-2 p-2.5 text-muted"
              >
                <EditIcon size={16} />
              </button>
            </div>
          ))}
        </Card>

        {archived.length > 0 ? (
          <div className="mt-4">
            <h2 className="px-1 pb-2 text-[16px] font-semibold text-ink">Archived</h2>
            <Card className="divide-y divide-hairline/60">
              {archived.map((account) => (
                <div key={account.id} className="flex items-center gap-3 px-4 py-3">
                  <Tile emoji={account.icon} color={account.color} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ink">{account.name}</div>
                    <div className="text-[12px] text-muted">Archived</div>
                  </div>
                  <button type="button" onClick={() => void toggleArchived(account.id, false)} className="pressable text-[13px] font-semibold text-link">
                    Restore
                  </button>
                </div>
              ))}
            </Card>
          </div>
        ) : null}
      </div>

      <AccountFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        currency={preferences.currency}
        onSubmit={handleCreate}
      />
      <AccountFormSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        currency={preferences.currency}
        account={editing?.id ? accounts.find((a) => a.id === editing.id) : null}
        onSubmit={async (values) => {
          if (editing?.id) await handleEdit(editing.id, values)
        }}
      />
    </div>
  )
}
