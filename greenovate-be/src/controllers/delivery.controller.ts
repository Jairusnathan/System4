import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
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

  @Post('autocomplete')
  async autocomplete(@Body() body: any) {
    try {
      return {
        suggestions: await this.deliveryService.autocompleteAddress(body),
      };
    } catch (error) {
      console.error('Delivery autocomplete API error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('place-details')
  async placeDetails(@Body() body: any) {
    try {
      const place = await this.deliveryService.getPlaceDetails(body);

      if (!place) {
        throw new NotFoundException('Unable to resolve the selected address.');
      }

      return { place };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Delivery place-details API error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('verify-address')
  async verifyAddress(@Body() body: any) {
    try {
      const address = await this.deliveryService.verifyAddress(body);

      if (!address) {
        throw new NotFoundException(
          'Unable to verify this address. Please check the province, city, and street details.',
        );
      }

      return { address };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Delivery verify-address API error:', error);
      throw new InternalServerErrorException();
    }
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

      if ('error' in estimate) {
        throw new HttpException(
          { error: estimate.error },
          Number(estimate.status ?? 400),
        );
      }

      return { estimate };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Delivery estimate API error:', error);
      throw new InternalServerErrorException();
    }
  }
}
