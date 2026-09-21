'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Props = {
  data: Array<{ month: string; count: number }>
}

function shortMonth(yyyyMm: string): string {
  const [year, m] = yyyyMm.split('-')
  const d = new Date(Number(year), Number(m) - 1, 1)
  return d.toLocaleString('en', { month: 'short' })
}

export function TimelineChart({ data }: Props) {
  const display = data.map(d => ({ ...d, label: shortMonth(d.month) }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={display} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: '#8C7E6E', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#8C7E6E', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#211D19',
            border: '1px solid #2E2822',
            borderRadius: 8,
          }}
          labelStyle={{ color: '#F0E8DC' }}
          itemStyle={{ color: '#F5A623' }}
          cursor={{ fill: '#2E2822' }}
        />
        <Bar dataKey="count" fill="#F5A623" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
