import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Pill, SectionLabel } from '../components/Card'
import { Button } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { CopyIcon, DownloadIcon, KeyIcon, SparkleIcon } from '../components/Icons'
import { toast } from '../store/useToastStore'
import { cn } from '../lib/cn'

const ENDPOINT = '/api/v1/expenses'

export function ShortcutsScreen() {
  const navigate = useNavigate()
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin))

  const setupPrompt = `Create an Apple Shortcut named "Log Spend" that records an expense in my Antra tracker.

Request:
- Endpoint: ${origin}${ENDPOINT}
- Method: POST
- Headers:
    Authorization: Bearer <YOUR_TOKEN>
    Content-Type: application/json

Steps:
1. Add an "Ask for Input" action of type Number with the prompt "How much did you spend?" and store the result as "Amount".
2. Add "Get Contents of URL": URL ${origin}/api/v1/meta, Method GET, Header Authorization: Bearer <YOUR_TOKEN>.
3. Add "Get Dictionary Value" for the key "name" from the "categories" list in that response — this gives a list of my category names.
4. Add "Choose from List" using that list (take the first 4 items) and store the choice as "Category".
5. Add "Get Contents of URL": URL ${origin}${ENDPOINT}, Method POST, Headers Authorization: Bearer <YOUR_TOKEN> and Content-Type: application/json, Request Body JSON with: amount = Amount, category = Category, create_missing = true.
6. Add "Show Notification" showing the response value "totals.today", titled "Logged".

Finally add the shortcut to Siri with the phrase "Log a spend".

If steps 2-3 are too fiddly, skip them and instead use "Choose from List" with these four hardcoded categories: Food & Dining, Transport, Shopping, Other.

Replace <YOUR_TOKEN> with a token from Antra → Settings → API tokens.`

  const bodyExample = `{
  "amount": 250,
  "category": "Food & Dining",
  "account": "HDFC Credit Card",
  "merchant": "Swiggy",
  "note": "Lunch",
  "paid": true
}`

  const curlExample = `curl -X POST "${origin}${ENDPOINT}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${bodyExample.replace(/\n\s*/g, ' ')}'`

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast(`${label} copied`, 'success')
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+40px)]">
      <div className="pt-safe-3 sticky top-0 z-20 bg-canvas/85 px-4 pb-3 backdrop-blur-xl">
        <ScreenHeader title="Shortcuts setup" subtitle="Add expenses with Siri" onBack={() => navigate(-1)} />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-1">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              <DownloadIcon size={22} />
            </span>
            <div>
              <h1 className="text-[17px] font-semibold text-ink">Log spends without opening the app</h1>
              <p className="text-[13px] text-muted">A two-minute Apple Shortcuts recipe.</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 ring-2 ring-accent/15">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-highlight/20 text-ink">
              <SparkleIcon size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold text-ink">Instant setup prompt</h2>
              <p className="text-[13px] text-muted">Paste this into an AI assistant and it builds the Shortcut for you.</p>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl bg-surface-2">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Prompt</span>
              <button
                type="button"
                onClick={() => copy(setupPrompt, 'Prompt')}
                className="pressable flex items-center gap-1 text-[12px] font-semibold text-link"
              >
                <CopyIcon size={13} /> Copy
              </button>
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap px-4 pb-4 pt-2 text-[12px] leading-relaxed text-ink">
              <code>{setupPrompt}</code>
            </pre>
          </div>

          <div className="mt-3">
            <Button block size="lg" onClick={() => copy(setupPrompt, 'Prompt')}>
              <CopyIcon size={16} /> Copy setup prompt
            </Button>
          </div>
        </Card>

        <Step index={1} title="Create an API token">
          <p className="text-[14px] leading-relaxed text-muted">
            Open{' '}
            <button type="button" onClick={() => navigate('/settings/tokens')} className="font-semibold text-link">
              Settings → API tokens
            </button>{' '}
            and generate a token. Copy it right away — it is shown only once.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-muted">
            <KeyIcon size={16} className="text-accent" />
            Treat the token like a password. Revoke it any time.
          </div>
        </Step>

        <Step index={2} title="Build the request">
          <p className="text-[14px] leading-relaxed text-muted">
            In the Shortcuts app add a <strong className="text-ink">Get Contents of URL</strong> action:
          </p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <Field label="Method" value="POST" />
            <Field label="URL" value={`${origin}${ENDPOINT}`} onCopy={() => copy(`${origin}${ENDPOINT}`, 'URL')} />
            <Field label="Header" value="Authorization: Bearer <YOUR_TOKEN>" mono />
            <Field label="Header" value="Content-Type: application/json" mono />
            <Field label="Request Body" value="JSON" />
          </div>
          <p className="mt-3 text-[13px] text-muted">Send a JSON body with these fields — everything except `amount` is optional:</p>

          <div className="mt-3 overflow-hidden rounded-2xl bg-surface-2">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Request body</span>
              <button type="button" onClick={() => copy(bodyExample, 'Body')} className="pressable flex items-center gap-1 text-[12px] font-semibold text-link">
                <CopyIcon size={13} /> Copy
              </button>
            </div>
            <pre className="overflow-x-auto px-4 pb-4 pt-2 text-[12.5px] leading-relaxed text-ink">
              <code>{bodyExample}</code>
            </pre>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Param name="amount" desc="Major units (e.g. 250 or 250.50). Required." />
            <Param name="category" desc="Name or id. Unknown names fall back to “Other”, or are created when create_missing is true." />
            <Param name="account" desc="Name or id. Defaults to your first active account." />
            <Param name="merchant / note" desc="Optional free text." />
            <Param name="date" desc="Optional ISO date-time; defaults to now." />
            <Param name="paid" desc="Optional boolean. Defaults to false for credit cards and true for bank accounts." />
            <Param name="create_missing" desc="Set true to auto-create unknown categories." />
          </div>
        </Step>

        <Step index={3} title="Try it">
          <p className="text-[14px] leading-relaxed text-muted">
            The response echoes the created expense plus your today and month totals and, if the category has a budget, its live status:
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl bg-surface-2">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Response</span>
              <button type="button" onClick={() => copy(curlExample, 'cURL')} className="pressable flex items-center gap-1 text-[12px] font-semibold text-link">
                <CopyIcon size={13} /> Copy cURL
              </button>
            </div>
            <pre className="overflow-x-auto px-4 pb-4 pt-2 text-[12.5px] leading-relaxed text-ink">
              <code>{`{
  "expense": { "id": "…", "amount": 250, "paid": true, … },
  "totals": { "today": 1240, "month": 18650, "currency": "INR" },
  "budget": { "category": "Food & Dining", "percent_used": 82.4, "status": "warning" }
}`}</code>
            </pre>
          </div>
        </Step>

        <Step index={4} title="Other endpoints">
          <div className="flex flex-col gap-3">
            <Endpoint method="GET" path="/api/v1/meta" desc="Lists your accounts and categories with ids." />
            <Endpoint method="GET" path="/api/v1/expenses?limit=20" desc="Returns your most recent expenses." />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Every public request needs the <span className="font-medium text-ink">Authorization: Bearer &lt;token&gt;</span> header. Requests are rate-limited.
          </p>
        </Step>

        <Card className="p-4">
          <SectionLabel>Tip</SectionLabel>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Add an “Ask for Input” action for the amount and pass it straight into the JSON body, then run the Shortcut from Siri: “Hey Siri, log a spend.”
          </p>
          <div className="mt-3">
            <Button block variant="secondary" size="lg" onClick={() => navigate('/settings/tokens')}>
              <KeyIcon size={16} /> Manage API tokens
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Step({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">{index}</span>
        <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

function Field({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
      <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.05em] text-faint">{label}</span>
      <span className={cn('min-w-0 flex-1 truncate text-right text-[13px] text-ink', mono && 'font-mono')}>{value}</span>
      {onCopy ? (
        <button type="button" onClick={onCopy} className="pressable shrink-0 text-link" aria-label={`Copy ${label}`}>
          <CopyIcon size={15} />
        </button>
      ) : null}
    </div>
  )
}

function Param({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <div className="font-mono text-[13px] font-semibold text-ink">{name}</div>
      <div className="mt-0.5 text-[12.5px] text-muted">{desc}</div>
    </div>
  )
}

function Endpoint({ method, path, desc }: { method: 'GET' | 'POST'; path: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <Pill tone={method === 'POST' ? 'accent' : 'link'}>{method}</Pill>
        <span className="font-mono text-[13px] text-ink">{path}</span>
      </div>
      <div className="mt-1 text-[12.5px] text-muted">{desc}</div>
    </div>
  )
}
