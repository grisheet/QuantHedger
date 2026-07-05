/**
 * Hedging Simulation Engine
 * 
 * Runs a discrete-time hedging simulation for a European option position.
 * Supports multiple hedging strategies and tracks full P&L accounting
 * including transaction costs and bid-ask spreads.
 * 
 * P&L Accounting:
 *   At each step t:
 *     1. Observe new spot price S(t)
 *     2. Compute option value V(t) and Greeks
 *     3. Determine target hedge Δ_target via strategy
 *     4. Execute hedge adjustment: trade = Δ_target - Δ_current
 *     5. Pay transaction costs: |trade| × S(t) × costRate + |trade| × spread/2
 *     6. Track cumulative P&L
 *   
 *   At maturity:
 *     Final P&L = option_payoff - initial_option_premium + hedge_gains - total_costs
 */

import { optionPrice, greeks } from '@/lib/pricing/black-scholes';

/**
 * @typedef {Object} HedgingConfig
 * @property {number} S0 - Initial spot price
 * @property {number} K - Strike price
 * @property {number} T - Time to maturity (years)
 * @property {number} r - Risk-free rate
 * @property {number} sigma - Volatility (for BS pricing)
 * @property {'call'|'put'} optionType
 * @property {number} txCostRate - Transaction cost as fraction of notional
 * @property {number} bidAskSpread - Bid-ask spread in price units
 * @property {'short'|'long'} position - Whether we are short or long the option
 */

/**
 * Run a hedging simulation on a single price path.
 * 
 * @param {Float64Array} pricePath - Simulated price path (length = nSteps + 1)
 * @param {HedgingConfig} config - Hedging configuration
 * @param {Function} strategyFn - (state) => targetDelta
 * @returns {Object} Simulation results with step-by-step accounting
 */
export function simulateHedging(pricePath, config, strategyFn) {
  const {
    K, T, r, sigma, optionType = 'call',
    txCostRate = 0.001, bidAskSpread = 0.0,
    position = 'short'
  } = config;

  const nSteps = pricePath.length - 1;
  const dt = T / nSteps;
  const posSign = position === 'short' ? -1 : 1;

  // Initial option premium (received if short, paid if long)
  const initialPremium = optionPrice(pricePath[0], K, T, r, sigma, optionType);

  // Step-by-step tracking
  const steps = [];
  let currentDelta = 0;       // current hedge position (units of underlying)
  let cumulativeCost = 0;     // total transaction costs paid
  let hedgePnL = 0;           // cumulative P&L from hedge rebalancing
  let cashAccount = -posSign * initialPremium; // cash from selling/buying option

  for (let t = 0; t <= nSteps; t++) {
    const S = pricePath[t];
    const tau = T - t * dt; // time to maturity remaining
    const clampedTau = Math.max(tau, 0);

    // Current option value and greeks
    const V = optionPrice(S, K, clampedTau, r, sigma, optionType);
    const g = greeks(S, K, clampedTau, r, sigma, optionType);

    // Build state for strategy
    const state = {
      step: t,
      nSteps,
      S,
      K,
      T,
      tau: clampedTau,
      r,
      sigma,
      optionType,
      optionPrice: V,
      delta: g.delta,
      gamma: g.gamma,
      theta: g.theta,
      vega: g.vega,
      currentHedge: currentDelta,
      position,
      posSign,
      cumulativeCost,
      hedgePnL
    };

    // Get target hedge from strategy
    let targetDelta;
    if (t === nSteps) {
      // At maturity, unwind all hedges
      targetDelta = 0;
    } else {
      targetDelta = strategyFn(state);
    }

    // Execute hedge adjustment
    const trade = targetDelta - currentDelta;
    const tradeCost = Math.abs(trade) * S * txCostRate + Math.abs(trade) * bidAskSpread / 2;
    cumulativeCost += tradeCost;

    // Cash flow from trading underlying
    // Buying trade units costs trade * S
    cashAccount -= trade * S;
    cashAccount -= tradeCost;

    // Track P&L from hedge position value change
    if (t > 0) {
      const priceChange = pricePath[t] - pricePath[t - 1];
      hedgePnL += currentDelta * priceChange;
    }

    currentDelta = targetDelta;

    // Option P&L at this step
    const optionValue = posSign * V;

    steps.push({
      step: t,
      time: t * dt,
      tau: clampedTau,
      spotPrice: S,
      optionPrice: V,
      delta: g.delta,
      gamma: g.gamma,
      theta: g.theta,
      vega: g.vega,
      targetHedge: targetDelta,
      trade,
      tradeCost,
      cumulativeCost,
      currentHedge: currentDelta,
      hedgePnL,
      cashAccount
    });
  }

  // Final P&L calculation
  const finalSpot = pricePath[nSteps];
  const payoff = optionType === 'call'
    ? Math.max(finalSpot - K, 0)
    : Math.max(K - finalSpot, 0);

  // Total P&L = option position P&L + hedge P&L - costs
  // If short option: received premium, pay payoff, earned hedge gains, paid costs
  const optionPnL = -posSign * initialPremium + posSign * payoff;
  const totalPnL = -optionPnL + hedgePnL - cumulativeCost;
  // Hedging error = how far from perfect hedge
  const hedgingError = totalPnL; // ideally 0 for perfect hedge

  return {
    initialPremium,
    payoff,
    optionPnL,
    hedgePnL,
    totalCosts: cumulativeCost,
    totalPnL,
    hedgingError,
    finalSpot,
    steps
  };
}

