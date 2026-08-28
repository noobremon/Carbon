"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const normalizer_service_1 = require("../services/normalizer.service");
const fingerprint_service_1 = require("../services/fingerprint.service");
const event_repository_1 = require("../repositories/event.repository");
const database_1 = require("../config/database");
describe('Critical Issues Remediation Test Suite', () => {
    beforeEach(() => {
        database_1.inMemoryDb.reset();
    });
    test('Critical Fix 1: Events missing client timestamp generate identical fingerprints across bucket boundaries', () => {
        const payloadNoTimestamp = {
            source: "client_NO_TS",
            payload: {
                metric: "subscription_renew",
                amount: "49.99"
            }
        };
        // Normalize at 10:04:59 (Bucket 10:00:00)
        const norm1 = normalizer_service_1.NormalizerService.normalize(payloadNoTimestamp);
        expect(norm1.event?.is_timestamp_fallback).toBe(true);
        norm1.event.timestamp = "2024-01-01T10:04:59.000Z";
        const fingerprint1 = fingerprint_service_1.FingerprintService.generateFingerprint(norm1.event);
        // Normalize at 10:05:02 (Bucket 10:05:00 - across boundary!)
        const norm2 = normalizer_service_1.NormalizerService.normalize(payloadNoTimestamp);
        expect(norm2.event?.is_timestamp_fallback).toBe(true);
        norm2.event.timestamp = "2024-01-01T10:05:02.000Z";
        const fingerprint2 = fingerprint_service_1.FingerprintService.generateFingerprint(norm2.event);
        // Fingerprints MUST BE IDENTICAL!
        expect(fingerprint1).toBe(fingerprint2);
    });
    test('Critical Fix 2: Express catches malformed JSON syntax and records raw input with REJECTED status', async () => {
        const response = await (0, supertest_1.default)(app_1.default)
            .post('/api/events')
            .set('Content-Type', 'application/json')
            .send('{ "source": "client_MALFORMED", "payload": { '); // Invalid JSON syntax
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.status).toBe('REJECTED');
        expect(response.body.error).toContain('Malformed JSON syntax');
        // Verify raw input preserved in raw_events
        const recent = await event_repository_1.EventRepository.findRecentEvents(1);
        expect(recent.length).toBe(1);
        expect(recent[0].status).toBe('REJECTED');
        expect(recent[0].error_message).toContain('Malformed JSON syntax');
    });
    test('Critical Fix 3: GET /api/aggregates on empty database returns [] instead of client_id: undefined', async () => {
        const response = await (0, supertest_1.default)(app_1.default).get('/api/aggregates');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.aggregates).toEqual([]);
    });
    test('Critical Fix 4: Fingerprint generation is fully deterministic across differing key order in extra_fields', () => {
        const event1 = {
            client_id: "client_EXTRA",
            metric: "custom_event",
            amount: 100,
            timestamp: "2024-01-01T12:00:00.000Z",
            is_timestamp_fallback: true,
            extra_fields: {
                a: 1,
                b: 2,
                nested: {
                    x: "first",
                    y: "second"
                }
            }
        };
        const event2 = {
            client_id: "client_EXTRA",
            metric: "custom_event",
            amount: 100,
            timestamp: "2024-01-01T12:00:00.000Z",
            is_timestamp_fallback: true,
            extra_fields: {
                b: 2,
                nested: {
                    y: "second",
                    x: "first"
                },
                a: 1
            }
        };
        const fp1 = fingerprint_service_1.FingerprintService.generateFingerprint(event1);
        const fp2 = fingerprint_service_1.FingerprintService.generateFingerprint(event2);
        expect(fp1).toBe(fp2);
    });
});
