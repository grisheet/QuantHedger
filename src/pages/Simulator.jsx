import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
import ConfigPanel from '@/components/simulator/ConfigPanel';
import PathChart from '@/components/charts/PathChart';
import MetricCard from '@/components/ui/MetricCard';
import { generatePath } from '@/lib/simulation/gbm';
import { simulateHedging } from '@/lib/simulation/hedging-engine';
import { getStrategy, STRATEGY_INFO } from '@/lib/strategies';

const DEFAULT_CONFIG = {
  S0: 100, K: 100, T: 0.25, r: 0.05, mu: 0.08, sigma: 0.2,
  optionType: 'call', position: 'short',
  txCostRate: 0.001, bidAskSpread: 0.05,
  nSteps: 63, nPaths: 1
};

export default function Simulator() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  const runSimulation = useCallback(() => {
    setRunning(true);
    // Use setTimeout to let UI update
    setTimeout(() => {
      const path = generatePath(config.S0, config.mu, config.sigma, config.T, config.nSteps);

      const strategyResults = {};
      const strategies = ['no_hedge', 'bs_delta', 'bs_delta_gamma', 'adaptive_rl'];

      strategies.forEach(name => {
        strategyResults[name] = simulateHedging(path, config, getStrategy(name));
      });

      // Build chart data
      const dt = config.T / config.nSteps;
      const priceData = Array.from(path).map((s, i) => ({
        step: i,
        time: +(i * dt).toFixed(4),
        price: +s.toFixed(4)
      }));

      const hedgeData = [];
      const pnlData = [];
      for (let i = 0; i <= config.nSteps; i++) {
        const hedgePoint = { step: i, time: +(i * dt).toFixed(4) };
        const pnlPoint = { step: i, time: +(i * dt).toFixed(4) };
        strategies.forEach(name => {
          const step = strategyResults[name].steps[i];
          hedgePoint[name] = +step.currentHedge.toFixed(4);
          pnlPoint[name] = +step.cashAccount.toFixed(4);
        });
        hedgeData.push(hedgePoint);
        pnlData.push(pnlPoint);
      }

      setResults({ path, strategyResults, priceData, hedgeData, pnlData, strategies });
      setRunning(false);
    }, 50);
  }, [config]);

  const linesDef = Object.entries(STRATEGY_INFO).map(([key, info]) => ({
    key, color: info.color, name: info.name
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Single Path Simulator</h1>
          <p className="text-xs text-gray-500 mt-1">Generate one GBM path and compare hedging strategies step-by-step</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setResults(null); setConfig(DEFAULT_CONFIG); }} className="border-gray-700 text-gray-400 hover:text-white bg-transparent">
            <RotateCcw className="w-3 h-3 mr-1.5" /> Reset
          </Button>
          <Button size="sm" onClick={runSimulation} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <Play className="w-3 h-3 mr-1.5" /> {running ? 'Running...' : 'Simulate'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Config Panel */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-medium">Configuration</h2>
            <ConfigPanel config={config} onChange={setConfig} />
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {!results ? (
            <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
              <Play className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Configure parameters and click Simulate</p>
              <p className="text-xs text-gray-600 mt-1">A single GBM path will be generated and hedged with 4 strategies</p>
            </div>
          ) : (
            <>
              {/* Summary metrics for BS Delta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  label="Initial Premium"
                  value={results.strategyResults.bs_delta.initialPremium.toFixed(4)}
                />
                <MetricCard
                  label="Final Spot"
                  value={results.strategyResults.bs_delta.finalSpot.toFixed(2)}
                  sublabel={`K=${config.K}`}
                />
                <MetricCard
                  label="Option Payoff"
                  value={results.strategyResults.bs_delta.payoff.toFixed(4)}
                />
                <MetricCard
                  label="BS Δ Total P&L"
                  value={results.strategyResults.bs_delta.totalPnL.toFixed(4)}
                  trend={results.strategyResults.bs_delta.totalPnL >= 0 ? 'up' : 'down'}
                  sublabel={results.strategyResults.bs_delta.totalPnL >= 0 ? 'profit' : 'loss'}
                />
              </div>

              {/* Price Path */}
              <PathChart
                data={results.priceData}
                lines={[{ key: 'price', color: '#f59e0b', name: 'Spot Price' }]}
                title="Underlying Price Path (GBM)"
                yLabel="Price"
              />

              {/* Hedge Position */}
              <PathChart
                data={results.hedgeData}
                lines={linesDef}
                title="Hedge Position (Δ units)"
                yLabel="Units"
              />

              {/* Cash Account / Running P&L */}
              <PathChart
                data={results.pnlData}
                lines={linesDef}
                title="Cash Account Evolution"
                yLabel="P&L"
              />

              {/* Final P&L comparison */}
              <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Final P&L Comparison (Single Path)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {results.strategies.map(name => {
                    const r = results.strategyResults[name];
                    const info = STRATEGY_INFO[name];
                    return (
                      <div key={name} className="bg-[#0a0b0f] rounded-lg p-3 border border-gray-800/30">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                          <span className="text-[11px] text-gray-400">{info.name}</span>
                        </div>
                        <p className={`text-lg font-mono font-semibold ${r.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.totalPnL >= 0 ? '+' : ''}{r.totalPnL.toFixed(4)}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">Cost: {r.totalCosts.toFixed(4)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
