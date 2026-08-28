"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FingerprintService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class FingerprintService {
    /**
     * Generates a deterministic SHA-256 fingerprint for canonical events.
     * If a client provided a valid timestamp, uses a 5-minute time window bucket.
     * If timestamp was missing (fallback), uses a deterministic payload signature to ensure
     * retries across bucket boundaries never create duplicate fingerprints.
     */
    static generateFingerprint(event, windowMinutes = 5) {
        const formattedAmount = event.amount.toFixed(2);
        let fingerprintPayload;
        if (event.is_timestamp_fallback) {
            // Deterministic signature for missing client timestamps (removes fluctuating server time)
            const canonicalExtraFields = this.sortObjectKeys(event.extra_fields || {});
            fingerprintPayload = [
                event.client_id.trim().toLowerCase(),
                event.metric.trim().toLowerCase(),
                formattedAmount,
                'NO_CLIENT_TIMESTAMP',
                JSON.stringify(canonicalExtraFields)
            ].join('::');
        }
        else {
            // Standard time-bucketed fingerprint for explicit client timestamps
            const bucketIso = this.getTimeWindowBucket(event.timestamp, windowMinutes);
            fingerprintPayload = [
                event.client_id.trim().toLowerCase(),
                event.metric.trim().toLowerCase(),
                formattedAmount,
                bucketIso
            ].join('::');
        }
        return crypto_1.default.createHash('sha256').update(fingerprintPayload).digest('hex');
    }
    /**
     * Recursively sorts object keys so that JSON.stringify produces a deterministic string
     * regardless of key insertion order. Preserves arrays in their original order.
     */
    static sortObjectKeys(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObjectKeys(item));
        }
        const sortedObj = {};
        const sortedKeys = Object.keys(obj).sort();
        for (const key of sortedKeys) {
            sortedObj[key] = this.sortObjectKeys(obj[key]);
        }
        return sortedObj;
    }
    /**
     * Truncates an ISO timestamp into N-minute buckets (e.g. 5 minutes).
     */
    static getTimeWindowBucket(isoTimestamp, windowMinutes = 5) {
        const d = new Date(isoTimestamp);
        if (isNaN(d.getTime())) {
            return new Date(0).toISOString();
        }
        const msPerWindow = windowMinutes * 60 * 1000;
        const bucketMs = Math.floor(d.getTime() / msPerWindow) * msPerWindow;
        return new Date(bucketMs).toISOString();
    }
}
exports.FingerprintService = FingerprintService;
