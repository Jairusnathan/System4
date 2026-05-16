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
    return resolveServicePort('API_GATEWAY_PORT', 4000);
  },
  get auth() {
    return resolveServicePort('AUTH_SERVICE_PORT', 4101);
  },
  get catalog() {
    return resolveServicePort('CATALOG_SERVICE_PORT', 4102);
  },
  get cart() {
    return resolveServicePort('CART_SERVICE_PORT', 4103);
  },
  get promo() {
    return resolveServicePort('PROMO_SERVICE_PORT', 4104);
  },
  get orders() {
    return resolveServicePort('ORDER_SERVICE_PORT', 4105);
  },
  get delivery() {
    return resolveServicePort('DELIVERY_SERVICE_PORT', 4106);
  },
  get analytics() {
    return resolveServicePort('ANALYTICS_SERVICE_PORT', 4107);
  },
};

export const SERVICE_URLS = {
  get auth() {
    return resolveServiceUrl('AUTH_SERVICE_URL', SERVICE_PORTS.auth);
  },
  get catalog() {
    return resolveServiceUrl('CATALOG_SERVICE_URL', SERVICE_PORTS.catalog);
  },
  get cart() {
    return resolveServiceUrl('CART_SERVICE_URL', SERVICE_PORTS.cart);
  },
  get promo() {
    return resolveServiceUrl('PROMO_SERVICE_URL', SERVICE_PORTS.promo);
  },
  get orders() {
    return resolveServiceUrl('ORDER_SERVICE_URL', SERVICE_PORTS.orders);
  },
  get delivery() {
    return resolveServiceUrl('DELIVERY_SERVICE_URL', SERVICE_PORTS.delivery);
  },
  get analytics() {
    return resolveServiceUrl('ANALYTICS_SERVICE_URL', SERVICE_PORTS.analytics);
  },
};

