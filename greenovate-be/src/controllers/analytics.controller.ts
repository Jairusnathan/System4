import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';

@Controller('analytics')
export class AnalyticsController {
  private readonly analyticsService: AnalyticsService;

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  @Post('search')
  async track(@Body() body: any) {
    try {
      const query = body?.query;
      const source = body?.source;

      if (!query?.trim() || !source?.trim()) {
        throw new BadRequestException('Query and source are required');
      }

      await this.analyticsService.trackSearchQuery(query, source);
      return { success: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Search analytics error:', error);
      throw new InternalServerErrorException();
    }
  }
}
