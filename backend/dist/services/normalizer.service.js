"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalizerService = void 0;
const canonical_1 = require("../domain/canonical");
const mappings_1 = require("../domain/mappings");
class NormalizerService {
    /**
     * Normalizes raw incoming JSON payload into canonical format.
     * Handles nested structures like { "source": "client_A", "payload": { ... } }
     * and flat payloads alike.
     */
    static normalize(rawInput) {
        if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
            return {
                success: false,
                error: 'Payload must be a non-null JSON object',
                consumedKeys: new Set()
            };
        }
        const consumedKeys = new Set();
        // 1. Flatten payload if structured like { source: "...", payload: { ... } }
        let topLevelSource = null;
        let targetPayload = { ...rawInput };
        const topClientMatch = (0, mappings_1.findMatchingField)(rawInput, mappings_1.FIELD_ALIASES.client_id);
        if (topClientMatch) {
            topLevelSource = String(topClientMatch.value).trim();
            consumedKeys.add(topClientMatch.key);
        }
        if ('payload' in rawInput && rawInput.payload && typeof rawInput.payload === 'object' && !Array.isArray(rawInput.payload)) {
            targetPayload = { ...rawInput.payload };
            consumedKeys.add('payload');
        }
        // 2. Extract Client ID
        let clientId = topLevelSource;
        const clientMatch = (0, mappings_1.findMatchingField)(targetPayload, mappings_1.FIELD_ALIASES.client_id);
        if (clientMatch) {
            consumedKeys.add(clientMatch.key);
            clientId = String(clientMatch.value).trim();
        }
        // 3. Extract Metric
        let metric = null;
        const metricMatch = (0, mappings_1.findMatchingField)(targetPayload, mappings_1.FIELD_ALIASES.metric);
        if (metricMatch) {
            consumedKeys.add(metricMatch.key);
            metric = String(metricMatch.value).trim();
        }
        // 4. Extract Amount & Coerce to Number
        let amount = null;
        const amountMatch = (0, mappings_1.findMatchingField)(targetPayload, mappings_1.FIELD_ALIASES.amount);
        if (amountMatch) {
            consumedKeys.add(amountMatch.key);
            amount = this.parseAmount(amountMatch.value);
        }
        // 5. Extract Timestamp & Parse Date
        let timestampStr = new Date().toISOString();
        let isTimestampFallback = true; // Default to true unless explicitly provided and valid
        const timestampMatch = (0, mappings_1.findMatchingField)(targetPayload, mappings_1.FIELD_ALIASES.timestamp);
        if (timestampMatch) {
            consumedKeys.add(timestampMatch.key);
            const parsedDate = this.parseDate(timestampMatch.value);
            if (parsedDate) {
                timestampStr = parsedDate.toISOString();
                isTimestampFallback = false; // Valid payload timestamp present
            }
        }
        // 6. Gather Extra Unmapped Fields
        const extraFields = {};
        for (const [key, value] of Object.entries(targetPayload)) {
            if (!consumedKeys.has(key)) {
                extraFields[key] = value;
            }
        }
        const candidateEvent = {
            client_id: clientId || '',
            metric: metric || '',
            amount: amount !== null ? amount : NaN,
            timestamp: timestampStr,
            is_timestamp_fallback: isTimestampFallback,
            extra_fields: extraFields
        };
        // 7. Validate with Zod
        const validationResult = canonical_1.CanonicalEventSchema.safeParse(candidateEvent);
        if (!validationResult.success) {
            const issue = validationResult.error.issues[0];
            return {
                success: false,
                error: `Validation error: ${issue.path.join('.')} - ${issue.message}`,
                consumedKeys
            };
        }
        return {
            success: true,
            event: validationResult.data,
            consumedKeys
        };
    }
    static parseAmount(val) {
        if (typeof val === 'number') {
            return isNaN(val) ? null : val;
        }
        if (typeof val === 'string') {
            const cleaned = val.replace(/[^0-9.-]/g, '');
            if (cleaned.length === 0)
                return null;
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
        }
        return null;
    }
    static parseDate(val) {
        if (!val)
            return null;
        if (typeof val === 'number') {
            const ms = val < 10000000000 ? val * 1000 : val;
            const d = new Date(ms);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            const dateOnlyMatch = trimmed.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
            if (dateOnlyMatch) {
                const [_, y, m, d] = dateOnlyMatch;
                const monthStr = m.padStart(2, '0');
                const dayStr = d.padStart(2, '0');
                const isoUtcStr = `${y}-${monthStr}-${dayStr}T00:00:00.000Z`;
                const utcDate = new Date(isoUtcStr);
                if (!isNaN(utcDate.getTime()))
                    return utcDate;
            }
            let parsed = new Date(trimmed);
            if (!isNaN(parsed.getTime()))
                return parsed;
            const normalizedSlashes = trimmed.replace(/\//g, '-');
            parsed = new Date(normalizedSlashes);
            if (!isNaN(parsed.getTime()))
                return parsed;
        }
        return null;
    }
}
exports.NormalizerService = NormalizerService;
