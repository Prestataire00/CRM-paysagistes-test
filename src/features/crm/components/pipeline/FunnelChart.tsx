import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const funnelColors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#f97316', '#22c55e']

interface FunnelChartProps {
  data: Array<{ name: string; value: number }>
}

export function FunnelChart({ data }: FunnelChartProps) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Funnel de conversion
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 12, fill: '#64748b' }}
          />
          <Tooltip
            formatter={(value) => [String(value ?? 0), 'Prospects']}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((_entry, index) => (
              <Cell key={index} fill={funnelColors[index % funnelColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
