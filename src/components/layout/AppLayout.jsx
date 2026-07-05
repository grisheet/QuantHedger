import { Outlet, Link, useLocation } from 'react-router-dom';
import { BarChart3, FlaskConical, Home, GitBranch, TrendingUp, Layers, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/simulator', label: 'Simulator', icon: FlaskConical },
  { path: '/backtest', label: 'Backtest', icon: BarChart3 },
  { path: '/comparison', label: 'Strategy Compare', icon: Layers },
  { path: '/stress-test', label: 'Stress Test', icon: Zap },
  { path: '/experiments', label: 'Experiments', icon: GitBranch },
  { path: '/greeks', label: 'Greeks Explorer', icon: TrendingUp },
];

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800/60 bg-[#0d0e14] flex flex-col shrink-0 hidden md:flex">
        <div className="p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sm tracking-wide text-white">RL Hedging</h1>
              <p className="text-[10px] text-gray-500 tracking-widest uppercase">Research Engine</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800/60">
          <div className="text-[10px] text-gray-600 tracking-wide">
            <p>Simulation Only</p>
            <p className="mt-1">GBM · Black-Scholes · RL Policies</p>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d0e14] border-b border-gray-800/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-white">RL Hedging</span>
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto md:p-0 pt-24 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
