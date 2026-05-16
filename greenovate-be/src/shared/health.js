"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthPayload = void 0;
const createHealthPayload = (service) => ({
    service,
    status: 'ok',
    timestamp: new Date().toISOString(),
});
exports.createHealthPayload = createHealthPayload;
//# sourceMappingURL=health.js.map