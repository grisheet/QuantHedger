import { STRATEGY_INFO } from '@/lib/strategies';

const fmt = (v, decimals = 4) => {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return v.toFixed(decimals);
};

const fmtPct = (v) => {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return (v * 100).toFixed(2) + '%';
};

export default function ComparisonTable({ results }) {
  if (!results || Object.keys(results).length === 0) return null;

  const strategies = Object.keys(results);

  const rows = [
    { label: 'Mean P&L', key: 'mean', format: fmt },
    { label: 'Std Dev', key: 'std', format: fmt },
    { label: 'Sharpe', key: 'sharpe', format: (v) => fmt(v, 3) },
    { label: 'VaR 5%', key: 'var5', format: fmt },
    { label: 'CVaR 5%', key: 'cvar5', format: fmt },
    { label: 'Max Drawdown', key: 'maxDrawdown', format: fmt },
    { label: 'Mean Cost', key: 'meanCost', format: fmt },
    { label: 'HE Mean', key: 'heMean', format: fmt },
    { label: 'HE Std', key: 'heStd', format: fmt },
    { label: 'P5', key: 'percentiles.p5', format: fmt },
    { label: 'P50 (Median)', key: 'percentiles.p50', format: fmt },
    { label: 'P95', key: 'percentiles.p95', format: fmt },
  ];

  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  };

  return (
    <div className="bg-[#12131a] border border-gray-800/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Metric</th>
              {strategies.map(s => (
                <th key={s} className="text-right text-[11px] uppercase tracking-wider px-4 py-3" style={{ color: STRATEGY_INFO[s]?.color || '#9ca3af' }}>
                  {STRATEGY_INFO[s]?.name || s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, key, format }) => (
              <tr key={key} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                <td className="px-4 py-2.5 text-gray-400 text-xs">{label}</td>
                {strategies.map(s => (
                  <td key={s} className="px-4 py-2.5 text-right font-mono text-xs text-gray-300">
                    {format(getNestedValue(results[s], key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
