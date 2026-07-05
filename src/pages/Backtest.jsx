import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Save, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ConfigPanel from '@/components/simulator/ConfigPanel';
import PnLDistribution from '@/components/charts/PnLDistribution';
import ComparisonTable from '@/components/charts/ComparisonTable';
import MetricCard from '@/components/ui/MetricCard';
import { generatePaths } from '@/lib/simulation/gbm';
import { runBacktest } from '@/lib/simulation/hedging-engine';
import { getStrategy, STRATEGY_INFO } from '@/lib/strategies';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_CONFIG = {
  S0: 100, K: 100, T: 0.25, r: 0.05, mu: 0.08, sigma: 0.2,
  optionType: 'call', position: 'short',
  txCostRate: 0.001, bidAskSpread: 0.05,
  nSteps: 63, nPaths: 500
};

export default function Backtest() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const runBacktestSim = useCallback(() => {
    setRunning(true);
    setProgress(0);
    setResults(null);

    setTimeout(() => {
      const paths = generatePaths(config.S0, config.mu, config.sigma, config.T, config.nSteps, config.nPaths);
      setProgress(30);

      const strategies = ['no_hedge', 'bs_delta', 'bs_delta_gamma', 'adaptive_rl'];
      const allResults = {};
      const allPnls = {};

      strategies.forEach((name, idx) => {
        const bt = runBacktest(paths, config, getStrategy(name));
        allResults[name] = bt.metrics;
        allPnls[name] = bt.results.map(r => r.totalPnL);
        setProgress(30 + ((idx + 1) / strategies.length) * 60);
      });

      setResults({ metrics: allResults, pnls: allPnls });
      setProgress(100);
      setRunning(false);
    }, 100);
  }, [config]);

  const saveExperiment = useCallback(async () => {
    if (!results) return;
    try {
      await base44.entities.Experiment.create({
        name: `Backtest ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        description: `MC backtest: S₀=${config.S0}, K=${config.K}, σ=${(config.sigma*100).toFixed(0)}%, ${config.nPaths} paths`,
        status: 'completed',
        strategy: 'all',
        num_paths: config.nPaths,
        config,
        results: results.metrics,
        tags: ['backtest', config.optionType]
      });
      toast({ title: 'Experiment saved', description: 'Results have been saved to experiments.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save experiment.', variant: 'destructive' });
    }
  }, [results, config, toast]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Monte Carlo Backtest</h1>
          <p className="text-xs text-gray-500 mt-1">Run path ensemble backtests and compare strategy risk metrics</p>
        </div>
        <div className="flex gap-2">
          {results && (
            <Button variant="outline" size="sm" onClick={saveExperiment} className="border-gray-700 text-gray-400 hover:text-white bg-transparent">
              <Save className="w-3 h-3 mr-1.5" /> Save
            </Button>
          )}
          <Button size="sm" onClick={runBacktestSim} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {running ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Play className="w-3 h-3 mr-1.5" />}
            {running ? `${progress.toFixed(0)}%` : 'Run Backtest'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-medium">Configuration</h2>
            <ConfigPanel config={config} onChange={setConfig} />
          </div>
        </div>

        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {!results && !running ? (
            <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
              <Play className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Configure parameters and run backtest</p>
              <p className="text-xs text-gray-600 mt-1">Will simulate {config.nPaths} paths × 4 strategies</p>
            </div>
          ) : running ? (
            <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
              <Loader2 className="w-8 h-8 text-emerald-400 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-300">Running Monte Carlo simulation...</p>
              <div className="w-48 h-1.5 bg-gray-800 rounded-full mx-auto mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">{progress.toFixed(0)}% — {config.nPaths} paths</p>
            </div>
          ) : (
            <>
              {/* Top-line metrics: BS Delta summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MetricCard label="BS Δ Mean P&L" value={results.metrics.bs_delta.mean.toFixed(4)}
                  trend={results.metrics.bs_delta.mean >= 0 ? 'up' : 'down'} />
                <MetricCard label="BS Δ Std" value={results.metrics.bs_delta.std.toFixed(4)} />
                <MetricCard label="BS Δ CVaR 5%" value={results.metrics.bs_delta.cvar5.toFixed(4)} trend="down" />
                <MetricCard label="RL Mean P&L" value={results.metrics.adaptive_rl.mean.toFixed(4)}
                  trend={results.metrics.adaptive_rl.mean >= 0 ? 'up' : 'down'} />
                <MetricCard label="RL CVaR 5%" value={results.metrics.adaptive_rl.cvar5.toFixed(4)} trend="down" />
              </div>

              {/* Comparison Table */}
              <ComparisonTable results={results.metrics} />

              {/* P&L Distributions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(results.pnls).map(([name, pnls]) => (
                  <PnLDistribution
                    key={name}
                    pnls={pnls}
                    color={STRATEGY_INFO[name]?.color || '#888'}
                    title={`${STRATEGY_INFO[name]?.name || name} P&L`}
                    metrics={results.metrics[name]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
