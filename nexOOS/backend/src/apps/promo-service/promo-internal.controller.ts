import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { PromosService } from '../../services/promos.service';

@Controller('internal/promos')
export class PromoInternalController {
  constructor(private readonly promosService: PromosService) {}

  @Post('validate')
  async validate(@Body() body?: { code?: string; subtotal?: number }) {
    try {
      return await this.promosService.validatePromoCode(body?.code ?? '', Number(body?.subtotal));
    } catch (error) {
      console.error('Internal promo validation error:', error);
      throw new InternalServerErrorException('Unable to validate promo code.');
    }
  }

  @Post('redeem')
  async redeem(@Body() body?: { promoId?: number }) {
    try {
      if (!body?.promoId) {
        return { success: false };
      }

      await this.promosService.incrementPromoUsage(body.promoId);
      return { success: true };
    } catch (error) {
      console.error('Promo redeem error:', error);
      throw new InternalServerErrorException('Unable to redeem promo code.');
    }
  }
}
