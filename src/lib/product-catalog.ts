import { secondSupabase } from '@/lib/second-supabase';
import { Product } from '@/types';

export interface ProductQueryOptions {
  q?: string;
  category?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  branchId?: number;
  inStockOnly?: boolean;
  limit?: number;
  sortBy?: 'popularity' | 'price-asc' | 'price-desc';
}

export interface ProductSuggestion {
  id: string;
  name: string;
  category: string;
}

const normalize = (value: string) => value.trim().toLowerCase();

type SecondDatabaseProductRow = {
  id: number | string;
  name: string | null;
  price: number | string | null;
  stock: number | string | null;
  category: string | null;
  low_stock_threshold?: number | string | null;
};

const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800&h=800';

const toNumber = (value: number | string | null | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildProductDescription = (row: SecondDatabaseProductRow) => {
  const stock = toNumber(row.stock);
  const threshold = toNumber(row.low_stock_threshold);

  if (threshold > 0 && stock > 0 && stock <= threshold) {
    return `Limited stocks available in ${row.category ?? 'this category'}.`;
  }

  if (stock > 0) {
    return `${row.category ?? 'Product'} item with ${stock} units currently available.`;
  }

  return `${row.category ?? 'Product'} item currently unavailable.`;
};

const mapSecondDatabaseProduct = (row: SecondDatabaseProductRow): Product => {
  const id = String(row.id);
  const category = row.category?.trim() || 'Uncategorized';

  return {
    id,
    name: row.name?.trim() || `Product ${id}`,
    description: buildProductDescription(row),
    price: toNumber(row.price),
    category,
    image: `${FALLBACK_PRODUCT_IMAGE}&sig=${encodeURIComponent(id)}`,
    images: [],
    specifications: {
      Category: category,
      Stock: String(toNumber(row.stock)),
    },
    stock: toNumber(row.stock),
  };
};

const fetchCatalogProducts = async (): Promise<Product[]> => {
  const { data, error } = await secondSupabase
    .from('products')
    .select('id, name, price, stock, category, low_stock_threshold')
    .order('id', { ascending: true });

  if (error) {
    console.error('Second database product fetch failed:', error);
    return [];
  }

  return (data ?? []).map((row) =>
    mapSecondDatabaseProduct(row as SecondDatabaseProductRow)
  );
};

const tokenize = (value: string) =>
  normalize(value)
    .split(/\s+/)
    .filter(Boolean);

const scoreProduct = (product: Product, query: string) => {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return 0;
  }

  const tokens = tokenize(normalizedQuery);
  const name = normalize(product.name);
  const description = normalize(product.description);

  let score = 0;

  if (name === normalizedQuery) score += 1200;
  if (name.startsWith(normalizedQuery)) score += 900;
  if (name.includes(normalizedQuery)) score += 700;
  if (description.includes(normalizedQuery)) score += 180;

  const nameTokenMatches = tokens.filter((token) => name.includes(token)).length;
  const descriptionTokenMatches = tokens.filter((token) =>
    description.includes(token)
  ).length;

  if (nameTokenMatches === tokens.length) score += 450;
  score += nameTokenMatches * 90;
  score += descriptionTokenMatches * 20;

  return score;
};

const sortProducts = (
  products: Product[],
  query?: string,
  sortBy: ProductQueryOptions['sortBy'] = 'popularity'
) => {
  if (sortBy === 'price-asc') {
    return [...products].sort((a, b) => a.price - b.price);
  }

  if (sortBy === 'price-desc') {
    return [...products].sort((a, b) => b.price - a.price);
  }

  const normalizedQuery = query?.trim();

  if (!normalizedQuery) {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }

  return [...products]
    .map((product) => ({
      product,
      score: scoreProduct(product, normalizedQuery),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.product.name.localeCompare(b.product.name);
    })
    .map(({ product }) => product);
};

export async function queryProducts(options: ProductQueryOptions = {}) {
  const catalogProducts = await fetchCatalogProducts();
  const normalizedCategory = options.category?.trim();
  const normalizedCategories = (options.categories ?? [])
    .map((category) => category.trim().toLowerCase())
    .filter((category) => category && category !== 'all');
  let filtered = catalogProducts.filter((product) => {
    if (normalizedCategories.length > 0) {
      if (!normalizedCategories.includes(product.category.toLowerCase())) {
        return false;
      }
    }

    if (normalizedCategory && normalizedCategory !== 'All') {
      if (product.category.toLowerCase() !== normalizedCategory.toLowerCase()) {
        return false;
      }
    }

    if (typeof options.minPrice === 'number' && product.price < options.minPrice) {
      return false;
    }

    if (typeof options.maxPrice === 'number' && product.price > options.maxPrice) {
      return false;
    }

    return true;
  });

  if (options.inStockOnly) {
    filtered = filtered.filter((product) => (product.stock ?? 0) > 0);
  }

  const searched = sortProducts(filtered, options.q, options.sortBy);

  if (typeof options.limit === 'number' && options.limit > 0) {
    return searched.slice(0, options.limit);
  }

  return searched;
}

export async function getProductSuggestions(
  query: string,
  limit = 8
): Promise<ProductSuggestion[]> {
  if (!query.trim()) {
    return [];
  }

  const matches = await queryProducts({ q: query, limit });

  return matches.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
  }));
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return [];
  }

  const products = await fetchCatalogProducts();
  const productsById = new Map(products.map((product) => [product.id, product]));

  return uniqueIds
    .map((id) => productsById.get(id))
    .filter((product): product is Product => Boolean(product));
}
