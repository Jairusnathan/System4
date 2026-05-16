import { BadRequestException, Body, Controller, HttpException, InternalServerErrorException, NotFoundException, Post } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('autocomplete')
  async autocomplete(@Body() body: any) {
    try { return { suggestions: await this.deliveryService.autocompleteAddress(body) }; }
    catch (error) { throw new InternalServerErrorException(); }
  }

  @Post('verify-address')
  async verifyAddress(@Body() body: any) {
    try {
      const address = await this.deliveryService.verifyAddress(body);
      if (!address) throw new NotFoundException('Unable to verify this address.');
      return { address };
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new InternalServerErrorException(); }
  }

  @Post('estimate')
  async estimate(@Body() body: any) {
    try {
      const estimate = await this.deliveryService.estimateDelivery(body);
      if (estimate === null) throw new BadRequestException('Address, city, and province are required.');
      if (!estimate) throw new NotFoundException('No delivery rate available for this address.');
      if ('error' in estimate) throw new HttpException({ error: estimate.error }, Number(estimate.status ?? 400));
      return { estimate };
    } catch (error) { if (error instanceof BadRequestException || error instanceof HttpException || error instanceof NotFoundException) throw error; throw new InternalServerErrorException(); }
  }
}
