"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const errorHandler_1 = require("./middleware/errorHandler");
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Basic health check route
app.get('/health', (req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
});
// API Routes will be registered here
app.use('/api/v1/customers', customer_routes_1.default);
// Global error handler must be last
app.use(errorHandler_1.errorHandler);
exports.default = app;
