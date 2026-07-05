import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PathChart({ data, lines, title, yLabel }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <XAxis
              dataKey="step"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1f2937' }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1f2937' }}
              label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 } : undefined}
            />
            <Tooltip
              contentStyle={{ background: '#1a1b23', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {lines.map(({ key, color, name, dashed }) => (
              <Line
                key={key}
                dataKey={key}
                stroke={color}
                name={name || key}
                dot={false}
                strokeWidth={1.5}
                strokeDasharray={dashed ? '4 4' : undefined}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
