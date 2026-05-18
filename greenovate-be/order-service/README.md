# Order Service

Planned microservice folder for checkout and order placement flows.

Current implementation still lives under `src/apps/order-service` and related shared services.

## APICenter SDK setup

This service is the intended home for `@implementsprint/sdk` so order checkout
flows can call APICenter shared services such as `payment` and `geo`.

Required runtime variables:

- `APICENTER_URL`
- `APICENTER_TRIBE_ID`
- `APICENTER_TRIBE_SECRET`

GitHub Packages install auth template:

- `.npmrc.example`

Nest provider for APICenter access:

- `src/order/api-center.service.ts`
