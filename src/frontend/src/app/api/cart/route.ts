import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getProductsByIds } from '@/lib/product-catalog';
import { verifyAccessToken } from '../../../../lib/auth';

type CartPayloadItem = {
  id?: string;
  productId?: string;
  quantity?: number;
};

const getUserIdFromRequest = (request: Request) => {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return null;
  }

  const decoded = verifyAccessToken(token);

  if (!decoded?.userId) {
    return null;
  }

  return decoded.userId as string;
};

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from('cart_items')
      .select('product_id, quantity, created_at')
      .eq('customer_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch cart items error:', error);
      return NextResponse.json({ error: 'Failed to fetch cart items' }, { status: 500 });
    }

    const products = await getProductsByIds((rows ?? []).map((row) => row.product_id));
    const productsById = new Map(products.map((product) => [product.id, product]));

    const items = (rows ?? [])
      .map((row) => {
        const product = productsById.get(row.product_id);

        if (!product) {
          return null;
        }

        return {
          ...product,
          quantity: Math.max(1, Number(row.quantity ?? 1)),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Cart GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const payloadItems = Array.isArray(body?.items) ? (body.items as CartPayloadItem[]) : [];

    const normalizedItems = payloadItems
      .map((item) => ({
        productId: typeof item?.productId === 'string' ? item.productId : item?.id,
        quantity: Number(item?.quantity ?? 0),
      }))
      .filter((item) => typeof item.productId === 'string' && item.productId && Number.isFinite(item.quantity))
      .map((item) => ({
        productId: item.productId as string,
        quantity: Math.max(1, Math.trunc(item.quantity)),
      }));

    const validProducts = await getProductsByIds(normalizedItems.map((item) => item.productId));
    const validProductIds = new Set(validProducts.map((product) => product.id));
    const sanitizedItems = normalizedItems.filter((item) => validProductIds.has(item.productId));

    const mergedItems = Array.from(
      sanitizedItems.reduce((map, item) => {
        const current = map.get(item.productId) ?? 0;
        map.set(item.productId, current + item.quantity);
        return map;
      }, new Map<string, number>())
    ).map(([productId, quantity]) => ({
      customer_id: userId,
      product_id: productId,
      branch_id: null,
      quantity,
    }));

    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('customer_id', userId);

    if (deleteError) {
      console.error('Delete cart items error:', deleteError);
      return NextResponse.json({ error: 'Failed to update cart' }, { status: 500 });
    }

    if (mergedItems.length > 0) {
      const { error: insertError } = await supabase
        .from('cart_items')
        .insert(mergedItems);

      if (insertError) {
        console.error('Insert cart items error:', insertError);
        return NextResponse.json({ error: 'Failed to update cart' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cart PUT error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
