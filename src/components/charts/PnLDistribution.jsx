import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function buildHistogram(values, bins = 40) {
  if (!values || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / bins;
  const counts = new Array(bins).fill(0);

  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    counts[idx]++;
  });

  return counts.map((count, i) => ({
    x: +(min + (i + 0.5) * binWidth).toFixed(2),
    count,
    label: `${(min + i * binWidth).toFixed(2)} to ${(min + (i + 1) * binWidth).toFixed(2)}`
  }));
}

export default function PnLDistribution({ pnls, color = '#10b981', title = 'P&L Distribution', metrics }) {
  const data = buildHistogram(pnls, 40);
  const mean = pnls.reduce((s, x) => s + x, 0) / pnls.length;

  return (
    <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <XAxis
              dataKey="x"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={v => v.toFixed(1)}
              axisLine={{ stroke: '#1f2937' }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1f2937' }}
            />
            <Tooltip
              contentStyle={{ background: '#1a1b23', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
              labelFormatter={v => `P&L: ${v}`}
              formatter={(value) => [value, 'Count']}
            />
            <ReferenceLine x={0} stroke="#374151" strokeDasharray="3 3" />
            <ReferenceLine x={+mean.toFixed(2)} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Mean', fill: '#f59e0b', fontSize: 10 }} />
            {metrics?.cvar5 && (
              <ReferenceLine x={+metrics.cvar5.toFixed(2)} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'CVaR 5%', fill: '#ef4444', fontSize: 10 }} />
            )}
            <Bar dataKey="count" fill={color} opacity={0.7} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
