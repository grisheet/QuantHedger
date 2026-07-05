import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine } from 'recharts';
import ConfigPanel from '@/components/simulator/ConfigPanel';
import { generatePaths } from '@/lib/simulation/gbm';
import { runBacktest } from '@/lib/simulation/hedging-engine';
import { getStrategy, STRATEGY_INFO } from '@/lib/strategies';

const DEFAULT_CONFIG = {
  S0: 100, K: 100, T: 0.25, r: 0.05, mu: 0.08, sigma: 0.2,
  optionType: 'call', position: 'short',
  txCostRate: 0.001, bidAskSpread: 0.05,
  nSteps: 63, nPaths: 300
};

const STRATEGIES = ['no_hedge', 'bs_delta', 'bs_delta_gamma', 'adaptive_rl'];

function computeWinRate(pnls) {
  return pnls.filter(p => p > 0).length / pnls.length;
}

function computeCumulativePnL(pnls) {
  // Sort ascending and build cumulative curve (sorted path index on x-axis)
  const sorted = [...pnls].sort((a, b) => a - b);
  return sorted.map((pnl, i) => ({ pathIndex: i, pnl: +pnl.toFixed(4) }));
}

// Build per-step average P&L across all paths to show "average path" evolution
function buildAverageStepPnL(backtestResults, nSteps) {
  const n = backtestResults.results.length;
  const stepData = Array.from({ length: nSteps + 1 }, (_, i) => ({ step: i }));
  backtestResults.results.forEach(result => {
    result.steps.forEach((s, i) => {
      stepData[i]._sum = (stepData[i]._sum || 0) + s.cashAccount;
      stepData[i]._count = (stepData[i]._count || 0) + 1;
    });
  });
  return stepData.map(d => ({
    step: d.step,
    avg: +((d._sum || 0) / (d._count || 1)).toFixed(4)
  }));
}

const fmt4 = (v) => (v !== undefined && !isNaN(v)) ? Number(v).toFixed(4) : '—';
const fmtPct = (v) => (v !== undefined && !isNaN(v)) ? (v * 100).toFixed(1) + '%' : '—';
const fmtRatio = (v) => (v !== undefined && !isNaN(v)) ? Number(v).toFixed(3) : '—';

