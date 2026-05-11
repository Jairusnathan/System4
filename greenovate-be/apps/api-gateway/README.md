# API Gateway

The API gateway is the first service migrated into the top-level `apps/` microservice layout.

Source of truth:

- `apps/api-gateway/src`

Compatibility layer:

- `src/apps/api-gateway/*`

The compatibility files re-export the new gateway modules so the backend can be migrated service by service instead of all at once.
