# Backend Apps

This folder is the target home for the backend microservices.

Current migration status:

- `api-gateway`: migrated into `apps/api-gateway/src`
- `auth-service`: pending migration
- `catalog-service`: pending migration
- `cart-service`: pending migration
- `promo-service`: pending migration
- `order-service`: pending migration
- `delivery-service`: pending migration
- `analytics-service`: pending migration

During the transition, `src/apps/*` compatibility shims stay in place so the existing build and scripts keep working.
