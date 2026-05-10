import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { DeliveryService } from '../services/delivery.service';

@Controller('delivery')
export class DeliveryController {
  private readonly deliveryService: DeliveryService;

  constructor(deliveryService: DeliveryService) {
    this.deliveryService = deliveryService;
  }

  @Post('estimate')
  async estimate(@Body() body: any) {
    try {
      const estimate = await this.deliveryService.estimateDelivery(body);

      if (estimate === null) {
        throw new BadRequestException(
          'Address, city, and province are required to estimate delivery.',
        );
      }

      if (!estimate) {
        throw new NotFoundException(
          'No delivery rate is available for this address yet.',
        );
      }

      return { estimate };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Delivery estimate API error:', error);
      throw new InternalServerErrorException();
    }
  }
}
