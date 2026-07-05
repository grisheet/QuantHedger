/**
 * Heatmap component: renders a 2-D grid of colored cells.
 * Rows = sigma levels, Cols = spot levels.
 * Color interpolates from red (low) to green (high) through neutral.
 */

function interpolateColor(t) {
  // t in [0,1]: 0 = deep red, 0.5 = neutral gray, 1 = deep green
  if (t < 0.5) {
    const f = t / 0.5;
    return `rgb(${Math.round(180 - f * 60)}, ${Math.round(40 + f * 40)}, ${Math.round(40 + f * 30)})`;
  } else {
    const f = (t - 0.5) / 0.5;
    return `rgb(${Math.round(120 - f * 100)}, ${Math.round(80 + f * 90)}, ${Math.round(70 - f * 30)})`;
  }
}

export default function Heatmap({ data, rowLabels, colLabels, rowAxisLabel, colAxisLabel, title, fmt = (v) => v?.toFixed(2) }) {
  if (!data || data.length === 0) return null;

  const allVals = data.flat().filter(v => v !== null && !isNaN(v));
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const cellW = Math.max(36, Math.floor(480 / colLabels.length));
  const cellH = 28;

  return (
    <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>
      <p className="text-[11px] text-gray-600 mb-4">Rows: {rowAxisLabel} · Cols: {colAxisLabel}</p>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Column labels */}
          <div className="flex" style={{ marginLeft: 52 }}>
            {colLabels.map((label, j) => (
              <div key={j} className="text-[9px] text-gray-600 text-center shrink-0 truncate" style={{ width: cellW }}>
                {label}
              </div>
            ))}
          </div>

          {/* Rows */}
          {data.map((row, i) => (
            <div key={i} className="flex items-center">
              {/* Row label */}
              <div className="text-[9px] text-gray-600 text-right pr-2 shrink-0" style={{ width: 50 }}>
                {rowLabels[i]}
              </div>
              {/* Cells */}
              {row.map((val, j) => {
                const t = (val - min) / range;
                const bg = interpolateColor(t);
                return (
                  <div
                    key={j}
                    className="shrink-0 flex items-center justify-center text-[9px] font-mono cursor-default border border-black/20"
                    style={{ width: cellW, height: cellH, backgroundColor: bg, color: 'rgba(255,255,255,0.85)' }}
                    title={`σ=${rowLabels[i]}, S=${colLabels[j]}: ${fmt(val)}`}
                  >
                    {fmt(val)}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Color scale legend */}
          <div className="flex items-center gap-2 mt-3 ml-[52px]">
            <span className="text-[9px] text-gray-600">{fmt(min)}</span>
            <div className="h-2 flex-1 rounded" style={{
              background: 'linear-gradient(to right, rgb(180,40,40), rgb(120,80,70), rgb(20,170,40))'
            }} />
            <span className="text-[9px] text-gray-600">{fmt(max)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
