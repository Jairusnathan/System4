'use client';

const STORAGE_KEY = 'pharma_browse_history';
const MAX_VIEWS = 60;
const MIN_VIEWS_FOR_PERSONALIZATION = 3;

interface ViewRecord {
  productId: string;
  category: string;
  viewedAt: number;
}

function readHistory(): ViewRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeHistory(history: ViewRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_VIEWS)));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function recordProductView(productId: string, category: string) {
  // Remove existing entry for this product so it moves to top
  const history = readHistory().filter((r) => r.productId !== productId);
  history.unshift({ productId, category, viewedAt: Date.now() });
  writeHistory(history);
}

export function buildInterestProfile(): Map<string, number> {
  const history = readHistory();
  if (history.length < MIN_VIEWS_FOR_PERSONALIZATION) return new Map();

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const scores = new Map<string, number>();

  history.forEach((record, index) => {
    const daysAgo = (now - record.viewedAt) / ONE_DAY_MS;
    // Recent views worth more — exponential decay over 7 days
    const recencyWeight = Math.exp(-daysAgo / 7);
    // Earlier in history = higher position weight
    const positionWeight = (MAX_VIEWS - index) / MAX_VIEWS;
    const weight = recencyWeight * positionWeight * 10;

    scores.set(record.category, (scores.get(record.category) ?? 0) + weight);
  });

  return scores;
}

export function applyPersonalization<T extends { category: string; id: string }>(
  products: T[],
): { products: T[]; isPersonalized: boolean; topCategory: string | null } {
  const profile = buildInterestProfile();

  if (profile.size === 0) {
    return { products, isPersonalized: false, topCategory: null };
  }

  const hasAnyInterest = products.some((p) => (profile.get(p.category) ?? 0) > 0);
  if (!hasAnyInterest) {
    return { products, isPersonalized: false, topCategory: null };
  }

  const sorted = [...products].sort((a, b) => {
    const scoreA = profile.get(a.category) ?? 0;
    const scoreB = profile.get(b.category) ?? 0;
    return scoreB - scoreA;
  });

  // Find the category with highest interest score
  const topCategory = [...profile.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { products: sorted, isPersonalized: true, topCategory };
}

export function getBrowseHistoryCount(): number {
  return readHistory().length;
}