/**
 * Run hedging simulation across multiple paths.
 * Returns aggregate statistics.
 */
export function runBacktest(paths, config, strategyFn) {
  const results = paths.map(path => simulateHedging(path, config, strategyFn));

  const pnls = results.map(r => r.totalPnL);
  const hedgingErrors = results.map(r => r.hedgingError);
  const costs = results.map(r => r.totalCosts);

  return {
    results,
    metrics: computeMetrics(pnls, hedgingErrors, costs)
  };
}

/**
 * Compute risk metrics from P&L array.
 */
export function computeMetrics(pnls, hedgingErrors, costs) {
  const n = pnls.length;
  const sorted = [...pnls].sort((a, b) => a - b);

  const mean = pnls.reduce((s, x) => s + x, 0) / n;
  const variance = pnls.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);

  // CVaR (Expected Shortfall) at 5%
  const cvarIdx = Math.max(1, Math.floor(n * 0.05));
  const cvar5 = sorted.slice(0, cvarIdx).reduce((s, x) => s + x, 0) / cvarIdx;

  // VaR at 5%
  const var5 = sorted[Math.floor(n * 0.05)];

  // VaR at 1%
  const var1 = sorted[Math.floor(n * 0.01)];

  // Max drawdown (worst single path P&L)
  const maxDrawdown = sorted[0];

  // Sharpe-like ratio (mean / std)
  const sharpe = std > 0 ? mean / std : 0;

  // Hedging error stats
  const heMean = hedgingErrors.reduce((s, x) => s + x, 0) / n;
  const heStd = Math.sqrt(hedgingErrors.reduce((s, x) => s + (x - heMean) ** 2, 0) / (n - 1));

  // Cost stats
  const meanCost = costs.reduce((s, x) => s + x, 0) / n;

  // Percentiles
  const p5 = sorted[Math.floor(n * 0.05)];
  const p25 = sorted[Math.floor(n * 0.25)];
  const p50 = sorted[Math.floor(n * 0.50)];
  const p75 = sorted[Math.floor(n * 0.75)];
  const p95 = sorted[Math.floor(n * 0.95)];

  return {
    mean,
    std,
    variance,
    var5,
    var1,
    cvar5,
    maxDrawdown,
    sharpe,
    heMean,
    heStd,
    meanCost,
    percentiles: { p5, p25, p50, p75, p95 },
    n
  };
}
