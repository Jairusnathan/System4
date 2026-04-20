import locationsPackage from 'ph-locations';

type ProvinceRecord = {
  code: string;
  name: string;
};

type CityRecord = {
  code: string;
  name: string;
  province: string;
};

const { psgc } = locationsPackage as {
  psgc: {
    provinces: ProvinceRecord[];
    citiesMunicipalities: CityRecord[];
  };
};

const collator = new Intl.Collator('en-PH', { sensitivity: 'base' });

const normalizeKey = (value?: string) =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const stripPrefix = (value: string, prefix: string) =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value;

const stripSuffix = (value: string, suffix: string) =>
  value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;

const normalizeLocationName = (value?: string) =>
  stripSuffix(
    stripSuffix(
      stripPrefix(
        stripPrefix(normalizeKey(value), 'city of '),
        'municipality of '
      ),
      ' city'
    ),
    ' municipality'
  );

const provinceRecords = [...psgc.provinces].sort((left, right) => collator.compare(left.name, right.name));

const provinceNameByCode = new Map(provinceRecords.map((province) => [province.code, province.name]));
const provinceCodeByName = new Map(provinceRecords.map((province) => [normalizeKey(province.name), province.code]));

const cityNamesByProvinceCode = new Map<string, string[]>();

for (const city of psgc.citiesMunicipalities) {
  const provinceName = provinceNameByCode.get(city.province);
  if (!provinceName) {
    continue;
  }

  const currentCities = cityNamesByProvinceCode.get(city.province) ?? [];
  currentCities.push(city.name);
  cityNamesByProvinceCode.set(city.province, currentCities);
}

for (const [provinceCode, cityNames] of cityNamesByProvinceCode.entries()) {
  cityNames.sort((left, right) => collator.compare(left, right));
  cityNamesByProvinceCode.set(provinceCode, Array.from(new Set(cityNames)));
}

export function listProvinceNames() {
  return provinceRecords.map((province) => province.name);
}

export function listCityNamesByProvince(provinceName: string) {
  const provinceCode = provinceCodeByName.get(normalizeKey(provinceName));
  if (!provinceCode) {
    return [];
  }

  return cityNamesByProvinceCode.get(provinceCode) ?? [];
}

export function normalizePhilippineLocationName(value?: string) {
  return normalizeLocationName(value);
}
