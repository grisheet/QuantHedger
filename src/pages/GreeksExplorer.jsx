import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { greeks, optionPrice } from '@/lib/pricing/black-scholes';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

const GREEKS = ['delta', 'gamma', 'theta', 'vega', 'price'];
const COLORS = { delta: '#3b82f6', gamma: '#f59e0b', theta: '#ef4444', vega: '#8b5cf6', price: '#10b981' };

export default function GreeksExplorer() {
  const [params, setParams] = useState({
    K: 100, T: 0.25, r: 0.05, sigma: 0.2, optionType: 'call',
    spotMin: 70, spotMax: 130
  });
  const [selectedGreeks, setSelectedGreeks] = useState(['delta', 'gamma']);

  const update = (key, value) => setParams(p => ({ ...p, [key]: value }));

  const spotData = useMemo(() => {
    const data = [];
    const steps = 100;
    const range = params.spotMax - params.spotMin;
    for (let i = 0; i <= steps; i++) {
      const S = params.spotMin + (i / steps) * range;
      const g = greeks(S, params.K, params.T, params.r, params.sigma, params.optionType);
      const p = optionPrice(S, params.K, params.T, params.r, params.sigma, params.optionType);
      data.push({ spot: +S.toFixed(2), delta: +g.delta.toFixed(6), gamma: +g.gamma.toFixed(6), theta: +g.theta.toFixed(6), vega: +g.vega.toFixed(6), price: +p.toFixed(4) });
    }
    return data;
  }, [params]);

  const timeData = useMemo(() => {
    const data = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const T = Math.max(0.001, (1 - i / steps) * params.T);
      const g = greeks(params.K, params.K, T, params.r, params.sigma, params.optionType); // ATM
      const p = optionPrice(params.K, params.K, T, params.r, params.sigma, params.optionType);
      data.push({ daysToExpiry: +(T * 252).toFixed(1), delta: +g.delta.toFixed(6), gamma: +g.gamma.toFixed(6), theta: +g.theta.toFixed(6), vega: +g.vega.toFixed(6), price: +p.toFixed(4) });
    }
    return data;
  }, [params]);

  const toggleGreek = (g) => {
    setSelectedGreeks(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Greeks Explorer</h1>
        <p className="text-xs text-gray-500 mt-1">Interactive visualization of Black-Scholes option Greeks</p>
      </div>

      {/* Controls */}
      <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div>
            <Label className="text-xs text-gray-400 mb-1">Strike (K)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[params.K]} onValueChange={([v]) => update('K', v)} min={50} max={150} step={1} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-8">{params.K}</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Volatility (σ)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[params.sigma * 100]} onValueChange={([v]) => update('sigma', v / 100)} min={5} max={80} step={1} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-10">{(params.sigma*100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Maturity (T)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[params.T * 12]} onValueChange={([v]) => update('T', v / 12)} min={1} max={24} step={1} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-10">{(params.T*12).toFixed(0)}mo</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Rate (r)</Label>
            <div className="flex items-center gap-2">
              <Slider value={[params.r * 100]} onValueChange={([v]) => update('r', v / 100)} min={0} max={15} step={0.25} className="flex-1" />
              <span className="text-xs font-mono text-gray-400 w-10">{(params.r*100).toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Type</Label>
            <Select value={params.optionType} onValueChange={v => update('optionType', v)}>
              <SelectTrigger className="bg-[#0a0b0f] border-gray-800 text-white text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="put">Put</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1">Show</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {GREEKS.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGreek(g)}
                  className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider border transition-all ${
                    selectedGreeks.includes(g)
                      ? 'border-gray-600 text-white'
                      : 'border-gray-800 text-gray-600'
                  }`}
                  style={selectedGreeks.includes(g) ? { color: COLORS[g], borderColor: COLORS[g] + '40' } : {}}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Greeks vs Spot Price</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spotData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="spot" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }} />
                <Tooltip contentStyle={{ background: '#1a1b23', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selectedGreeks.map(g => (
                  <Line key={g} dataKey={g} stroke={COLORS[g]} dot={false} strokeWidth={2} name={g.charAt(0).toUpperCase() + g.slice(1)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#12131a] border border-gray-800/50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Greeks vs Time to Expiry (ATM)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="daysToExpiry" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }} reversed />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }} />
                <Tooltip contentStyle={{ background: '#1a1b23', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selectedGreeks.map(g => (
                  <Line key={g} dataKey={g} stroke={COLORS[g]} dot={false} strokeWidth={2} name={g.charAt(0).toUpperCase() + g.slice(1)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
