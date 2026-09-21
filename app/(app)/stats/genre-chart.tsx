'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type Props = {
  data: Array<{ genre: string; count: number }>
}

export function GenreChart({ data }: Props) {
  const barHeight = 40
  const height = Math.max(160, data.length * barHeight)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fill: '#8C7E6E', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="genre"
          tick={{ fill: '#F0E8DC', fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={100}
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
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#F5A623' : '#7A5212'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
