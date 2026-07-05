/**
 * Geometric Brownian Motion (GBM) Path Simulator
 * 
 * Generates sample paths of a stock price process:
 *   dS = μ·S·dt + σ·S·dW
 * 
 * where W is a standard Brownian motion.
 * 
 * We use the exact (log-normal) solution rather than Euler-Maruyama
 * to avoid discretization bias:
 *   S(t+dt) = S(t) · exp((μ - σ²/2)·dt + σ·√dt·Z)
 * where Z ~ N(0,1).
 */

/**
 * Box-Muller transform: generates pairs of independent standard normals.
 */
function boxMuller() {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  const mag = Math.sqrt(-2.0 * Math.log(u1));
  return [mag * Math.cos(2.0 * Math.PI * u2), mag * Math.sin(2.0 * Math.PI * u2)];
}

/**
 * Generate N standard normal random variates.
 */
export function randn(n) {
  const result = new Float64Array(n);
  for (let i = 0; i < n - 1; i += 2) {
    const [z1, z2] = boxMuller();
    result[i] = z1;
    result[i + 1] = z2;
  }
  if (n % 2 === 1) {
    const [z1] = boxMuller();
    result[n - 1] = z1;
  }
  return result;
}

/**
 * Generate a single GBM price path.
 * 
 * @param {number} S0     - Initial spot price
 * @param {number} mu     - Drift (annualized)
 * @param {number} sigma  - Volatility (annualized)
 * @param {number} T      - Total time horizon (years)
 * @param {number} nSteps - Number of time steps
 * @returns {Float64Array} Price path of length nSteps + 1 (includes S0)
 */
export function generatePath(S0, mu, sigma, T, nSteps) {
  const dt = T / nSteps;
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);
  const path = new Float64Array(nSteps + 1);
  path[0] = S0;
  const normals = randn(nSteps);
  for (let i = 0; i < nSteps; i++) {
    path[i + 1] = path[i] * Math.exp(drift + diffusion * normals[i]);
  }
  return path;
}

/**
 * Generate multiple GBM paths (Monte Carlo ensemble).
 * 
 * @param {number} S0      - Initial spot price
 * @param {number} mu      - Drift (annualized)
 * @param {number} sigma   - Volatility (annualized)
 * @param {number} T       - Total time horizon (years)
 * @param {number} nSteps  - Number of time steps per path
 * @param {number} nPaths  - Number of paths to simulate
 * @returns {Float64Array[]} Array of price paths
 */
export function generatePaths(S0, mu, sigma, T, nSteps, nPaths) {
  const paths = [];
  for (let p = 0; p < nPaths; p++) {
    paths.push(generatePath(S0, mu, sigma, T, nSteps));
  }
  return paths;
}

/**
 * Generate correlated GBM paths for multiple assets.
 * Uses Cholesky decomposition for correlation.
 * 
 * @param {number[]} S0s       - Initial spot prices
 * @param {number[]} mus       - Drifts
 * @param {number[]} sigmas    - Volatilities
 * @param {number[][]} corrMatrix - Correlation matrix
 * @param {number} T           - Time horizon
 * @param {number} nSteps      - Time steps
 * @returns {Float64Array[][]} paths[asset][path]
 */
export function generateCorrelatedPaths(S0s, mus, sigmas, corrMatrix, T, nSteps, nPaths) {
  const nAssets = S0s.length;
  const dt = T / nSteps;

  // Cholesky decomposition of correlation matrix
  const L = choleskyDecomposition(corrMatrix);

  const allPaths = S0s.map(() => []);

  for (let p = 0; p < nPaths; p++) {
    const paths = S0s.map((s0) => {
      const path = new Float64Array(nSteps + 1);
      path[0] = s0;
      return path;
    });

    for (let t = 0; t < nSteps; t++) {
      const z = randn(nAssets);
      // Correlate the normals: w = L * z
      const w = new Float64Array(nAssets);
      for (let i = 0; i < nAssets; i++) {
        w[i] = 0;
        for (let j = 0; j <= i; j++) {
          w[i] += L[i][j] * z[j];
        }
      }
      for (let i = 0; i < nAssets; i++) {
        const drift = (mus[i] - 0.5 * sigmas[i] * sigmas[i]) * dt;
        const diffusion = sigmas[i] * Math.sqrt(dt) * w[i];
        paths[i][t + 1] = paths[i][t] * Math.exp(drift + diffusion);
      }
    }

    for (let i = 0; i < nAssets; i++) {
      allPaths[i].push(paths[i]);
    }
  }

  return allPaths;
}

function choleskyDecomposition(matrix) {
  const n = matrix.length;
  const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(matrix[i][i] - sum, 0));
      } else {
        L[i][j] = (matrix[i][j] - sum) / (L[j][j] || 1e-10);
      }
    }
  }
  return L;
}
