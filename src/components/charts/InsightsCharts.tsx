/**
 * Antra — chart primitives (Recharts). This module is lazy-loaded by the
 * Insights screen so the chart library never blocks the app shell.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactMinor, formatMinor } from '../../lib/format'

const AXIS_STYLE = { fontSize: 10, fill: 'rgb(var(--c-faint))' }
const ACCENT = 'rgb(var(--c-accent))'

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  labelPrefix,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>
  label?: string | number
  currency: string
  labelPrefix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-[12px] font-medium text-canvas shadow-float">
      {label !== undefined ? <div className="mb-1 text-[11px] opacity-70">{labelPrefix ? `${labelPrefix}${label}` : label}</div> : null}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 tabular">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="opacity-80">{entry.dataKey === 'previous' ? 'Last period' : entry.name}</span>
          <span className="ml-auto">{formatMinor(entry.value ?? 0, currency)}</span>
        </div>
      ))}
    </div>
  )
}

export interface TrendPoint {
  label: string
  current: number
  previous: number
}

export function TrendChart({ data, currency, showPrevious = true }: { data: TrendPoint[]; currency: string; showPrevious?: boolean }) {
  return (
    <div className="h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={22} />
          <YAxis
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            width={46}
            tickFormatter={(value: number) => formatCompactMinor(value, currency)}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: 'rgb(var(--c-hairline))' }} />
          {showPrevious ? (
            <Area
              type="monotone"
              dataKey="previous"
              stroke="rgb(var(--c-faint))"
              strokeWidth={1.6}
              strokeDasharray="4 4"
              fill="none"
              dot={false}
              isAnimationActive
              animationDuration={700}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="current"
            stroke={ACCENT}
            strokeWidth={2.4}
            fill="url(#trendFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface Slice {
  name: string
  value: number
  color: string
}

export function CategoryDonut({ data, currency, centerLabel }: { data: Slice[]; currency: string; centerLabel?: string }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <div className="relative h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive
            animationDuration={750}
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip currency={currency} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{centerLabel ?? 'Total'}</span>
        <span className="text-[17px] font-semibold tabular text-ink">{formatMinor(total, currency)}</span>
      </div>
    </div>
  )
}

export interface BarDatum {
  label: string
  value: number
  color?: string
}

export function DistributionBars({
  data,
  currency,
  height = 150,
}: {
  data: BarDatum[]
  currency: string
  height?: number
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => formatCompactMinor(v, currency)} />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'rgb(var(--c-surface-2))' }} />
          <Bar dataKey="value" radius={[8, 8, 8, 8]} isAnimationActive animationDuration={700}>
            {data.map((datum, index) => (
              <Cell key={index} fill={datum.color ?? ACCENT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
