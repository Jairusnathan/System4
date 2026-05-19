# [OOS] Combined NPM Scripts — Monolithic Merge

**System Prefix:** `OOS`
**Backend root folder assumed:** `OOS-backend/`
**Services scanned:** 8 total (7 backend microservices + 1 frontend)

---

> [!IMPORTANT]
> Paste only the contents of the `"scripts"` block below into the master `package.json`.
> The path prefix `OOS-backend/` must match the actual folder name your group uses in the monorepo root.

---

## ✅ Final Combined `"scripts"` Block

```json
"scripts": {

  "___ API GATEWAY ___": "--- greenovate-be/api-gateway ---",
  "build:[OOS]-api-gateway":       "cd OOS-backend/greenovate-be/api-gateway && ..\\node_modules\\.bin\\nest build",
  "format:[OOS]-api-gateway":      "cd OOS-backend/greenovate-be/api-gateway && prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start:[OOS]-api-gateway":       "cd OOS-backend/greenovate-be/api-gateway && ..\\node_modules\\.bin\\nest start",
  "start:dev:[OOS]-api-gateway":   "cd OOS-backend/greenovate-be/api-gateway && ..\\\\node_modules\\\\.bin\\\\nest build && node dist/main",
  "start:debug:[OOS]-api-gateway": "cd OOS-backend/greenovate-be/api-gateway && ..\\node_modules\\.bin\\nest start --debug --watch",
  "start:prod:[OOS]-api-gateway":  "node OOS-backend/greenovate-be/api-gateway/dist/main",
  "lint:[OOS]-api-gateway":        "cd OOS-backend/greenovate-be/api-gateway && eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test:[OOS]-api-gateway":        "cd OOS-backend/greenovate-be/api-gateway && jest",
  "test:watch:[OOS]-api-gateway":  "cd OOS-backend/greenovate-be/api-gateway && jest --watch",
  "test:cov:[OOS]-api-gateway":    "cd OOS-backend/greenovate-be/api-gateway && jest --coverage",
  "test:debug:[OOS]-api-gateway":  "cd OOS-backend/greenovate-be/api-gateway && node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e:[OOS]-api-gateway":    "cd OOS-backend/greenovate-be/api-gateway && jest --config ./test/jest-e2e.json",

  "___ AUTH SERVICE ___": "--- greenovate-be/auth-service ---",
  "build:[OOS]-auth":       "cd OOS-backend/greenovate-be/auth-service && ..\\node_modules\\.bin\\nest build",
  "format:[OOS]-auth":      "cd OOS-backend/greenovate-be/auth-service && prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start:[OOS]-auth":       "cd OOS-backend/greenovate-be/auth-service && ..\\node_modules\\.bin\\nest start",
  "start:dev:[OOS]-auth":   "cd OOS-backend/greenovate-be/auth-service && ..\\\\node_modules\\\\.bin\\\\nest build && node dist/main",
  "start:debug:[OOS]-auth": "cd OOS-backend/greenovate-be/auth-service && ..\\node_modules\\.bin\\nest start --debug --watch",
  "start:prod:[OOS]-auth":  "node OOS-backend/greenovate-be/auth-service/dist/main",
  "lint:[OOS]-auth":        "cd OOS-backend/greenovate-be/auth-service && eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test:[OOS]-auth":        "cd OOS-backend/greenovate-be/auth-service && jest",
  "test:watch:[OOS]-auth":  "cd OOS-backend/greenovate-be/auth-service && jest --watch",
  "test:cov:[OOS]-auth":    "cd OOS-backend/greenovate-be/auth-service && jest --coverage",
  "test:debug:[OOS]-auth":  "cd OOS-backend/greenovate-be/auth-service && node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e:[OOS]-auth":    "cd OOS-backend/greenovate-be/auth-service && jest --config ./test/jest-e2e.json",

  "___ CART SERVICE ___": "--- greenovate-be/cart-service ---",
  "build:[OOS]-cart":       "cd OOS-backend/greenovate-be/cart-service && ..\\node_modules\\.bin\\nest build",
  "format:[OOS]-cart":      "cd OOS-backend/greenovate-be/cart-service && prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start:[OOS]-cart":       "cd OOS-backend/greenovate-be/cart-service && ..\\node_modules\\.bin\\nest start",
  "start:dev:[OOS]-cart":   "cd OOS-backend/greenovate-be/cart-service && ..\\\\node_modules\\\\.bin\\\\nest build && node dist/main",
  "start:debug:[OOS]-cart": "cd OOS-backend/greenovate-be/cart-service && ..\\node_modules\\.bin\\nest start --debug --watch",
  "start:prod:[OOS]-cart":  "node OOS-backend/greenovate-be/cart-service/dist/main",
  "lint:[OOS]-cart":        "cd OOS-backend/greenovate-be/cart-service && eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test:[OOS]-cart":        "cd OOS-backend/greenovate-be/cart-service && jest",
  "test:watch:[OOS]-cart":  "cd OOS-backend/greenovate-be/cart-service && jest --watch",
  "test:cov:[OOS]-cart":    "cd OOS-backend/greenovate-be/cart-service && jest --coverage",
  "test:debug:[OOS]-cart":  "cd OOS-backend/greenovate-be/cart-service && node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e:[OOS]-cart":    "cd OOS-backend/greenovate-be/cart-service && jest --config ./test/jest-e2e.json",

  "___ CATALOG SERVICE ___": "--- greenovate-be/catalog-service ---",
  "build:[OOS]-catalog":       "cd OOS-backend/greenovate-be/catalog-service && ..\\node_modules\\.bin\\nest build",
  "format:[OOS]-catalog":      "cd OOS-backend/greenovate-be/catalog-service && prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start:[OOS]-catalog":       "cd OOS-backend/greenovate-be/catalog-service && ..\\node_modules\\.bin\\nest start",
  "start:dev:[OOS]-catalog":   "cd OOS-backend/greenovate-be/catalog-service && ..\\\\node_modules\\\\.bin\\\\nest build && node dist/main",
  "start:debug:[OOS]-catalog": "cd OOS-backend/greenovate-be/catalog-service && ..\\node_modules\\.bin\\nest start --debug --watch",
  "start:prod:[OOS]-catalog":  "node OOS-backend/greenovate-be/catalog-service/dist/main",
  "lint:[OOS]-catalog":        "cd OOS-backend/greenovate-be/catalog-service && eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test:[OOS]-catalog":        "cd OOS-backend/greenovate-be/catalog-service && jest",
  "test:watch:[OOS]-catalog":  "cd OOS-backend/greenovate-be/catalog-service && jest --watch",
  "test:cov:[OOS]-catalog":    "cd OOS-backend/greenovate-be/catalog-service && jest --coverage",
  "test:debug:[OOS]-catalog":  "cd OOS-backend/greenovate-be/catalog-service && node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e:[OOS]-catalog":    "cd OOS-backend/greenovate-be/catalog-service && jest --config ./test/jest-e2e.json",

  "___ DELIVERY SERVICE ___": "--- greenovate-be/delivery-service ---",
  "build:[OOS]-delivery":       "cd OOS-backend/greenovate-be/delivery-service && ..\\node_modules\\.bin\\nest build",
  "format:[OOS]-delivery":      "cd OOS-backend/greenovate-be/delivery-service && prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start:[OOS]-delivery":       "cd OOS-backend/greenovate-be/delivery-service && ..\\node_modules\\.bin\\nest start",
  "start:dev:[OOS]-delivery":   "cd OOS-backend/greenovate-be/delivery-service && ..\\\\node_modules\\\\.bin\\\\nest build && node dist/main",
  "start:debug:[OOS]-delivery": "cd OOS-backend/greenovate-be/delivery-service && ..\\node_modules\\.bin\\nest start --debug --watch",
  "start:prod:[OOS]-delivery":  "node OOS-backend/greenovate-be/delivery-service/dist/main",
  "lint:[OOS]-delivery":        "cd OOS-backend/greenovate-be/delivery-service && eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test:[OOS]-delivery":        "cd OOS-backend/greenovate-be/delivery-service && jest",
  "test:watch:[OOS]-delivery":  "cd OOS-backend/greenovate-be/delivery-service && jest --watch",
  "test:cov:[OOS]-delivery":    "cd OOS-backend/greenovate-be/delivery-service && jest --coverage",
  "test:debug:[OOS]-delivery":  "cd OOS-backend/greenovate-be/delivery-service && node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e:[OOS]-delivery":    "cd OOS-backend/greenovate-be/delivery-service && jest --config ./test/jest-e2e.json",

  "___ ORDER SERVICE ___": "--- greenovate-be/order-service ---",
  "build:[OOS]-order":       "cd OOS-backend/greenovate-be/order-service && ..\\node_modules\\.bin\\nest build",
  "format:[OOS]-order":      "cd OOS-backend/greenovate-be/order-service && prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start:[OOS]-order":       "cd OOS-backend/greenovate-be/order-service && ..\\node_modules\\.bin\\nest start",
  "start:dev:[OOS]-order":   "cd OOS-backend/greenovate-be/order-service && ..\\\\node_modules\\\\.bin\\\\nest build && node dist/main",
  "start:debug:[OOS]-order": "cd OOS-backend/greenovate-be/order-service && ..\\node_modules\\.bin\\nest start --debug --watch",
  "start:prod:[OOS]-order":  "node OOS-backend/greenovate-be/order-service/dist/main",
  "lint:[OOS]-order":        "cd OOS-backend/greenovate-be/order-service && eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test:[OOS]-order":        "cd OOS-backend/greenovate-be/order-service && jest",
  "test:watch:[OOS]-order":  "cd OOS-backend/greenovate-be/order-service && jest --watch",
  "test:cov:[OOS]-order":    "cd OOS-backend/greenovate-be/order-service && jest --coverage",
  "test:debug:[OOS]-order":  "cd OOS-backend/greenovate-be/order-service && node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e:[OOS]-order":    "cd OOS-backend/greenovate-be/order-service && jest --config ./test/jest-e2e.json",

  "___ PROMO SERVICE ___": "--- greenovate-be/promo-service ---",
  "build:[OOS]-promo":       "cd OOS-backend/greenovate-be/promo-service && ..\\node_modules\\.bin\\nest build",
  "format:[OOS]-promo":      "cd OOS-backend/greenovate-be/promo-service && prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start:[OOS]-promo":       "cd OOS-backend/greenovate-be/promo-service && ..\\node_modules\\.bin\\nest start",
  "start:dev:[OOS]-promo":   "cd OOS-backend/greenovate-be/promo-service && ..\\\\node_modules\\\\.bin\\\\nest build && node dist/main",
  "start:debug:[OOS]-promo": "cd OOS-backend/greenovate-be/promo-service && ..\\node_modules\\.bin\\nest start --debug --watch",
  "start:prod:[OOS]-promo":  "node OOS-backend/greenovate-be/promo-service/dist/main",
  "lint:[OOS]-promo":        "cd OOS-backend/greenovate-be/promo-service && eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test:[OOS]-promo":        "cd OOS-backend/greenovate-be/promo-service && jest",
  "test:watch:[OOS]-promo":  "cd OOS-backend/greenovate-be/promo-service && jest --watch",
  "test:cov:[OOS]-promo":    "cd OOS-backend/greenovate-be/promo-service && jest --coverage",
  "test:debug:[OOS]-promo":  "cd OOS-backend/greenovate-be/promo-service && node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e:[OOS]-promo":    "cd OOS-backend/greenovate-be/promo-service && jest --config ./test/jest-e2e.json",

  "___ NEXOOS FRONTEND ___": "--- nexOOS ---",
  "dev:[OOS]-frontend":        "cd OOS-backend/nexOOS && next dev",
  "build:[OOS]-frontend":      "cd OOS-backend/nexOOS && next build",
  "start:[OOS]-frontend":      "cd OOS-backend/nexOOS && next start",
  "lint:[OOS]-frontend":       "cd OOS-backend/nexOOS && eslint",
  "test:[OOS]-frontend":       "cd OOS-backend/nexOOS && jest --coverage --coverageReporters=lcov --coverageReporters=json-summary",
  "test:watch:[OOS]-frontend": "cd OOS-backend/nexOOS && jest --watch",
  "test:e2e:[OOS]-frontend":   "cd OOS-backend/nexOOS && tsx tests/e2e/playwright-e2e.ts"

}
```

