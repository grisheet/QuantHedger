import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import Heatmap from '@/components/charts/Heatmap';
import { generatePaths } from '@/lib/simulation/gbm';
import { runBacktest } from '@/lib/simulation/hedging-engine';
import { getStrategy, STRATEGY_INFO } from '@/lib/strategies';

const STRATEGIES = ['no_hedge', 'bs_delta', 'bs_delta_gamma', 'adaptive_rl'];

// Sweep parameters
const VOL_STEPS = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.65, 0.80];
const SPOT_STEPS = [60, 70, 80, 90, 100, 110, 120, 130, 140];

const VOL_LABELS = VOL_STEPS.map(v => `${(v * 100).toFixed(0)}%`);
const SPOT_LABELS = SPOT_STEPS.map(s => `${s}`);

const DEFAULT_FIXED = {
  K: 100, T: 0.25, r: 0.05, mu: 0.08,
  optionType: 'call', position: 'short',
  txCostRate: 0.001, bidAskSpread: 0.05,
  nSteps: 42, nPaths: 120  // smaller for speed across the full sweep
};

function runSweep(fixedConfig) {
  const heatmaps = {};    // heatmaps[strategy][volIdx][spotIdx] = mean P&L
  const sharpeByVol = []; // [{vol, no_hedge, bs_delta, ...}]
  const worstCVaR = [];   // [{vol, worstStrategy, cvar}]

  STRATEGIES.forEach(name => { heatmaps[name] = []; });

  for (let vi = 0; vi < VOL_STEPS.length; vi++) {
    const sigma = VOL_STEPS[vi];
    const sharpeRow = { vol: VOL_LABELS[vi], volNum: sigma * 100 };
    const cvarRow = { vol: VOL_LABELS[vi], volNum: sigma * 100 };
    let worstStrategy = null;
    let worstCvarVal = Infinity;

    STRATEGIES.forEach(name => { heatmaps[name].push([]); });

    for (let si = 0; si < SPOT_STEPS.length; si++) {
      const S0 = SPOT_STEPS[si];
      const config = { ...fixedConfig, S0, sigma };
      const paths = generatePaths(S0, fixedConfig.mu, sigma, fixedConfig.T, fixedConfig.nSteps, fixedConfig.nPaths);

      STRATEGIES.forEach(name => {
        const bt = runBacktest(paths, config, getStrategy(name));
        heatmaps[name][vi].push(bt.metrics.mean);
        if (si === 4) { // ATM spot = 100 for per-vol stats
          sharpeRow[name] = +bt.metrics.sharpe.toFixed(3);
          cvarRow[name] = +bt.metrics.cvar5.toFixed(4);
          if (bt.metrics.cvar5 < worstCvarVal) {
            worstCvarVal = bt.metrics.cvar5;
            worstStrategy = name;
          }
        }
      });
    }

    sharpeByVol.push(sharpeRow);
    worstCVaR.push({ ...cvarRow, worstStrategy, worstCvarVal: +worstCvarVal.toFixed(4) });
  }

  return { heatmaps, sharpeByVol, worstCVaR };
}

