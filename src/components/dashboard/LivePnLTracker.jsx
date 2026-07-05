import { useState, useEffect, useRef, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Play, Square, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { generatePath } from '@/lib/simulation/gbm';
import { simulateHedging } from '@/lib/simulation/hedging-engine';
import { getStrategy, STRATEGY_INFO } from '@/lib/strategies';
import { greeks } from '@/lib/pricing/black-scholes';

const SIM_CONFIG = {
  S0: 100, K: 100, T: 0.25, r: 0.05, mu: 0.08, sigma: 0.2,
  optionType: 'call', position: 'short',
  txCostRate: 0.001, bidAskSpread: 0.05, nSteps: 63
};

const TICK_INTERVAL = 2000; // ms between updates

export default function LivePnLTracker() {
  const [strategy, setStrategy] = useState('bs_delta');
  const [running, setRunning] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [ticker, setTicker] = useState(null);

  // We pre-simulate a full path on start, then replay it step by step
  const simRef = useRef(null);   // { steps[], path }
  const stepRef = useRef(0);
  const intervalRef = useRef(null);

  const startSimulation = useCallback(() => {
    // Generate a fresh path and simulate it fully
    const path = generatePath(SIM_CONFIG.S0, SIM_CONFIG.mu, SIM_CONFIG.sigma, SIM_CONFIG.T, SIM_CONFIG.nSteps);
    const result = simulateHedging(path, SIM_CONFIG, getStrategy(strategy));
    simRef.current = { steps: result.steps, path };
    stepRef.current = 0;
    setChartData([]);
    setRunning(true);
  }, [strategy]);

  const stopSimulation = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
  }, []);

  // Advance one step every TICK_INTERVAL
  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      const i = stepRef.current;

      if (i >= sim.steps.length) {
        clearInterval(intervalRef.current);
        setRunning(false);
        return;
      }

      const step = sim.steps[i];
      const dt = SIM_CONFIG.T / SIM_CONFIG.nSteps;
      const tauRemaining = step.tau;
      const daysLeft = +(tauRemaining * 252).toFixed(1);
      const g = greeks(step.spotPrice, SIM_CONFIG.K, Math.max(step.tau, 0.0001), SIM_CONFIG.r, SIM_CONFIG.sigma, SIM_CONFIG.optionType);

      setChartData(prev => {
        const next = [...prev, {
          step: i,
          time: +(i * dt).toFixed(3),
          pnl: +step.cashAccount.toFixed(4),
          hedgePnL: +step.hedgePnL.toFixed(4),
          cost: +step.cumulativeCost.toFixed(4)
        }];
        return next.slice(-80); // keep last 80 points
      });

      setTicker({
        pnl: step.cashAccount,
        unrealized: step.hedgePnL,
        delta: g.delta,
        hedge: step.currentHedge,
        spot: step.spotPrice,
        daysLeft,
        step: i,
        totalSteps: sim.steps.length - 1
      });

      stepRef.current = i + 1;
    }, TICK_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [running]);

  const pnlColor = ticker ? (ticker.pnl >= 0 ? '#10b981' : '#ef4444') : '#6b7280';

  return (
    <div className="bg-[#12131a] border border-gray-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/40">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <h2 className="text-sm font-medium text-white">Live P&amp;L Tracker</h2>
          {running && <span className="text-[10px] text-gray-500 font-mono">LIVE</span>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={strategy} onValueChange={setStrategy} disabled={running}>
            <SelectTrigger className="bg-[#0a0b0f] border-gray-800 text-white text-xs h-7 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STRATEGY_INFO).map(([key, info]) => (
                <SelectItem key={key} value={key}><span style={{ color: info.color }}>{info.name}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          {running ? (
            <Button size="sm" onClick={stopSimulation} className="h-7 px-3 bg-red-600/80 hover:bg-red-600 text-white text-xs">
              <Square className="w-3 h-3 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={startSimulation} className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
              <Play className="w-3 h-3 mr-1" /> Start
            </Button>
          )}
        </div>
      </div>

      {/* Ticker row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-800/30 border-b border-gray-800/40">
        {[
          { label: 'Current P&L', value: ticker ? (ticker.pnl >= 0 ? '+' : '') + ticker.pnl.toFixed(4) : '—', color: pnlColor },
          { label: 'Unrealized (Hedge)', value: ticker ? ticker.unrealized.toFixed(4) : '—', color: ticker?.unrealized >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Delta Exposure (Δ)', value: ticker ? ticker.hedge.toFixed(4) : '—', color: '#3b82f6' },
          { label: 'Days to Expiry', value: ticker ? `${ticker.daysLeft}d` : '—', color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#12131a] px-4 py-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-base font-mono font-semibold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="p-4">
        {chartData.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center">
            <Activity className="w-7 h-7 text-gray-700 mb-2" />
            <p className="text-xs text-gray-600">Select a strategy and press Start to begin live simulation</p>
            <p className="text-[10px] text-gray-700 mt-1">Updates every 2 seconds · 63 steps · S₀=100, K=100, σ=20%</p>
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <XAxis dataKey="step" tick={{ fill: '#4b5563', fontSize: 9 }} axisLine={{ stroke: '#1f2937' }} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 9 }} axisLine={{ stroke: '#1f2937' }} width={50} />
                <Tooltip
                  contentStyle={{ background: '#12131a', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                  formatter={(v, name) => [v?.toFixed(4), name]}
                />
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
                <Line dataKey="pnl" stroke={STRATEGY_INFO[strategy]?.color || '#10b981'} dot={false} strokeWidth={2} name="P&L" isAnimationActive={false} />
                <Line dataKey="hedgePnL" stroke="#6366f1" dot={false} strokeWidth={1.5} strokeDasharray="4 4" name="Hedge P&L" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {ticker && (
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="w-full bg-gray-800/50 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(ticker.step / ticker.totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-600 ml-3 font-mono whitespace-nowrap">
              {ticker.step}/{ticker.totalSteps}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