---

## 📋 Services & Script Key Summary

| Service | Folder Path | Short Name Used |
|---|---|---|
| API Gateway | `greenovate-be/api-gateway` | `api-gateway` |
| Auth Service | `greenovate-be/auth-service` | `auth` |
| Cart Service | `greenovate-be/cart-service` | `cart` |
| Catalog Service | `greenovate-be/catalog-service` | `catalog` |
| Delivery Service | `greenovate-be/delivery-service` | `delivery` |
| Order Service | `greenovate-be/order-service` | `order` |
| Promo Service | `greenovate-be/promo-service` | `promo` |
| NexOOS Frontend | `nexOOS` | `frontend` |

---

## ⚙️ Transformation Logic Applied

| Original Script | New Key Pattern | Command Transformation |
|---|---|---|
| `"start"` in `auth-service` | `"start:[OOS]-auth"` | `cd OOS-backend/greenovate-be/auth-service && ...` |
| `"start:prod"` (node only) | `"start:prod:[OOS]-<svc>"` | Fully qualified path: `node OOS-backend/.../dist/main` |
| `"dev"` in `nexOOS` | `"dev:[OOS]-frontend"` | `cd OOS-backend/nexOOS && next dev` |

> [!NOTE]
> **Separator keys** (`"___ SERVICE NAME ___"`) are purely cosmetic comments — JSON doesn't support comments natively.
> Most `package.json` parsers ignore unknown string values, but if your master's parser is strict, remove those lines.

> [!TIP]
> The `"start:prod"` scripts use a **direct `node` path** (no `cd` needed) since they only call `node dist/main` — this is the cleanest and most portable form for production. All other scripts use `cd` + local tool invocation for consistency.
