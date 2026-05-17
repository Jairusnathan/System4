import { BadRequestException, Body, Controller, Get, InternalServerErrorException, Post, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('search')
  async track(@Body() body: any) {
    try {
      const query = body?.query;
      const source = body?.source;
      if (!query?.trim() || !source?.trim()) throw new BadRequestException('Query and source are required');
      await this.analyticsService.trackSearchQuery(query, source);
      return { success: true };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Search analytics error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get('trending')
  async trending(@Query('limit') limit?: string) {
    try {
      const parsedLimit = Number(limit ?? '8');
      const data = await this.analyticsService.getTrending(
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 8,
      );
      return { data };
    } catch (error) {
      console.error('Trending analytics error:', error);
      throw new InternalServerErrorException();
    }
  }
}
