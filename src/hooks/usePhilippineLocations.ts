'use client';

import React from 'react';

type LocationStatus = 'idle' | 'loading' | 'ready' | 'error';

let provinceCache: string[] | null = null;
const cityCache = new Map<string, string[]>();

const withCurrentValue = (items: string[], currentValue?: string) => {
  const nextValue = currentValue?.trim();
  if (!nextValue || items.includes(nextValue)) {
    return items;
  }

  return [nextValue, ...items];
};

export function usePhilippineLocations(selectedProvince: string, selectedCity?: string) {
  const [provinces, setProvinces] = React.useState<string[]>([]);
  const [cities, setCities] = React.useState<string[]>([]);
  const [provincesStatus, setProvincesStatus] = React.useState<LocationStatus>('idle');
  const [citiesStatus, setCitiesStatus] = React.useState<LocationStatus>('idle');

  React.useEffect(() => {
    let isCancelled = false;

    async function loadProvinces() {
      if (provinceCache && provinceCache.length > 0) {
        setProvinces(provinceCache);
        setProvincesStatus('ready');
        return;
      }

      try {
        setProvincesStatus('loading');

        const response = await fetch('/api/locations?scope=provinces');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load provinces.');
        }

        if (isCancelled) {
          return;
        }

        provinceCache = data.provinces;
        setProvinces(data.provinces);
        setProvincesStatus('ready');
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error('Failed to load provinces:', error);
        setProvincesStatus('error');
      }
    }

    loadProvinces();

    return () => {
      isCancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let isCancelled = false;
    const province = selectedProvince.trim();

    if (!province) {
      setCities(withCurrentValue([], selectedCity));
      setCitiesStatus('idle');
      return () => {
        isCancelled = true;
      };
    }

    async function loadCities() {
      const cachedCities = cityCache.get(province);
      if (cachedCities) {
        setCities(withCurrentValue(cachedCities, selectedCity));
        setCitiesStatus('ready');
        return;
      }

      try {
        setCitiesStatus('loading');

        const response = await fetch(`/api/locations?scope=cities&province=${encodeURIComponent(province)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load cities.');
        }

        if (isCancelled) {
          return;
        }

        cityCache.set(province, data.cities);
        setCities(withCurrentValue(data.cities, selectedCity));
        setCitiesStatus('ready');
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error(`Failed to load cities for ${province}:`, error);
        setCities(withCurrentValue([], selectedCity));
        setCitiesStatus('error');
      }
    }

    loadCities();

    return () => {
      isCancelled = true;
    };
  }, [selectedCity, selectedProvince]);

  return {
    provinces,
    cities,
    provincesStatus,
    citiesStatus,
  };
}
