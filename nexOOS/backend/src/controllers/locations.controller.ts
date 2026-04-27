import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from '../services/locations.service';

@Controller('locations')
export class LocationsController {
  private readonly locationsService: LocationsService;

  constructor(locationsService: LocationsService) {
    this.locationsService = locationsService;
  }

  @Get()
  getLocations(@Query('scope') scope?: string, @Query('province') province?: string) {
    if (scope === 'provinces') {
      return { provinces: this.locationsService.listProvinces() };
    }

    if (scope === 'cities') {
      if (!province?.trim()) {
        throw new BadRequestException('Province is required.');
      }

      return { cities: this.locationsService.listCities(province.trim()) };
    }

    throw new BadRequestException('Unsupported location scope.');
  }
}
