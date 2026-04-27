import { Body, Controller, Get, Headers, Put, Res } from '@nestjs/common';
import { Response } from 'express';
import { SERVICE_URLS } from '../../../shared/http/service-urls';
import { requestDownstream } from '../../../shared/http/request-downstream';

@Controller('cart')
export class CartGatewayController {
  @Get()
  async getCart(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.cart,
      path: '/cart',
      headers: { authorization },
    });

    response.status(result.status);
    return result.data;
  }

  @Put()
  async updateCart(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.cart,
      path: '/cart',
      method: 'PUT',
      headers: { authorization },
      body,
    });

    response.status(result.status);
    return result.data;
  }
}
