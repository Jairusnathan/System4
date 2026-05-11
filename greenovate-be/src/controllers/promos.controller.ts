import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { PromosService } from '../services/promos.service';

@Controller('promos')
export class PromosController {
  private readonly promosService: PromosService;

  constructor(promosService: PromosService) {
    this.promosService = promosService;
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body() body: any) {
    try {
      const code = typeof body?.code === 'string' ? body.code : '';
      const subtotal = Number(body?.subtotal);
      const result = await this.promosService.validatePromoCode(code, subtotal);

      if (!result.valid) {
        throw new BadRequestException({
          valid: false,
          code: result.normalizedCode,
          reason: result.message,
        });
      }

      return {
        valid: true,
        promo: {
          id: result.promo.id,
          code: result.promo.code,
          description: result.promo.description,
          discountType: result.promo.discount_type,
          discountValue: result.promo.discount_value,
          discountAmount: result.discountAmount,
          minSubtotal: result.promo.min_subtotal,
          maxDiscount: result.promo.max_discount,
        },
        message: result.message,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Promo validation API error:', error);
      throw new InternalServerErrorException('Unable to validate promo code.');
    }
  }
}
