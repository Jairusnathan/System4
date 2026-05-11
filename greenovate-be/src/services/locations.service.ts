import { Injectable } from '@nestjs/common';
import {
  listCityNamesByProvince,
  listProvinceNames,
} from '../utils/philippine-locations.util';

@Injectable()
export class LocationsService {
  listProvinces() {
    return listProvinceNames();
  }

  listCities(province: string) {
    return listCityNamesByProvince(province);
  }
}
