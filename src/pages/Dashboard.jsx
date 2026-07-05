import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, BarChart3, TrendingUp, ArrowRight, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MetricCard from '@/components/ui/MetricCard';
import LivePnLTracker from '@/components/dashboard/LivePnLTracker';
import { optionPrice, greeks } from '@/lib/pricing/black-scholes';

const DEFAULT_PARAMS = { S0: 100, K: 100, T: 0.25, r: 0.05, sigma: 0.2, optionType: 'call' };

export default function Dashboard() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Experiment.list('-created_date', 5)
      .then(setExperiments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const p = DEFAULT_PARAMS;
  const price = optionPrice(p.S0, p.K, p.T, p.r, p.sigma, p.optionType);
  const g = greeks(p.S0, p.K, p.T, p.r, p.sigma, p.optionType);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Derivatives Hedging Engine</h1>
        <p className="text-sm text-gray-500 mt-1">RL-based research prototype for dynamic hedging of European options</p>
      </div>

      {/* Quick Reference: ATM Option */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-3 font-medium">ATM Reference (S=K=100, σ=20%, T=3mo)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Option Price" value={price.toFixed(4)} sublabel={`${p.optionType} option`} />
          <MetricCard label="Delta (Δ)" value={g.delta.toFixed(4)} sublabel="hedge ratio" />
          <MetricCard label="Gamma (Γ)" value={g.gamma.toFixed(4)} sublabel="convexity" />
          <MetricCard label="Theta (Θ)" value={g.theta.toFixed(4)} sublabel="per year" />
          <MetricCard label="Vega (ν)" value={g.vega.toFixed(4)} sublabel="per 1σ" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/simulator" className="group bg-[#12131a] border border-gray-800/50 rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="font-medium text-white text-sm">Single Path Simulator</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">Simulate a single price path and watch hedging strategies rebalance in real-time</p>
          <span className="text-xs text-emerald-400 flex items-center gap-1 group-hover:gap-2 transition-all">
            Launch <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link to="/backtest" className="group bg-[#12131a] border border-gray-800/50 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="font-medium text-white text-sm">Monte Carlo Backtest</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">Run 1000+ path ensemble backtests comparing hedging strategies with full risk metrics</p>
          <span className="text-xs text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
            Launch <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link to="/greeks" className="group bg-[#12131a] border border-gray-800/50 rounded-xl p-5 hover:border-purple-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="font-medium text-white text-sm">Greeks Explorer</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">Interactive visualization of option Greeks surfaces across spot and time dimensions</p>
          <span className="text-xs text-purple-400 flex items-center gap-1 group-hover:gap-2 transition-all">
            Launch <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {/* Live P&L Tracker */}
      <LivePnLTracker />

      {/* Recent Experiments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-medium">Recent Experiments</h2>
          <Link to="/experiments" className="text-xs text-emerald-400 hover:text-emerald-300">View all →</Link>
        </div>
        <div className="bg-[#12131a] border border-gray-800/50 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-gray-700 border-t-emerald-400 rounded-full animate-spin" />
            </div>
          ) : experiments.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No experiments yet</p>
              <p className="text-xs text-gray-600 mt-1">Run a backtest to save your first experiment</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="text-left text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Name</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Strategy</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Status</th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-gray-500 px-4 py-3">Paths</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map(exp => (
                  <tr key={exp.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="px-4 py-2.5 text-gray-300 text-xs">{exp.name}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{exp.strategy}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        exp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        exp.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>{exp.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400 text-xs font-mono">{exp.num_paths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
