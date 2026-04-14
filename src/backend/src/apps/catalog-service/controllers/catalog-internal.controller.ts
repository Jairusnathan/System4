import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { ProductsService } from '../../../services/products.service';

interface RequestedOrderItem {
  id?: string;
  productId?: string;
  quantity?: number;
}

const normalizeRequestItems = (items: RequestedOrderItem[]) =>
  items
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : item.productId,
      quantity: Math.max(1, Math.trunc(Number(item.quantity ?? 1))),
    }))
    .filter((item) => Boolean(item.id));

@Controller('internal/products')
export class CatalogInternalController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('by-ids')
  async getProductsByIds(@Body() body?: { ids?: string[] }) {
    try {
      const ids = Array.isArray(body?.ids)
        ? body.ids.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [];

      return {
        data: await this.productsService.getProductsByIds(ids),
      };
    } catch (error) {
      console.error('Fetch products by ids error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('prepare-order')
  async prepareOrder(@Body() body?: { items?: RequestedOrderItem[] }) {
    try {
      const normalizedItems = normalizeRequestItems(Array.isArray(body?.items) ? body.items : []);
      if (normalizedItems.length === 0) {
        return { items: [] };
      }

      const products = await this.productsService.getProductsByIds(
        normalizedItems.map((item) => item.id as string),
      );
      const productsById = new Map(products.map((product) => [product.id, product]));

      const items = normalizedItems.map((item) => {
        const product = productsById.get(item.id as string);
        if (!product) {
          return {
            id: item.id as string,
            quantity: item.quantity,
            status: 'missing' as const,
          };
        }

        const availableStock = Number(product.stock ?? 0);
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          quantity: item.quantity,
          availableStock,
          status: availableStock >= item.quantity ? ('ok' as const) : ('insufficient-stock' as const),
        };
      });

      return { items };
    } catch (error) {
      console.error('Prepare order items error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('commit-stock')
  async commitStock(@Body() body?: { items?: RequestedOrderItem[] }) {
    try {
      const normalizedItems = normalizeRequestItems(Array.isArray(body?.items) ? body.items : []);
      if (normalizedItems.length === 0) {
        return { success: true };
      }

      const products = await this.productsService.getProductsByIds(
        normalizedItems.map((item) => item.id as string),
      );
      const productsById = new Map(products.map((product) => [product.id, product]));
      const updated: Array<{ id: string; quantity: number }> = [];

      for (const item of normalizedItems) {
        const product = productsById.get(item.id as string);
        if (!product) {
          throw new Error(`Product ${item.id} was not found`);
        }

        const availableStock = Number(product.stock ?? 0);
        if (availableStock < item.quantity) {
          return {
            success: false,
            message: `${product.name} only has ${availableStock} item(s) left in stock.`,
          };
        }

        await this.productsService.updateStock(product.id, availableStock - item.quantity);
        updated.push({ id: product.id, quantity: item.quantity });
      }

      return { success: true };
    } catch (error) {
      console.error('Commit stock error:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to update stock.',
      );
    }
  }

  @Post('release-stock')
  async releaseStock(@Body() body?: { items?: RequestedOrderItem[] }) {
    try {
      const normalizedItems = normalizeRequestItems(Array.isArray(body?.items) ? body.items : []);
      if (normalizedItems.length === 0) {
        return { success: true };
      }

      const products = await this.productsService.getProductsByIds(
        normalizedItems.map((item) => item.id as string),
      );
      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const item of normalizedItems) {
        const product = productsById.get(item.id as string);
        if (!product) {
          continue;
        }

        const availableStock = Number(product.stock ?? 0);
        await this.productsService.updateStock(product.id, availableStock + item.quantity);
      }

      return { success: true };
    } catch (error) {
      console.error('Release stock error:', error);
      throw new InternalServerErrorException();
    }
  }
}