export default function StrategyComparison() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [visibleStrategies, setVisibleStrategies] = useState(new Set(STRATEGIES));
  const [chartMode, setChartMode] = useState('cumulative'); // 'cumulative' | 'distribution'

  const toggleStrategy = (name) => {
    setVisibleStrategies(prev => {
      const next = new Set(prev);
      if (next.has(name)) { if (next.size > 1) next.delete(name); }
      else next.add(name);
      return next;
    });
  };

  const run = useCallback(() => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const paths = generatePaths(config.S0, config.mu, config.sigma, config.T, config.nSteps, config.nPaths);
      const backtestMap = {};
      const metricsMap = {};
      const pnlsMap = {};
      const stepCurvesMap = {};

      STRATEGIES.forEach(name => {
        const bt = runBacktest(paths, config, getStrategy(name));
        backtestMap[name] = bt;
        metricsMap[name] = bt.metrics;
        pnlsMap[name] = bt.results.map(r => r.totalPnL);
        stepCurvesMap[name] = buildAverageStepPnL(bt, config.nSteps);
      });

      // Build combined cumulative chart: sorted P&L across paths
      const nPaths = config.nPaths;
      const cumulativeData = Array.from({ length: nPaths }, (_, i) => {
        const row = { pathIndex: i };
        STRATEGIES.forEach(name => {
          const sorted = [...pnlsMap[name]].sort((a, b) => a - b);
          row[name] = +sorted[i].toFixed(4);
        });
        return row;
      });

      // Build step-averaged P&L curve (average across all paths, over time)
      const nSteps = config.nSteps;
      const avgStepData = Array.from({ length: nSteps + 1 }, (_, i) => {
        const row = { step: i };
        STRATEGIES.forEach(name => {
          row[name] = stepCurvesMap[name][i]?.avg ?? 0;
        });
        return row;
      });

      setResults({ metricsMap, pnlsMap, cumulativeData, avgStepData });
      setRunning(false);
    }, 100);
  }, [config]);

  const summary = useMemo(() => {
    if (!results) return null;
    return STRATEGIES.map(name => {
      const m = results.metricsMap[name];
      const pnls = results.pnlsMap[name];
      const winRate = computeWinRate(pnls);
      const totalPnL = pnls.reduce((s, x) => s + x, 0);
      return { name, totalPnL, sharpe: m.sharpe, maxDrawdown: m.maxDrawdown, cvar5: m.cvar5, winRate };
    });
  }, [results]);

  const chartData = results ? (chartMode === 'cumulative' ? results.cumulativeData : results.avgStepData) : [];
  const xKey = chartMode === 'cumulative' ? 'pathIndex' : 'step';
  const xLabel = chartMode === 'cumulative' ? 'Path Rank (sorted by P&L)' : 'Time Step';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Strategy Comparison</h1>
          <p className="text-xs text-gray-500 mt-1">Compare cumulative P&L curves and risk metrics across all hedging strategies</p>
        </div>
        <Button size="sm" onClick={run} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          {running ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Play className="w-3 h-3 mr-1.5" />}
          {running ? 'Running...' : 'Run Comparison'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Config */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-medium">Configuration</h2>
            <ConfigPanel config={config} onChange={setConfig} />
          </div>
        </div>

        {/* Charts + Table */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {!results && !running && (
            <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
              <Play className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click Run Comparison to simulate all 4 strategies</p>
              <p className="text-xs text-gray-600 mt-1">{config.nPaths} paths × 4 strategies</p>
            </div>
          )}

          {running && (
            <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
              <Loader2 className="w-8 h-8 text-emerald-400 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-300">Running {config.nPaths} paths across 4 strategies...</p>
            </div>
          )}

          {results && !running && (
            <>
              {/* Strategy toggle + chart mode */}
              <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {STRATEGIES.map(name => {
                      const info = STRATEGY_INFO[name];
                      const active = visibleStrategies.has(name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleStrategy(name)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                            active ? 'border-gray-600' : 'border-gray-800 opacity-40'
                          }`}
                          style={active ? { borderColor: info.color + '50', backgroundColor: info.color + '12', color: info.color } : {}}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                          {info.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 bg-[#0a0b0f] rounded-lg p-1 border border-gray-800/50">
                    {['cumulative', 'average_path'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setChartMode(mode === 'average_path' ? 'step' : 'cumulative')}
                        className={`px-3 py-1 rounded text-[11px] transition-all ${
                          (mode === 'cumulative' && chartMode === 'cumulative') || (mode === 'average_path' && chartMode === 'step')
                            ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {mode === 'cumulative' ? 'Sorted P&L' : 'Avg Path'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main Chart */}
              <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
                <h3 className="text-sm font-medium text-gray-300 mb-1">
                  {chartMode === 'cumulative' ? 'Cumulative P&L — Sorted Path Distribution' : 'Average P&L Evolution Over Time'}
                </h3>
                <p className="text-[11px] text-gray-600 mb-4">
                  {chartMode === 'cumulative'
                    ? 'Each x-axis point is a path sorted by final P&L. Steeper curves = wider dispersion.'
                    : 'Mean P&L across all simulated paths at each hedging step.'}
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 15, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1b23" />
                      <XAxis
                        dataKey={xKey}
                        tick={{ fill: '#4b5563', fontSize: 10 }}
                        axisLine={{ stroke: '#1f2937' }}
                        label={{ value: xLabel, position: 'insideBottom', offset: -2, fill: '#4b5563', fontSize: 10 }}
                      />
                      <YAxis
                        tick={{ fill: '#4b5563', fontSize: 10 }}
                        axisLine={{ stroke: '#1f2937' }}
                        label={{ value: 'P&L', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{ background: '#12131a', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [v?.toFixed(4), STRATEGY_INFO[name]?.name || name]}
                        labelFormatter={(v) => `${xLabel}: ${v}`}
                      />
                      <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 4" />
                      {STRATEGIES.filter(n => visibleStrategies.has(n)).map(name => (
                        <Line
                          key={name}
                          dataKey={name}
                          stroke={STRATEGY_INFO[name].color}
                          dot={false}
                          strokeWidth={2}
                          name={name}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance Summary Table */}
              <div className="bg-[#12131a] border border-gray-800/50 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800/40">
                  <h3 className="text-sm font-medium text-gray-300">Performance Summary</h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">Aggregated across {config.nPaths} simulated paths</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800/50">
                        {['Strategy', 'Total P&L', 'Sharpe Ratio', 'Max Drawdown', 'CVaR 5%', 'Win Rate'].map(col => (
                          <th key={col} className={`text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3 ${col === 'Strategy' ? 'text-left' : 'text-right'}`}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(({ name, totalPnL, sharpe, maxDrawdown, cvar5, winRate }) => {
                        const info = STRATEGY_INFO[name];
                        const active = visibleStrategies.has(name);
                        return (
                          <tr
                            key={name}
                            onClick={() => toggleStrategy(name)}
                            className={`border-b border-gray-800/30 cursor-pointer transition-all ${active ? 'hover:bg-gray-800/20' : 'opacity-40'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                                <div>
                                  <p className="text-xs text-white font-medium">{info.name}</p>
                                  <p className="text-[10px] text-gray-600 mt-0.5">{info.description.split('.')[0]}</p>
                                </div>
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-right font-mono text-xs ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {totalPnL >= 0 ? '+' : ''}{fmt4(totalPnL)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono text-xs ${sharpe >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                              {fmtRatio(sharpe)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-red-400">
                              {fmt4(maxDrawdown)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-orange-400">
                              {fmt4(cvar5)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${winRate >= 0.5 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {fmtPct(winRate)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-800/30">
                  <p className="text-[10px] text-gray-600">Click a row to toggle strategy visibility on the chart</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
