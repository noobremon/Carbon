"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const PORT = process.env.PORT || 4000;
async function startServer() {
    await (0, database_1.initDatabase)();
    app_1.default.listen(PORT, () => {
        console.log(`🚀 Fault-Tolerant Data Processing Server running on http://localhost:${PORT}`);
    });
}
startServer().catch(err => {
    console.error('Failed to start server:', err);
});
