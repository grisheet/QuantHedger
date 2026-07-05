/**
 * Hedging Strategy Library
 * 
 * Each strategy is a function: (state) => targetDelta
 * where state contains current market information and hedge position.
 * 
 * Strategies:
 *   1. No Hedge: Always hold zero units of underlying
 *   2. BS Delta Hedge: Replicate the Black-Scholes delta at each rebalance
 *   3. BS Delta-Gamma Hedge: Delta hedge with gamma-aware adjustments
 *   4. Adaptive RL-inspired: Uses a simple policy gradient heuristic
 */

/**
 * No hedging — naked option position.
 * Serves as a lower bound on hedging performance.
 */
export function noHedgeStrategy(_state) {
  return 0;
}

/**
 * Black-Scholes discrete delta hedge.
 * At each rebalance, set hedge to BS delta (adjusted for position).
 * This is the classical benchmark.
 */
export function bsDeltaStrategy(state) {
  const { delta, posSign } = state;
  // If short a call with delta 0.5, we hold +0.5 units to hedge
  return -posSign * delta;
}

/**
 * Delta-Gamma hedge with bandwidth.
 * Only rebalances when delta moves beyond a threshold,
 * reducing transaction costs for a small increase in hedging error.
 */
export function bsDeltaGammaStrategy(state) {
  const { delta, gamma, posSign, currentHedge, S } = state;
  const targetDelta = -posSign * delta;
  const bandwidth = 0.02; // only rebalance if delta deviation > 2%

  if (Math.abs(targetDelta - currentHedge) < bandwidth) {
    return currentHedge; // no rebalance needed
  }

  // Gamma-aware: slightly over-hedge in direction of gamma
  // This reduces expected future rebalancing
  const gammaAdj = 0.5 * gamma * S * 0.01; // small gamma tilt
  return targetDelta + posSign * gammaAdj;
}

/**
 * Adaptive RL-inspired strategy.
 * 
 * Uses a heuristic policy that adapts based on recent P&L and
 * market conditions. This mimics what an RL agent would learn:
 * - Base position from BS delta
 * - Adjust for transaction cost awareness (wider bands when costs high)
 * - Mean-revert hedge ratio when hedging error accumulates
 * - Risk-averse tilt near maturity
 * 
 * This is NOT a trained neural network — it's a hand-crafted policy
 * that demonstrates the kind of behavior RL agents learn.
 */
export function adaptiveRLStrategy(state) {
  const {
    delta, gamma, vega, posSign, currentHedge, S, tau, T,
    sigma, hedgePnL, cumulativeCost
  } = state;

  const baseDelta = -posSign * delta;
  
  // 1. Transaction cost awareness: widen rebalance band proportional to cost rate
  const costAwareBand = 0.01 + 0.03 * (cumulativeCost / (S * 0.1 + 1));
  
  // 2. Time-aware urgency: tighten bands near maturity
  const timeUrgency = tau > 0 ? Math.max(0.5, tau / T) : 1.0;
  const effectiveBand = costAwareBand * timeUrgency;

  if (Math.abs(baseDelta - currentHedge) < effectiveBand) {
    return currentHedge;
  }

  // 3. Gamma scalping tilt: when gamma is high, slight over-hedge
  const gammaTilt = 0.3 * gamma * S * 0.01 * posSign;

  // 4. Volatility regime adjustment: in high-vol, hedge more conservatively
  const volAdj = sigma > 0.3 ? 0.98 : 1.0; // slightly under-hedge in high vol

  // 5. P&L feedback: if we're losing money, tighten the hedge
  const pnlFeedback = hedgePnL < 0 ? 1.02 : 1.0;

  const target = baseDelta * volAdj * pnlFeedback - gammaTilt;

  // Clip to reasonable range
  return Math.max(-2, Math.min(2, target));
}

/**
 * Get strategy function by name.
 */
export function getStrategy(name) {
  const strategies = {
    no_hedge: noHedgeStrategy,
    bs_delta: bsDeltaStrategy,
    bs_delta_gamma: bsDeltaGammaStrategy,
    adaptive_rl: adaptiveRLStrategy
  };
  return strategies[name] || bsDeltaStrategy;
}

/**
 * Strategy metadata for UI.
 */
export const STRATEGY_INFO = {
  no_hedge: {
    name: 'No Hedge',
    description: 'Naked option position — no hedging at all. Lower bound benchmark.',
    color: '#ef4444'
  },
  bs_delta: {
    name: 'BS Delta Hedge',
    description: 'Classical Black-Scholes discrete delta hedging. Industry standard benchmark.',
    color: '#3b82f6'
  },
  bs_delta_gamma: {
    name: 'Delta-Gamma Hedge',
    description: 'Delta hedge with gamma-aware adjustments and rebalance bandwidth to reduce costs.',
    color: '#8b5cf6'
  },
  adaptive_rl: {
    name: 'Adaptive RL Policy',
    description: 'RL-inspired heuristic policy with cost awareness, gamma scalping, and P&L feedback.',
    color: '#10b981'
  }
};
