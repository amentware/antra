import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Pill } from '../components/Card'
import { Button, IconButton } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { api, type ApiTokenRow } from '../lib/api'
import { toast } from '../store/useToastStore'
import { formatDateTime } from '../lib/date'
import { CopyIcon, KeyIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { Sheet } from '../components/Sheet'

export function TokensScreen() {
  const navigate = useNavigate()

  const [tokens, setTokens] = useState<ApiTokenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('Shortcuts')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      const res = await api.listTokens()
      setTokens(res.tokens)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load tokens', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    setBusy(true)
    try {
      const res = await api.createToken(name)
      setTokens((prev) => [res.token, ...prev])
      setNewToken(res.plaintext)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create token', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setBusy(true)
    try {
      await api.revokeToken(id)
      setTokens((prev) => prev.filter((t) => t.id !== id))
      toast('Token revoked', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not revoke token', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+96px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <ScreenHeader
          title="API tokens"
          subtitle="For Apple Shortcuts"
          onBack={() => navigate(-1)}
          right={
            <IconButton label="Create token" onClick={() => setCreateOpen(true)}>
              <PlusIcon size={20} />
            </IconButton>
          }
        />
      </div>

      <div className="px-4">
        <p className="px-1 py-2 text-[13px] text-muted">
          Tokens let Apple Shortcuts add expenses directly to Antra without signing in. Treat them like passwords — revoke unused tokens.
        </p>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-4 text-[13px] text-muted">Loading...</div>
          ) : tokens.length === 0 ? (
            <div className="p-4 text-[13px] text-muted">No tokens yet.</div>
          ) : (
            <div className="divide-y divide-hairline/60">
              {tokens.map((token) => (
                <div key={token.id} className="flex items-start gap-3 p-4">
                  <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-link">
                    <KeyIcon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-ink">{token.name}</span>
                      {token.revoked_at ? <Pill tone="neutral">Revoked</Pill> : null}
                      {!token.last_used_at && !token.revoked_at ? <Pill tone="positive">New</Pill> : null}
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      Prefix: {token.prefix}... · Created {formatDateTime(token.created_at)}
                      {token.last_used_at ? ` · Last used ${formatDateTime(token.last_used_at)}` : ''}
                    </div>
                    {!token.revoked_at ? (
                      <button
                        type="button"
                        onClick={() => void revoke(token.id)}
                        className="pressable mt-2 flex items-center gap-1 text-[13px] font-medium text-danger"
                      >
                        <TrashIcon size={14} /> Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)}>
        <div className="px-5 pb-2 pt-1">
          <h2 className="text-[17px] font-semibold text-ink">Create API token</h2>
          <p className="mt-1 text-[14px] text-muted">Name it so you remember where it's used.</p>
        </div>
        <div className="px-5 pb-6">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Shortcuts"
            className="h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none"
          />
          <Button block size="lg" className="mt-4" disabled={busy} onClick={() => void create()}>
            Generate token
          </Button>
        </div>
      </Sheet>

      <Sheet open={Boolean(newToken)} onClose={() => setNewToken(null)}>
        <div className="px-5 pb-2 pt-1">
          <h2 className="text-[17px] font-semibold text-ink">Your token</h2>
          <p className="mt-1 text-[14px] text-muted">Copy this now — it won't be shown again.</p>
        </div>
        <div className="px-5 pb-6">
          <div className="rounded-2xl bg-surface-2 px-4 py-3 text-[14px] font-mono tabular text-ink break-all" data-selectable>
            {newToken}
          </div>
          <Button
            block
            size="lg"
            className="mt-4"
            onClick={() => {
              void navigator.clipboard.writeText(newToken ?? '')
              toast('Copied to clipboard', 'success')
            }}
          >
            <CopyIcon size={16} /> Copy token
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
