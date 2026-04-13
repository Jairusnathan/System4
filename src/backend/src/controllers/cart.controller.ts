import {
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { AppAuthService } from '../services/auth.service';
import { CartService } from '../services/cart.service';

@Controller('cart')
export class CartController {
  private readonly authService: AppAuthService;
  private readonly cartService: CartService;

  constructor(
    authService: AppAuthService,
    cartService: CartService,
  ) {
    this.authService = authService;
    this.cartService = cartService;
  }

  @Get()
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

  @Put()
  async updateCart(
    @Headers('authorization') authorization?: string,
    @Body() body?: any,
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
}
