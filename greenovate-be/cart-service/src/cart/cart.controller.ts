import { Body, Controller, Get, Headers, InternalServerErrorException, Post, Put, UnauthorizedException } from '@nestjs/common';
import { AppAuthService } from './auth.service';
import { CartService } from './cart.service';

@Controller()
export class CartController {
  constructor(private readonly authService: AppAuthService, private readonly cartService: CartService) {}

  @Get('cart')
  async getCart(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      return { items: await this.cartService.getCart(userId) };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      console.error('Cart GET error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Put('cart')
  async updateCart(@Headers('authorization') authorization?: string, @Body() body?: { items?: Array<{ id?: string; productId?: string; quantity?: number }> }) {
    try {
      const userId = this.authService.requireUserId(authorization);
      await this.cartService.replaceCart(userId, Array.isArray(body?.items) ? body.items : []);
      return { success: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      console.error('Cart PUT error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('internal/cart/clear')
  async clearCart(@Body() body?: { userId?: string }) {
    try {
      if (!body?.userId) return { success: false };
      await this.cartService.clearCart(body.userId);
      return { success: true };
    } catch (error) {
      console.error('Cart clear error:', error);
      throw new InternalServerErrorException();
    }
  }
}
