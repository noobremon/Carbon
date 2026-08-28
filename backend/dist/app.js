"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const event_router_1 = __importDefault(require("./routes/event.router"));
const query_router_1 = __importDefault(require("./routes/query.router"));
const system_router_1 = __importDefault(require("./routes/system.router"));
const event_repository_1 = require("./repositories/event.repository");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// JSON Body Parser with Custom SyntaxError Handling (Fixes Critical Issue 2)
app.use(express_1.default.json({ limit: '2mb' }));
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.warn('⚠️ Malformed JSON syntax received from client');
        // Asynchronously preserve raw unparseable string input in raw_events for auditability
        event_repository_1.EventRepository.createRawEvent({ raw_text: err.body || 'Malformed JSON string' }, 'REJECTED').then(rawId => {
            event_repository_1.EventRepository.updateRawEvent(rawId, 'REJECTED', 'Malformed JSON syntax in request body');
        }).catch(() => { });
        return res.status(400).json({
            success: false,
            status: 'REJECTED',
            error: 'Malformed JSON syntax in request body'
        });
    }
    next(err);
});
// Primary Routes
app.use('/api', event_router_1.default);
app.use('/api', query_router_1.default);
app.use('/api/system', system_router_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Fault-Tolerant Data Processing Backend',
        timestamp: new Date().toISOString()
    });
});
// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('💥 Global Uncaught Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
});
exports.default = app;