export default function StressTest() {
  const [fixedConfig, setFixedConfig] = useState(DEFAULT_FIXED);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeStrategy, setActiveStrategy] = useState('bs_delta');

  const updateFixed = (key, val) => setFixedConfig(p => ({ ...p, [key]: val }));

  const run = useCallback(() => {
    setRunning(true);
    setProgress(0);
    setResults(null);
    // Yield to let UI update, then run the sweep
    setTimeout(() => {
      const res = runSweep(fixedConfig);
      setResults(res);
      setProgress(100);
      setRunning(false);
    }, 80);
  }, [fixedConfig]);

  const FIELD = "bg-[#0a0b0f] border-gray-800 text-white text-sm h-8 focus:ring-emerald-500/30 focus:border-emerald-500/50";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Sensitivity Stress Test</h1>
          <p className="text-xs text-gray-500 mt-1">
            Sweep σ ∈ [5%, 80%] × S ∈ [60, 140] — all other parameters fixed
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          {running ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Play className="w-3 h-3 mr-1.5" />}
          {running ? 'Running sweep...' : 'Run Stress Test'}
        </Button>
      </div>

      {/* Fixed params controls */}
      <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
        <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-medium">Fixed Parameters (σ and S are swept)</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div>
            <Label className="text-xs text-gray-400 mb-1">Strike (K)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[fixedConfig.K]} onValueChange={([v]) => updateFixed('K', v)} min={60} max={140} step={5} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-8">{fixedConfig.K}</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Maturity (T)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[fixedConfig.T * 12]} onValueChange={([v]) => updateFixed('T', v / 12)} min={1} max={12} step={1} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-10">{(fixedConfig.T * 12).toFixed(0)}mo</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Rate (r)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[fixedConfig.r * 100]} onValueChange={([v]) => updateFixed('r', v / 100)} min={0} max={15} step={0.25} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-10">{(fixedConfig.r * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Tx Cost (bps)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[fixedConfig.txCostRate * 10000]} onValueChange={([v]) => updateFixed('txCostRate', v / 10000)} min={0} max={50} step={1} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-8">{(fixedConfig.txCostRate * 10000).toFixed(0)}</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Option Type</Label>
            <Select value={fixedConfig.optionType} onValueChange={v => updateFixed('optionType', v)}>
              <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="put">Put</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Paths / Cell</Label>
            <div className="flex items-center gap-2">
              <Slider value={[fixedConfig.nPaths]} onValueChange={([v]) => updateFixed('nPaths', v)} min={50} max={300} step={50} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-8">{fixedConfig.nPaths}</span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mt-3">
          Total simulations: {VOL_STEPS.length} vol × {SPOT_STEPS.length} spot × 4 strategies × {fixedConfig.nPaths} paths
          = {(VOL_STEPS.length * SPOT_STEPS.length * 4 * fixedConfig.nPaths).toLocaleString()} paths
        </p>
      </div>

      {/* Empty state */}
      {!results && !running && (
        <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
          <AlertTriangle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Configure fixed parameters and run the stress test</p>
          <p className="text-xs text-gray-600 mt-1">Sweeps {VOL_STEPS.length} volatility × {SPOT_STEPS.length} spot levels per strategy</p>
        </div>
      )}

      {running && (
        <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-300">Running full σ × S sweep across 4 strategies...</p>
          <p className="text-xs text-gray-500 mt-2">This may take a few seconds</p>
        </div>
      )}

      {results && !running && (
        <>
          {/* Section 1: Heatmaps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-widest text-gray-500 font-medium">Mean Hedge P&L Heatmap — σ vs S</h2>
              <div className="flex gap-1 bg-[#0a0b0f] rounded-lg p-1 border border-gray-800/50">
                {STRATEGIES.map(name => (
                  <button
                    key={name}
                    onClick={() => setActiveStrategy(name)}
                    className={`px-2.5 py-1 rounded text-[10px] transition-all ${
                      activeStrategy === name ? 'text-white' : 'text-gray-600 hover:text-gray-400'
                    }`}
                    style={activeStrategy === name ? { backgroundColor: STRATEGY_INFO[name].color + '25', color: STRATEGY_INFO[name].color } : {}}
                  >
                    {STRATEGY_INFO[name].name}
                  </button>
                ))}
              </div>
            </div>
            <Heatmap
              data={results.heatmaps[activeStrategy]}
              rowLabels={VOL_LABELS}
              colLabels={SPOT_LABELS}
              rowAxisLabel="Volatility (σ)"
              colAxisLabel="Spot Price (S)"
              title={`${STRATEGY_INFO[activeStrategy].name} — Mean P&L by σ × S`}
              fmt={(v) => v?.toFixed(3)}
            />
          </div>

          {/* Section 2: Sharpe vs Vol */}
          <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-300 mb-1">Sharpe Ratio Degradation as Volatility Spikes</h3>
            <p className="text-[11px] text-gray-600 mb-4">ATM option (S = K = 100), all other params fixed. Higher is better.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.sharpeByVol} margin={{ top: 5, right: 15, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1b23" />
                  <XAxis dataKey="vol" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }}
                    label={{ value: 'Volatility (σ)', position: 'insideBottom', offset: -2, fill: '#4b5563', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }}
                    label={{ value: 'Sharpe', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#12131a', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => [v?.toFixed(3), STRATEGY_INFO[name]?.name || name]}
                    labelFormatter={(v) => `σ = ${v}`}
                  />
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 4" />
                  <Legend wrapperStyle={{ fontSize: 11 }}
                    formatter={(name) => <span style={{ color: STRATEGY_INFO[name]?.color }}>{STRATEGY_INFO[name]?.name}</span>}
                  />
                  {STRATEGIES.map(name => (
                    <Line key={name} dataKey={name} stroke={STRATEGY_INFO[name].color} dot={{ r: 3, fill: STRATEGY_INFO[name].color }}
                      strokeWidth={2} name={name} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section 3: Worst Case CVaR panel */}
          <div className="bg-[#12131a] border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800/40">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                Worst-Case Scenario — CVaR 5% by Volatility Level (ATM, S=100)
              </h3>
              <p className="text-[11px] text-gray-600 mt-0.5">The strategy with the worst Expected Shortfall at each vol regime</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800/40">
                    <th className="text-left text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Volatility</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Worst Strategy</th>
                    <th className="text-right text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Worst CVaR</th>
                    {STRATEGIES.map(name => (
                      <th key={name} className="text-right text-[11px] uppercase tracking-wider px-3 py-3"
                        style={{ color: STRATEGY_INFO[name].color + 'aa' }}>
                        {STRATEGY_INFO[name].name.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.worstCVaR.map((row, i) => {
                    const worstInfo = STRATEGY_INFO[row.worstStrategy];
                    return (
                      <tr key={i} className="border-b border-gray-800/20 hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-gray-300">{row.vol}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: worstInfo?.color }} />
                            <span style={{ color: worstInfo?.color }}>{worstInfo?.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-red-400">{row.worstCvarVal?.toFixed(4)}</td>
                        {STRATEGIES.map(name => (
                          <td key={name} className={`px-3 py-2.5 text-right font-mono ${
                            name === row.worstStrategy ? 'text-red-400 font-semibold' : 'text-gray-500'
                          }`}>
                            {row[name]?.toFixed(4)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
