export const SERVICE_PORTS = {
  gateway: Number(process.env.API_GATEWAY_PORT || 4000),
  auth: Number(process.env.AUTH_SERVICE_PORT || 4101),
  catalog: Number(process.env.CATALOG_SERVICE_PORT || 4102),
  cart: Number(process.env.CART_SERVICE_PORT || 4103),
  promo: Number(process.env.PROMO_SERVICE_PORT || 4104),
  orders: Number(process.env.ORDER_SERVICE_PORT || 4105),
  delivery: Number(process.env.DELIVERY_SERVICE_PORT || 4106),
  analytics: Number(process.env.ANALYTICS_SERVICE_PORT || 4107),
} as const;

const resolveServiceUrl = (envName: string, fallbackPort: number) => {
  const configured = process.env[envName]?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return `http://127.0.0.1:${fallbackPort}`;
};

export const SERVICE_URLS = {
  auth: resolveServiceUrl('AUTH_SERVICE_URL', SERVICE_PORTS.auth),
  catalog: resolveServiceUrl('CATALOG_SERVICE_URL', SERVICE_PORTS.catalog),
  cart: resolveServiceUrl('CART_SERVICE_URL', SERVICE_PORTS.cart),
  promo: resolveServiceUrl('PROMO_SERVICE_URL', SERVICE_PORTS.promo),
  orders: resolveServiceUrl('ORDER_SERVICE_URL', SERVICE_PORTS.orders),
  delivery: resolveServiceUrl('DELIVERY_SERVICE_URL', SERVICE_PORTS.delivery),
  analytics: resolveServiceUrl('ANALYTICS_SERVICE_URL', SERVICE_PORTS.analytics),
} as const;
