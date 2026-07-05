import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, GitBranch, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STRATEGY_INFO } from '@/lib/strategies';

export default function Experiments() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Experiment.list('-created_date', 50);
      setExperiments(data);
    } catch (e) {}
    setLoading(false);
  };

  const deleteExperiment = async (id) => {
    await base44.entities.Experiment.delete(id);
    setExperiments(prev => prev.filter(e => e.id !== id));
  };

  const fmt = (v) => v !== undefined && v !== null ? Number(v).toFixed(4) : '';

  const exportCSV = (exp) => {
    if (!exp.results) return;
    const headers = ['experiment', 'strategy', 'mean', 'std', 'variance', 'sharpe', 'var5', 'var1', 'cvar5', 'maxDrawdown', 'meanCost', 'heMean', 'heStd', 'p5', 'p25', 'p50', 'p75', 'p95', 'n'];
    const rows = Object.entries(exp.results).map(([name, m]) => [
      exp.name, name,
      fmt(m.mean), fmt(m.std), fmt(m.variance), fmt(m.sharpe),
      fmt(m.var5), fmt(m.var1), fmt(m.cvar5), fmt(m.maxDrawdown), fmt(m.meanCost),
      fmt(m.heMean), fmt(m.heStd),
      fmt(m.percentiles?.p5), fmt(m.percentiles?.p25), fmt(m.percentiles?.p50),
      fmt(m.percentiles?.p75), fmt(m.percentiles?.p95),
      m.n ?? ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exp.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllCSV = () => {
    const headers = ['experiment', 'strategy', 'mean', 'std', 'variance', 'sharpe', 'var5', 'var1', 'cvar5', 'maxDrawdown', 'meanCost', 'heMean', 'heStd', 'p5', 'p25', 'p50', 'p75', 'p95', 'n'];
    const rows = experiments.flatMap(exp =>
      exp.results ? Object.entries(exp.results).map(([name, m]) => [
        exp.name, name,
        fmt(m.mean), fmt(m.std), fmt(m.variance), fmt(m.sharpe),
        fmt(m.var5), fmt(m.var1), fmt(m.cvar5), fmt(m.maxDrawdown), fmt(m.meanCost),
        fmt(m.heMean), fmt(m.heStd),
        fmt(m.percentiles?.p5), fmt(m.percentiles?.p25), fmt(m.percentiles?.p50),
        fmt(m.percentiles?.p75), fmt(m.percentiles?.p95),
        m.n ?? ''
      ]) : []
    );
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_experiments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Experiments</h1>
          <p className="text-xs text-gray-500 mt-1">Saved backtest results and configurations</p>
        </div>
        {experiments.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportAllCSV} className="border-gray-700 text-gray-400 hover:text-white bg-transparent text-xs">
            <Download className="w-3 h-3 mr-1.5" /> Export All CSV
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-700 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      ) : experiments.length === 0 ? (
        <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-16 text-center">
          <GitBranch className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No experiments saved yet</p>
          <p className="text-xs text-gray-600 mt-1">Run a backtest and click Save to store results here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.map(exp => {
            const expanded = expandedId === exp.id;
            return (
              <div key={exp.id} className="bg-[#12131a] border border-gray-800/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : exp.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/20 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <div>
                      <p className="text-sm text-white font-medium">{exp.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{exp.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      exp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
                    }`}>{exp.status}</span>
                    <span className="text-xs text-gray-500 font-mono">{exp.num_paths} paths</span>
                  </div>
                </button>

                {expanded && exp.results && (
                  <div className="px-5 pb-5 border-t border-gray-800/30">
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-800/40">
                            <th className="text-left text-gray-500 py-2 pr-4">Strategy</th>
                            <th className="text-right text-gray-500 py-2 px-3">Mean</th>
                            <th className="text-right text-gray-500 py-2 px-3">Std</th>
                            <th className="text-right text-gray-500 py-2 px-3">CVaR 5%</th>
                            <th className="text-right text-gray-500 py-2 px-3">Sharpe</th>
                            <th className="text-right text-gray-500 py-2 px-3">Mean Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(exp.results).map(([name, m]) => (
                            <tr key={name} className="border-b border-gray-800/20">
                              <td className="py-2 pr-4" style={{ color: STRATEGY_INFO[name]?.color || '#9ca3af' }}>
                                {STRATEGY_INFO[name]?.name || name}
                              </td>
                              <td className="text-right py-2 px-3 font-mono text-gray-300">{fmt(m.mean)}</td>
                              <td className="text-right py-2 px-3 font-mono text-gray-300">{fmt(m.std)}</td>
                              <td className="text-right py-2 px-3 font-mono text-gray-300">{fmt(m.cvar5)}</td>
                              <td className="text-right py-2 px-3 font-mono text-gray-300">{fmt(m.sharpe)}</td>
                              <td className="text-right py-2 px-3 font-mono text-gray-300">{fmt(m.meanCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => exportCSV(exp)} className="text-gray-400 hover:text-white hover:bg-gray-800/40 text-xs">
                        <Download className="w-3 h-3 mr-1.5" /> Export CSV
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteExperiment(exp.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                        <Trash2 className="w-3 h-3 mr-1.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
