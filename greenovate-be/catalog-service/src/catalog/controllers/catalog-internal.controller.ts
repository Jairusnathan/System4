import { Body, Controller, Get, InternalServerErrorException, NotFoundException, Param, Post } from '@nestjs/common';
import { ProductsService } from '../products.service';
import { SupabaseService } from '../supabase.service';

interface RequestedOrderItem { id?: string; productId?: string; quantity?: number; }
const normalizeItems = (items: RequestedOrderItem[]) => items.map((item) => ({ id: typeof item.id === 'string' ? item.id : item.productId, quantity: Math.max(1, Math.trunc(Number(item.quantity ?? 1))) })).filter((item) => Boolean(item.id));

const POS_STATUS_MAP: Record<string, string> = {
  paid: 'Processing',
  preparing: 'Processing',
  ready: 'In Transit',
  picked_up: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

@Controller('internal')
export class CatalogInternalController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get('receipts/status/:receiptNumber')
  async getReceiptStatus(@Param('receiptNumber') receiptNumber: string) {
    try {
      const db = this.supabaseService.secondSupabaseAdmin;

      const { data: receipt } = await db
        .from('receipts')
        .select('receipt_id')
        .eq('receipt_number', receiptNumber)
        .single();

      if (!receipt?.receipt_id) throw new NotFoundException('Order not found');

      const { data: transaction } = await db
        .from('transactions')
        .select('status, updated_at')
        .eq('receipt_id', receipt.receipt_id)
        .single();

      if (!transaction) throw new NotFoundException('Order not found');

      return {
        status: POS_STATUS_MAP[transaction.status] ?? 'Processing',
        rawStatus: transaction.status,
        updatedAt: transaction.updated_at,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Post('products/by-ids')
  async getProductsByIds(@Body() body?: { ids?: string[] }) {
    try { const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0) : []; return { data: await this.productsService.getProductsByIds(ids) }; }
    catch (error) { throw new InternalServerErrorException(); }
  }

  @Post('products/prepare-order')
  async prepareOrder(@Body() body?: { items?: RequestedOrderItem[] }) {
    try {
      const normalizedItems = normalizeItems(Array.isArray(body?.items) ? body.items : []);
      if (normalizedItems.length === 0) return { items: [] };
      const products = await this.productsService.getProductsByIds(normalizedItems.map((item) => item.id as string));
      const productsById = new Map(products.map((p) => [p.id, p]));
      return { items: normalizedItems.map((item) => { const product = productsById.get(item.id as string); if (!product) return { id: item.id as string, quantity: item.quantity, status: 'missing' as const }; const availableStock = Number(product.stock ?? 0); return { id: product.id, name: product.name, category: product.category, price: product.price, quantity: item.quantity, availableStock, status: availableStock >= item.quantity ? 'ok' as const : 'insufficient-stock' as const }; }) };
    } catch (error) { throw new InternalServerErrorException(); }
  }

  @Post('products/commit-stock')
  async commitStock(@Body() body?: { items?: RequestedOrderItem[] }) {
    try {
      const normalizedItems = normalizeItems(Array.isArray(body?.items) ? body.items : []);
      if (normalizedItems.length === 0) return { success: true };
      const products = await this.productsService.getProductsByIds(normalizedItems.map((item) => item.id as string));
      const productsById = new Map(products.map((p) => [p.id, p]));
      for (const item of normalizedItems) {
        const product = productsById.get(item.id as string);
        if (!product) throw new Error(`Product ${item.id} was not found`);
        const availableStock = Number(product.stock ?? 0);
        if (availableStock < item.quantity) return { success: false, message: `${product.name} only has ${availableStock} item(s) left.` };
        await this.productsService.updateStock(product.id, availableStock - item.quantity);
      }
      return { success: true };
    } catch (error) { throw new InternalServerErrorException(error instanceof Error ? error.message : 'Failed to update stock.'); }
  }

  @Post('products/release-stock')
  async releaseStock(@Body() body?: { items?: RequestedOrderItem[] }) {
    try {
      const normalizedItems = normalizeItems(Array.isArray(body?.items) ? body.items : []);
      if (normalizedItems.length === 0) return { success: true };
      const products = await this.productsService.getProductsByIds(normalizedItems.map((item) => item.id as string));
      const productsById = new Map(products.map((p) => [p.id, p]));
      for (const item of normalizedItems) {
        const product = productsById.get(item.id as string);
        if (!product) continue;
        await this.productsService.updateStock(product.id, Number(product.stock ?? 0) + item.quantity);
      }
      return { success: true };
    } catch (error) { throw new InternalServerErrorException(); }
  }
}
