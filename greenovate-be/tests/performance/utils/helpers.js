import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL =
  __ENV.BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:4000';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Logs in and returns a Bearer token string, or null on failure.
 * Called from setup() so the token is shared across all scenarios.
 */
export function loginAndGetToken(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS },
  );

  const ok = check(res, { '[setup] login succeeded': (r) => r.status === 200 });
  if (!ok) {
    console.error(`Login failed (${res.status}): ${res.body}`);
    return null;
  }

  return JSON.parse(res.body).token;
}

export function authHeaders(token) {
  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

// ── Product browsing ──────────────────────────────────────────────────────────

export function browseProducts() {
  const res = http.get(`${BASE_URL}/api/products`, {
    tags: { flow: 'browse' },
  });
  check(res, {
    '[browse] product list 200': (r) => r.status === 200,
    '[browse] has data': (r) => {
      try { return Array.isArray(JSON.parse(r.body)); } catch { return false; }
    },
  });
  return res;
}

export function searchProducts(query) {
  const res = http.get(
    `${BASE_URL}/api/products/search?q=${encodeURIComponent(query)}`,
    { tags: { flow: 'browse' } },
  );
  check(res, { '[browse] search 200': (r) => r.status === 200 });
  return res;
}

// ── Checkout flow ─────────────────────────────────────────────────────────────

export function getDeliveryEstimate(token) {
  const res = http.post(
    `${BASE_URL}/api/delivery/estimate`,
    JSON.stringify({
      address: '123 Test Street',
      city: 'Manila',
      province: 'Metro Manila',
    }),
    { headers: authHeaders(token), tags: { flow: 'checkout' } },
  );
  check(res, { '[checkout] delivery estimate 200': (r) => r.status === 200 });
  return res;
}

export function placeOrder(token, items, shippingAddress, deliveryFee = 50) {
  const res = http.post(
    `${BASE_URL}/api/orders/place`,
    JSON.stringify({
      shippingAddress,
      paymentMethod: 'Cash on Delivery',
      deliveryFee,
      items,
    }),
    { headers: authHeaders(token), tags: { flow: 'checkout' } },
  );
  check(res, {
    '[checkout] order placed 200': (r) => r.status === 200,
    '[checkout] has receiptNumber': (r) => {
      try { return !!JSON.parse(r.body).order?.receiptNumber; } catch { return false; }
    },
  });
  return res;
}

// ── Order history ─────────────────────────────────────────────────────────────

export function getOrderHistory(token) {
  const res = http.get(`${BASE_URL}/api/orders/search?limit=10`, {
    headers: authHeaders(token),
    tags: { flow: 'orders' },
  });
  check(res, { '[orders] history 200': (r) => r.status === 200 });
  return res;
}
