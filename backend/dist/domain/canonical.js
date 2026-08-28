"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanonicalEventSchema = void 0;
const zod_1 = require("zod");
exports.CanonicalEventSchema = zod_1.z.object({
    client_id: zod_1.z.string({ required_error: 'client_id (or source) is required' }).min(1, 'client_id cannot be empty'),
    metric: zod_1.z.string({ required_error: 'metric is required' }).min(1, 'metric cannot be empty'),
    amount: zod_1.z.number({ required_error: 'amount must be a valid number' }).refine(val => !isNaN(val), 'amount must be a valid number'),
    timestamp: zod_1.z.string().datetime({ message: 'timestamp must be a valid ISO-8601 string' }),
    is_timestamp_fallback: zod_1.z.boolean().optional().default(false),
    extra_fields: zod_1.z.record(zod_1.z.unknown()).optional().default({})
});
