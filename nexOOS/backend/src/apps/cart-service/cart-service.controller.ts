import {
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { AppAuthService } from '../../services/auth.service';
import { CartServiceService } from './cart-service.service';

@Controller()
export class CartServiceController {
  constructor(
    private readonly authService: AppAuthService,
    private readonly cartService: CartServiceService,
  ) {}

  @Get('cart')
  async getCart(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const items = await this.cartService.getCart(userId);
      return { items };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      console.error('Cart GET error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Put('cart')
  async updateCart(
    @Headers('authorization') authorization?: string,
    @Body() body?: { items?: Array<{ id?: string; productId?: string; quantity?: number }> },
  ) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const items = Array.isArray(body?.items) ? body.items : [];
      await this.cartService.replaceCart(userId, items);
      return { success: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      console.error('Cart PUT error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('internal/cart/clear')
  async clearCart(@Body() body?: { userId?: string }) {
    try {
      if (!body?.userId) {
        return { success: false };
      }

      await this.cartService.clearCart(body.userId);
      return { success: true };
    } catch (error) {
      console.error('Cart clear error:', error);
      throw new InternalServerErrorException();
    }
  }
}
