import { useState, useEffect } from 'react';

export type OosSettings = {
  delivery_fee: number;
  free_delivery_min: number;
  min_order_amount: number;
  max_order_items: number;
  order_cutoff_time: string;
  oos_enabled: boolean;
  contact_email: string;
  contact_phone: string;
};

const DEFAULTS: OosSettings = {
  delivery_fee: 50,
  free_delivery_min: 500,
  min_order_amount: 50,
  max_order_items: 20,
  order_cutoff_time: '21:00',
  oos_enabled: true,
  contact_email: '',
  contact_phone: '',
};

let cachedSettings: OosSettings | null = null;
let fetchPromise: Promise<OosSettings> | null = null;

async function fetchSettings(): Promise<OosSettings> {
  if (cachedSettings) return cachedSettings;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/settings')
    .then(r => r.json())
    .then(d => {
      const raw = d?.data ?? {};
      cachedSettings = {
        delivery_fee:      Number(raw.delivery_fee      ?? DEFAULTS.delivery_fee),
        free_delivery_min: Number(raw.free_delivery_min ?? DEFAULTS.free_delivery_min),
        min_order_amount:  Number(raw.min_order_amount  ?? DEFAULTS.min_order_amount),
        max_order_items:   Number(raw.max_order_items   ?? DEFAULTS.max_order_items),
        order_cutoff_time: raw.order_cutoff_time ?? DEFAULTS.order_cutoff_time,
        oos_enabled:       raw.oos_enabled !== 'false',
        contact_email:     raw.contact_email ?? '',
        contact_phone:     raw.contact_phone ?? '',
      };
      return cachedSettings;
    })
    .catch(() => DEFAULTS);

  return fetchPromise;
}

export function useOosSettings() {
  const [settings, setSettings] = useState<OosSettings>(cachedSettings ?? DEFAULTS);
  const [loaded,   setLoaded]   = useState(!!cachedSettings);

  useEffect(() => {
    fetchSettings().then(s => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  return { settings, loaded };
}

export function isPastCutoff(cutoffTime: string): boolean {
  const [hh, mm] = cutoffTime.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return false;
  const now = new Date();
  const cutoffMinutes = hh * 60 + mm;
  const nowMinutes    = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= cutoffMinutes;
}
