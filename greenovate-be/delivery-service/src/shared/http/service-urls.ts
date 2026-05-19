const resolveServicePort = (envName: string, fallbackPort: number) => {
  const parsed = Number(process.env[envName] || fallbackPort);
  return Number.isFinite(parsed) ? parsed : fallbackPort;
};

const resolveServiceUrl = (envName: string, fallbackPort: number) => {
  const configured = process.env[envName]?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return `http://127.0.0.1:${fallbackPort}`;
};

export const SERVICE_PORTS = {
  get gateway() {
    return resolveServicePort('OOS_DELIVERY_GATEWAY_PORT', 3001);
  },
  get auth() {
    return resolveServicePort('OOS_DELIVERY_AUTH_SERVICE_PORT', 3002);
  },
  get catalog() {
    return resolveServicePort('OOS_DELIVERY_CATALOG_SERVICE_PORT', 3005);
  },
  get cart() {
    return resolveServicePort('OOS_DELIVERY_CART_SERVICE_PORT', 3004);
  },
  get promo() {
    return resolveServicePort('OOS_DELIVERY_PROMO_SERVICE_PORT', 3006);
  },
  get orders() {
    return resolveServicePort('OOS_DELIVERY_ORDER_SERVICE_PORT', 3003);
  },
  get delivery() {
    return resolveServicePort('OOS_DELIVERY_PORT', 3007);
  },
};

export const SERVICE_URLS = {
  get auth() {
    return resolveServiceUrl('OOS_DELIVERY_AUTH_SERVICE_URL', SERVICE_PORTS.auth);
  },
  get catalog() {
    return resolveServiceUrl('OOS_DELIVERY_CATALOG_SERVICE_URL', SERVICE_PORTS.catalog);
  },
  get cart() {
    return resolveServiceUrl('OOS_DELIVERY_CART_SERVICE_URL', SERVICE_PORTS.cart);
  },
  get promo() {
    return resolveServiceUrl('OOS_DELIVERY_PROMO_SERVICE_URL', SERVICE_PORTS.promo);
  },
  get orders() {
    return resolveServiceUrl('OOS_DELIVERY_ORDER_SERVICE_URL', SERVICE_PORTS.orders);
  },
  get delivery() {
    return resolveServiceUrl('OOS_DELIVERY_SERVICE_URL', SERVICE_PORTS.delivery);
  },
};
