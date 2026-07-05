/**
 * Black-Scholes Option Pricing & Greeks
 * 
 * Implements analytical Black-Scholes formulas for European options.
 * All formulas follow Hull (Options, Futures, and Other Derivatives).
 * 
 * Conventions:
 *   S  = spot price of underlying
 *   K  = strike price
 *   T  = time to maturity (years)
 *   r  = risk-free rate (annualized, continuous compounding)
 *   σ  = volatility (annualized)
 *   q  = continuous dividend yield (default 0)
 */

// Standard normal CDF via Abramowitz & Stegun approximation (max error ~1.5e-7)
export function normCDF(x) {
  if (x > 10) return 1.0;
  if (x < -10) return 0.0;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2.0);
  return 0.5 * (1.0 + sign * y);
}

// Standard normal PDF
export function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
}

/**
 * Compute d1 and d2 for Black-Scholes formula.
 * Handles edge cases near maturity (T → 0).
 */
export function computeD1D2(S, K, T, r, sigma, q = 0) {
  if (T <= 1e-10) {
    // At expiry: option is either deep ITM or OTM
    const intrinsic = Math.log(S / K);
    return {
      d1: intrinsic > 0 ? 1e10 : intrinsic < 0 ? -1e10 : 0,
      d2: intrinsic > 0 ? 1e10 : intrinsic < 0 ? -1e10 : 0
    };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return { d1, d2 };
}

/**
 * European call option price.
 */
export function callPrice(S, K, T, r, sigma, q = 0) {
  if (T <= 1e-10) return Math.max(S - K, 0);
  const { d1, d2 } = computeD1D2(S, K, T, r, sigma, q);
  return S * Math.exp(-q * T) * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
}

/**
 * European put option price.
 */
export function putPrice(S, K, T, r, sigma, q = 0) {
  if (T <= 1e-10) return Math.max(K - S, 0);
  const { d1, d2 } = computeD1D2(S, K, T, r, sigma, q);
  return K * Math.exp(-r * T) * normCDF(-d2) - S * Math.exp(-q * T) * normCDF(-d1);
}

/**
 * Option price (call or put).
 */
export function optionPrice(S, K, T, r, sigma, optionType = 'call', q = 0) {
  return optionType === 'call'
    ? callPrice(S, K, T, r, sigma, q)
    : putPrice(S, K, T, r, sigma, q);
}

/**
 * Greeks for European options.
 * Returns: { delta, gamma, theta, vega, rho }
 */
export function greeks(S, K, T, r, sigma, optionType = 'call', q = 0) {
  if (T <= 1e-10) {
    const itm = optionType === 'call' ? S > K : S < K;
    return {
      delta: itm ? (optionType === 'call' ? 1.0 : -1.0) : 0.0,
      gamma: 0.0,
      theta: 0.0,
      vega: 0.0,
      rho: 0.0
    };
  }

  const { d1, d2 } = computeD1D2(S, K, T, r, sigma, q);
  const sqrtT = Math.sqrt(T);
  const nd1 = normPDF(d1);
  const expQT = Math.exp(-q * T);
  const expRT = Math.exp(-r * T);

  // Gamma is the same for calls and puts
  const gamma = (expQT * nd1) / (S * sigma * sqrtT);

  // Vega is the same for calls and puts (per 1 unit, i.e., dV/dσ)
  const vega = S * expQT * nd1 * sqrtT;

  let delta, theta, rho;

  if (optionType === 'call') {
    delta = expQT * normCDF(d1);
    theta = -(S * sigma * expQT * nd1) / (2 * sqrtT)
            - r * K * expRT * normCDF(d2)
            + q * S * expQT * normCDF(d1);
    rho = K * T * expRT * normCDF(d2);
  } else {
    delta = expQT * (normCDF(d1) - 1);
    theta = -(S * sigma * expQT * nd1) / (2 * sqrtT)
            + r * K * expRT * normCDF(-d2)
            - q * S * expQT * normCDF(-d1);
    rho = -K * T * expRT * normCDF(-d2);
  }

  return { delta, gamma, theta, vega, rho };
}

/**
 * Implied volatility via Newton-Raphson.
 * Returns NaN if convergence fails.
 */
export function impliedVolatility(marketPrice, S, K, T, r, optionType = 'call', q = 0, tol = 1e-8, maxIter = 100) {
  let sigma = 0.2; // initial guess
  for (let i = 0; i < maxIter; i++) {
    const price = optionPrice(S, K, T, r, sigma, optionType, q);
    const v = greeks(S, K, T, r, sigma, optionType, q).vega;
    if (Math.abs(v) < 1e-12) break;
    const diff = price - marketPrice;
    if (Math.abs(diff) < tol) return sigma;
    sigma -= diff / v;
    if (sigma <= 0) sigma = 0.001;
  }
  return NaN;
}
