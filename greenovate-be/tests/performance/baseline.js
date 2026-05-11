/**
 * OOS-205 / OOS-208 — Baseline load test with weighted traffic distribution.
 *
 * Traffic weights (mirrors realistic pharmacy e-commerce usage):
 *   60% — product browsing  (high-frequency, read-only)
 *   25% — order history     (authenticated reads)
 *   15% — checkout flow     (highest value, most complex)
 *
 * Run:
 *   k6 run tests/performance/baseline.js \
 *     -e BASE_URL=http://localhost:4000 \
 *     -e TEST_EMAIL=youruser@email.com \
 *     -e TEST_PASSWORD=yourpassword \
 *     -e TEST_PRODUCT_ID=prod-aaa
 *
 * To output a JSON summary for documentation:
 *   k6 run --out json=tests/performance/results/baseline-$(date +%Y%m%d).json \
 *     tests/performance/baseline.js ...
 */

import { sleep } from 'k6';
import {
  BASE_URL,
  loginAndGetToken,
  browseProducts,
  searchProducts,
  getDeliveryEstimate,
  placeOrder,
  getOrderHistory,
} from './utils/helpers.js';

// ── Thresholds (OOS-209) ──────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // 60% — product browsing (6 iterations/s)
    browse_products: {
      executor: 'constant-arrival-rate',
      rate: 6,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 15,
      maxVUs: 30,
      tags: { scenario: 'browse_products' },
    },

    // 25% — order history (2 iterations/s, delayed 10s so login completes)
    order_history: {
      executor: 'constant-arrival-rate',
      rate: 2,
      timeUnit: '1s',
      duration: '3m',
      startTime: '10s',
      preAllocatedVUs: 8,
      maxVUs: 15,
      tags: { scenario: 'order_history' },
    },

    // 15% — full checkout (1 iteration/s, delayed 10s)
    checkout_flow: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '3m',
      startTime: '10s',
      preAllocatedVUs: 5,
      maxVUs: 10,
      tags: { scenario: 'checkout_flow' },
    },
  },

  thresholds: {
    // Overall latency
    http_req_duration: [
      { threshold: 'p(95)<500',  abortOnFail: false },
      { threshold: 'p(99)<1500', abortOnFail: false },
    ],

    // Overall error rate must stay below 1%
    http_req_failed: [
      { threshold: 'rate<0.01', abortOnFail: true },
    ],

    // Per-scenario latency — checkout is more lenient (DB + POS calls)
    'http_req_duration{scenario:browse_products}': [
      { threshold: 'p(95)<300', abortOnFail: false },
    ],
    'http_req_duration{scenario:order_history}': [
      { threshold: 'p(95)<500', abortOnFail: false },
    ],
    'http_req_duration{scenario:checkout_flow}': [
      { threshold: 'p(95)<1500', abortOnFail: false },
    ],

    // Per-flow checks pass rate
    'checks{flow:browse}':   [{ threshold: 'rate>0.99', abortOnFail: false }],
    'checks{flow:checkout}': [{ threshold: 'rate>0.95', abortOnFail: false }],
    'checks{flow:orders}':   [{ threshold: 'rate>0.99', abortOnFail: false }],
  },
};

// ── Setup — runs once before all scenarios ────────────────────────────────────

export function setup() {
  const email    = __ENV.TEST_EMAIL    || '';
  const password = __ENV.TEST_PASSWORD || '';

  if (!email || !password) {
    console.warn(
      '[baseline] TEST_EMAIL / TEST_PASSWORD not set — ' +
      'authenticated scenarios will be skipped.',
    );
    return { token: null };
  }

  const token = loginAndGetToken(email, password);
  return { token };
}

// ── Scenario: product browsing ────────────────────────────────────────────────

export function browse_products() {
  // Alternate between listing and searching to simulate natural browsing
  const searchTerms = ['bandage', 'vitamin', 'loratadine', 'paracetamol', 'mask'];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

  if (Math.random() < 0.5) {
    browseProducts();
  } else {
    searchProducts(term);
  }

  sleep(randomBetween(0.5, 1.5));
}

// ── Scenario: order history ───────────────────────────────────────────────────

export function order_history(data) {
  if (!data.token) return;
  getOrderHistory(data.token);
  sleep(randomBetween(1, 2));
}

// ── Scenario: checkout flow ───────────────────────────────────────────────────

export function checkout_flow(data) {
  if (!data.token) return;

  const productId = __ENV.TEST_PRODUCT_ID || 'prod-test-001';
  const shippingAddress = '123 Rizal Avenue, Manila, Metro Manila';

  // Step 1 — check delivery estimate
  getDeliveryEstimate(data.token);
  sleep(randomBetween(0.5, 1));

  // Step 2 — place order
  placeOrder(
    data.token,
    [{ id: productId, quantity: 1 }],
    shippingAddress,
    50,
  );

  sleep(randomBetween(1, 2));
}

// ── Default export required by k6 (unused — scenarios handle execution) ───────

export default function () {}

// ── Util ──────────────────────────────────────────────────────────────────────

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
